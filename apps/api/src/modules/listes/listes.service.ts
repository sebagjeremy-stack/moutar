import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, isNull, like, sql } from 'drizzle-orm';
import type { CodeListe, LigneAnalysee, LigneListe, ListeOfficielle, SousLigneListe, StatutVerdict } from '@moutar/shared-types';
import { normaliser } from '@moutar/shared-types/regles/normalisation';
import { ErreurMetier } from '../../common/erreurs/erreur-metier';
import type { Database } from '../../database/client';
import { DRIZZLE } from '../../database/database.module';
import { ligneListe, listeOfficielle, verdict } from '../../database/schema';
import { journaliserSur, type SessionLue } from '../admin/admin.service';
import { analyserTexteConsistoire } from './analyse-liste-consistoire';
import { analyserCsv } from './analyse-liste-csv';
import { codeMention, rubriqueReservee, type ResultatAnalyseListe } from './analyse-liste-commun';
import { analyserTexteRavWolff } from './analyse-liste-rav-wolff';
import type { ListeActive } from './correspondance-liste-regles';
import { texteDuFichier, type FichierRecu } from './pdf-texte';

type LigneListeDb = typeof ligneListe.$inferSelect;
type ListeDb = typeof listeOfficielle.$inferSelect;

export type FormatSource = 'auto' | 'texte' | 'csv';

export interface SourceAnalyse {
  code: CodeListe;
  format: FormatSource;
  texte: string | null;
  fichier: FichierRecu | null;
}

export interface ImportListe {
  code: CodeListe;
  titre: string;
  publieLe: string | null;
  valableJusquAu: string | null;
  fichierNom: string | null;
  noteSource: string | null;
  lignes: LigneAnalysee[];
}

export interface ChampsListe {
  titre?: string;
  publieLe?: string | null;
  valableJusquAu?: string | null;
  noteSource?: string | null;
  active?: boolean;
}

export type ChampsLigne = Partial<Omit<LigneListe, 'id' | 'listeId'>>;

/** Les listes actives et leurs lignes sont gardées en mémoire ce temps-là (une carte ne relit pas 3 000 lignes à chaque fois). */
const DUREE_CACHE_MS = 30_000;
const TAILLE_LOT = 500;

export function versListe(l: ListeDb, nombreLignes: number): ListeOfficielle {
  return {
    id: l.id,
    code: l.code,
    titre: l.titre,
    publieLe: l.publieLe,
    valableJusquAu: l.valableJusquAu,
    importeLe: l.importeLe.toISOString(),
    fichierNom: l.fichierNom,
    noteSource: l.noteSource,
    active: l.active,
    nombreLignes,
  };
}

export function versLigne(l: LigneListeDb): LigneListe {
  return { id: l.id, listeId: l.listeId, rubrique: l.rubrique, marque: l.marque, produitLibelle: l.produitLibelle, mention: l.mention, touteMarque: l.touteMarque, rubriqueReservee: l.rubriqueReservee, ordre: l.ordre };
}

/** Les colonnes normalisées d'une ligne (règle partagée), tenues à CHAQUE écriture. */
export function normesLigne(l: Pick<LigneAnalysee, 'rubrique' | 'marque' | 'produitLibelle'>): { rubriqueNorm: string; marqueNorm: string; produitNorm: string } {
  return { rubriqueNorm: normaliser(l.rubrique), marqueNorm: normaliser(l.marque), produitNorm: normaliser(l.produitLibelle) };
}

/** Pure : une ligne cohérente, ou le refus (400). « Toute marque » exclut marque et produit, et jamais sous une rubrique réservée. */
export function verifierLigne(l: Pick<LigneAnalysee, 'rubrique' | 'marque' | 'produitLibelle' | 'touteMarque' | 'rubriqueReservee'>): string | null {
  if (!l.rubrique.trim()) return 'La rubrique est obligatoire.';
  if (l.touteMarque && (l.marque || l.produitLibelle)) return 'Une ligne « toute marque » ne nomme ni marque ni produit.';
  if (l.touteMarque && l.rubriqueReservee) return 'Une rubrique réservée (viande, charcuterie, vin, jus de raisin, fromage) n’est jamais « toute marque ».';
  if (!l.touteMarque && !l.marque && !l.produitLibelle) return 'Une ligne nomme une marque ou un produit, ou vaut « toute marque ».';
  return null;
}

/** L'instant (midi UTC) d'un jour `AAAA-MM-JJ`, pour les colonnes `timestamptz` de la table `verdict` ; null sinon. */
export function instantDuJour(jour: string | null): Date | null {
  return jour && /^\d{4}-\d{2}-\d{2}$/.test(jour) ? new Date(`${jour}T12:00:00Z`) : null;
}

/**
 * Le compte des lignes vivantes d'une liste, en SQL brut : dans un champ de `select`, Drizzle retire le préfixe de table
 * des colonnes citées (`"liste_id" = "id"` se référerait à la sous-requête elle-même).
 */
const COMPTE_LIGNES = sql<number>`(select count(*)::int from ligne_liste ll where ll.liste_id = liste_officielle.id and ll.deleted_at is null)`;

const STATUT_VERDICT: Record<SousLigneListe['statut'], StatutVerdict> = { cite: 'cite', cite_par_rubrique: 'cite', perime: 'cite', non_cite: 'non_cite' };

@Injectable()
export class ListesService {
  private cache: { lu: number; listes: ListeActive[] } | null = null;

  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** Aperçu : le texte (fichier PDF ou texte, ou texte collé) analysé selon le code et le format, SANS écrire. */
  async apercu(source: SourceAnalyse): Promise<ResultatAnalyseListe & { fichierNom: string | null }> {
    let texte = source.texte ?? '';
    if (source.fichier) texte = await texteDuFichier(source.fichier);
    if (!texte.trim()) throw new ErreurMetier(400, 'texte_absent', 'Envoyez un fichier (PDF, texte, CSV) ou collez le texte de la liste.');
    const csv = source.format === 'csv' || (source.format === 'auto' && /\.csv$/i.test(source.fichier?.originalname ?? ''));
    const resultat = csv ? analyserCsv(texte) : source.code === 'rav_wolff' ? analyserTexteRavWolff(texte) : analyserTexteConsistoire(texte);
    return { ...resultat, fichierNom: source.fichier?.originalname ?? null };
  }

  /** Toutes les listes (actives et anciennes, hors retirées), avec leur compte de lignes vivantes. */
  async lister(): Promise<ListeOfficielle[]> {
    const lignes = await this.db
      .select({ liste: listeOfficielle, nombre: COMPTE_LIGNES })
      .from(listeOfficielle)
      .where(isNull(listeOfficielle.deletedAt))
      .orderBy(asc(listeOfficielle.code), desc(listeOfficielle.active), desc(listeOfficielle.importeLe));
    return lignes.map((l) => versListe(l.liste, l.nombre));
  }

  async lire(id: string): Promise<ListeOfficielle> {
    const [l] = await this.db
      .select({ liste: listeOfficielle, nombre: COMPTE_LIGNES })
      .from(listeOfficielle)
      .where(and(eq(listeOfficielle.id, id), isNull(listeOfficielle.deletedAt)))
      .limit(1);
    if (!l) throw new ErreurMetier(404, 'liste_inconnue', 'Liste inconnue.');
    return versListe(l.liste, l.nombre);
  }

  /**
   * Importe une édition : dans UNE transaction, l'ancienne liste active du même code passe `active = false` (elle reste
   * lisible), la liste et ses lignes s'écrivent, le journal note `liste.import`. Aucune ligne → 400 `liste_vide` ; une
   * ligne incohérente → 400 `ligne_invalide` (rien n'est écrit).
   */
  async importer(i: ImportListe, session: SessionLue): Promise<ListeOfficielle> {
    if (i.lignes.length === 0) throw new ErreurMetier(400, 'liste_vide', 'Aucune ligne à importer : vérifiez l’aperçu.');
    i.lignes.forEach((l, index) => {
      const refus = verifierLigne(l);
      if (refus) throw new ErreurMetier(400, 'ligne_invalide', `Ligne ${index + 1} : ${refus}`, { index });
    });
    const liste = await this.db.transaction(async (tx) => {
      await tx
        .update(listeOfficielle)
        .set({ active: false })
        .where(and(eq(listeOfficielle.code, i.code), eq(listeOfficielle.active, true), isNull(listeOfficielle.deletedAt)));
      const [creee] = await tx
        .insert(listeOfficielle)
        .values({ code: i.code, titre: i.titre, publieLe: i.publieLe, valableJusquAu: i.valableJusquAu, fichierNom: i.fichierNom, noteSource: i.noteSource, active: true })
        .returning();
      for (let depart = 0; depart < i.lignes.length; depart += TAILLE_LOT) {
        const lot = i.lignes.slice(depart, depart + TAILLE_LOT).map((l, k) => ({
          listeId: creee.id,
          rubrique: l.rubrique.trim(),
          marque: l.marque,
          produitLibelle: l.produitLibelle,
          mention: codeMention(l.mention),
          touteMarque: l.touteMarque,
          rubriqueReservee: l.rubriqueReservee,
          ordre: depart + k,
          ...normesLigne(l),
        }));
        await tx.insert(ligneListe).values(lot);
      }
      await journaliserSur(tx, session.compteId, 'liste.import', creee.id, { code: i.code, titre: i.titre, nombreLignes: i.lignes.length, fichierNom: i.fichierNom, publieLe: i.publieLe, valableJusquAu: i.valableJusquAu });
      return creee;
    });
    this.oublierCache();
    return versListe(liste, i.lignes.length);
  }

  /** Titre, dates, note, activation (activer une liste désactive l'autre du même code, dans la même transaction) ; journalisé. */
  async modifier(id: string, champs: ChampsListe, session: SessionLue): Promise<ListeOfficielle> {
    const avant = await this.lire(id);
    await this.db.transaction(async (tx) => {
      if (champs.active === true) {
        await tx
          .update(listeOfficielle)
          .set({ active: false })
          .where(and(eq(listeOfficielle.code, avant.code), eq(listeOfficielle.active, true), isNull(listeOfficielle.deletedAt)));
      }
      await tx
        .update(listeOfficielle)
        .set({
          ...(champs.titre !== undefined ? { titre: champs.titre } : {}),
          ...(champs.publieLe !== undefined ? { publieLe: champs.publieLe } : {}),
          ...(champs.valableJusquAu !== undefined ? { valableJusquAu: champs.valableJusquAu } : {}),
          ...(champs.noteSource !== undefined ? { noteSource: champs.noteSource } : {}),
          ...(champs.active !== undefined ? { active: champs.active } : {}),
        })
        .where(eq(listeOfficielle.id, id));
      await journaliserSur(tx, session.compteId, 'liste.modification', id, { code: avant.code, ...champs });
    });
    this.oublierCache();
    return this.lire(id);
  }

  /** Les lignes d'une liste (vivantes), dans l'ordre ; `q` filtre sur rubrique, marque et produit normalisés. */
  async lignes(id: string, q: string | null, limite = 5000): Promise<{ liste: ListeOfficielle; compte: number; lignes: LigneListe[] }> {
    const liste = await this.lire(id);
    const conditions = [eq(ligneListe.listeId, id), isNull(ligneListe.deletedAt)];
    for (const mot of normaliser(q).split(' ').filter(Boolean)) {
      conditions.push(like(sql`${ligneListe.rubriqueNorm} || ' ' || ${ligneListe.marqueNorm} || ' ' || ${ligneListe.produitNorm}`, `%${mot}%`));
    }
    const lignes = await this.db
      .select()
      .from(ligneListe)
      .where(and(...conditions))
      .orderBy(asc(ligneListe.ordre))
      .limit(limite);
    return { liste, compte: lignes.length, lignes: lignes.map(versLigne) };
  }

  /** Ajout manuel d'une ligne (à la fin) ; journalisé. */
  async ajouterLigne(id: string, l: Omit<LigneAnalysee, 'ordre'>, session: SessionLue): Promise<LigneListe> {
    await this.lire(id);
    const refus = verifierLigne(l);
    if (refus) throw new ErreurMetier(400, 'ligne_invalide', refus);
    const [{ max }] = await this.db.select({ max: sql<number>`coalesce(max(${ligneListe.ordre}), -1)::int` }).from(ligneListe).where(eq(ligneListe.listeId, id));
    const [creee] = await this.db
      .insert(ligneListe)
      .values({ listeId: id, rubrique: l.rubrique.trim(), marque: l.marque, produitLibelle: l.produitLibelle, mention: codeMention(l.mention), touteMarque: l.touteMarque, rubriqueReservee: l.rubriqueReservee, ordre: max + 1, ...normesLigne(l) })
      .returning();
    await journaliserSur(this.db, session.compteId, 'ligne.ajout', creee.id, { listeId: id, rubrique: l.rubrique, marque: l.marque, produitLibelle: l.produitLibelle, mention: l.mention, touteMarque: l.touteMarque });
    this.oublierCache();
    return versLigne(creee);
  }

  /** Correction d'une ligne ; `rubriqueReservee` se recalcule si la rubrique change sans qu'on l'ait dit ; journalisé. */
  async modifierLigne(id: string, ligneId: string, champs: ChampsLigne, session: SessionLue): Promise<LigneListe> {
    const avant = await this.ligneVivante(id, ligneId);
    const apres = {
      rubrique: champs.rubrique ?? avant.rubrique,
      marque: champs.marque !== undefined ? champs.marque : avant.marque,
      produitLibelle: champs.produitLibelle !== undefined ? champs.produitLibelle : avant.produitLibelle,
      mention: champs.mention !== undefined ? codeMention(champs.mention) : avant.mention,
      touteMarque: champs.touteMarque ?? avant.touteMarque,
      rubriqueReservee: champs.rubriqueReservee ?? (champs.rubrique !== undefined && champs.rubrique !== avant.rubrique ? rubriqueReservee(champs.rubrique) : avant.rubriqueReservee),
      ordre: champs.ordre ?? avant.ordre,
    };
    const refus = verifierLigne(apres);
    if (refus) throw new ErreurMetier(400, 'ligne_invalide', refus);
    const [l] = await this.db
      .update(ligneListe)
      .set({ ...apres, rubrique: apres.rubrique.trim(), ...normesLigne(apres), updatedAt: new Date() })
      .where(eq(ligneListe.id, ligneId))
      .returning();
    await journaliserSur(this.db, session.compteId, 'ligne.modification', ligneId, { listeId: id, avant: versLigne(avant), apres: versLigne(l) });
    this.oublierCache();
    return versLigne(l);
  }

  /** Retrait doux d'une ligne ; journalisé. */
  async retirerLigne(id: string, ligneId: string, session: SessionLue): Promise<{ ok: true }> {
    const avant = await this.ligneVivante(id, ligneId);
    await this.db.update(ligneListe).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(ligneListe.id, ligneId));
    await journaliserSur(this.db, session.compteId, 'ligne.suppression', ligneId, { listeId: id, ligne: versLigne(avant) });
    this.oublierCache();
    return { ok: true };
  }

  /** Les listes ACTIVES et leurs lignes vivantes, pour la carte et la recherche (cache de 30 s, oublié à chaque écriture). */
  async listesActives(): Promise<ListeActive[]> {
    if (this.cache && Date.now() - this.cache.lu < DUREE_CACHE_MS) return this.cache.listes;
    const listes = await this.db
      .select()
      .from(listeOfficielle)
      .where(and(eq(listeOfficielle.active, true), isNull(listeOfficielle.deletedAt)))
      .orderBy(asc(listeOfficielle.code));
    const resultat: ListeActive[] = [];
    for (const l of listes) {
      const lignes = await this.db
        .select({ id: ligneListe.id, rubrique: ligneListe.rubrique, marque: ligneListe.marque, produitLibelle: ligneListe.produitLibelle, mention: ligneListe.mention, touteMarque: ligneListe.touteMarque, rubriqueReservee: ligneListe.rubriqueReservee })
        .from(ligneListe)
        .where(and(eq(ligneListe.listeId, l.id), isNull(ligneListe.deletedAt)))
        .orderBy(asc(ligneListe.ordre));
      resultat.push({ id: l.id, code: l.code, titre: l.titre, publieLe: l.publieLe, valableJusquAu: l.valableJusquAu, lignes });
    }
    this.cache = { lu: Date.now(), listes: resultat };
    return resultat;
  }

  oublierCache(): void {
    this.cache = null;
  }

  /**
   * Écrit les verdicts de niveau 2 d'un produit (un par liste active) seulement s'ils CHANGENT (empreinte dans `detail`,
   * comme le niveau 4). Le statut écrit est celui de la liste (`cite` / `non_cite`) ; « périmé » se lit par
   * `valable_jusqu_au`, jamais figé dans la ligne.
   */
  async enregistrerVerdictsNiveau2(produitId: string, sousLignes: SousLigneListe[]): Promise<void> {
    if (sousLignes.length === 0) return;
    const derniers = await this.db
      .select({ detail: verdict.detail })
      .from(verdict)
      .where(and(eq(verdict.produitId, produitId), eq(verdict.niveau, 2), isNull(verdict.deletedAt)))
      .orderBy(desc(verdict.createdAt));
    const empreintes = new Map<string, string>();
    for (const d of derniers) {
      const listeId = typeof d.detail['listeId'] === 'string' ? d.detail['listeId'] : null;
      if (listeId && !empreintes.has(listeId)) empreintes.set(listeId, String(d.detail['empreinte'] ?? ''));
    }
    for (const s of sousLignes) {
      const statutListe = s.statut === 'perime' ? (s.ligne ? 'cite' : 'non_cite') : s.statut;
      const empreinte = createHash('sha256').update(JSON.stringify([s.listeId, statutListe, s.ligne?.id ?? null, s.mention, s.valableJusquAu, s.confiance])).digest('hex');
      if (empreintes.get(s.listeId) === empreinte) continue;
      await this.db.insert(verdict).values({
        produitId,
        niveau: 2,
        statut: STATUT_VERDICT[statutListe],
        source: s.source,
        mention: s.mention,
        publieLe: instantDuJour(s.publieLe),
        valableJusquAu: instantDuJour(s.valableJusquAu),
        detail: { empreinte, listeId: s.listeId, code: s.code, statutSousLigne: statutListe, confiance: s.confiance, ligneId: s.ligne?.id ?? null, detail: s.detail },
      });
    }
  }

  private async ligneVivante(listeId: string, ligneId: string): Promise<LigneListeDb> {
    const [l] = await this.db
      .select()
      .from(ligneListe)
      .where(and(eq(ligneListe.id, ligneId), eq(ligneListe.listeId, listeId), isNull(ligneListe.deletedAt)))
      .limit(1);
    if (!l) throw new ErreurMetier(404, 'ligne_inconnue', 'Ligne inconnue dans cette liste.');
    return l;
  }
}
