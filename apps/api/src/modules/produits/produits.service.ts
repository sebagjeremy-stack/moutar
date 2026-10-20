import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, isNull } from 'drizzle-orm';
import type { Produit } from '@moutar/shared-types';
import { ErreurMetier } from '../../common/erreurs/erreur-metier';
import { loadEnv } from '../../config/env';
import type { Database } from '../../database/client';
import { DRIZZLE } from '../../database/database.module';
import { produit } from '../../database/schema';
import { normaliser } from '@moutar/shared-types/regles/normalisation';
import { extraireCodesE } from '../analyse/analyse-composition-regles';
import { lireFicheOff, type FicheOff } from './off-client';

type LigneProduit = typeof produit.$inferSelect;

/** Une fiche Open Food Facts se relit, silencieusement, passé ce délai depuis sa lecture (`lu_le`). */
export const RELECTURE_OFF_MS = 30 * 24 * 60 * 60 * 1000;

export function versProduit(l: LigneProduit): Produit {
  return {
    id: l.id,
    ean: l.ean,
    nom: l.nom,
    marque: l.marque,
    imageUrl: l.imageUrl,
    ingredientsTexte: l.ingredientsTexte,
    additifs: l.additifs,
    source: l.source,
    luLe: l.luLe.toISOString(),
  };
}

/** Les colonnes normalisées de la recherche (lot 2), tenues à CHAQUE écriture du nom ou de la marque. */
export function normes(nom: string, marque: string | null): { nomNorm: string; marqueNorm: string } {
  return { nomNorm: normaliser(nom), marqueNorm: normaliser(marque) };
}

export interface CreationManuelle {
  ean: string | null;
  nom: string;
  marque: string | null;
  ingredientsTexte: string | null;
}

@Injectable()
export class ProduitsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * La fiche en base (cache), sinon Open Food Facts puis enregistrement. 404 `produit_inconnu`, 503 `source_indisponible`.
   * Une fiche retirée (soft-delete) n'est JAMAIS ressuscitée par une lecture : 404, sans appel à OFF ni écriture.
   * Une fiche OFF lue il y a plus de 30 jours se relit, silencieusement ; en cas d'échec, l'ancienne reste servie.
   */
  async lireParEan(ean: string): Promise<Produit> {
    const existante = await this.trouverParEan(ean, { retireesComprises: true });
    if (existante?.deletedAt) throw new ErreurMetier(404, 'produit_inconnu', 'Produit inconnu.', { ean });
    if (existante) {
      if (existante.source === 'off' && Date.now() - existante.luLe.getTime() > RELECTURE_OFF_MS) {
        const relue = await lireFicheOff(loadEnv().OFF_BASE_URL, ean);
        if (relue.etat === 'trouve') return versProduit(await this.enregistrerFicheOff(relue.fiche));
      }
      return versProduit(existante);
    }
    const resultat = await lireFicheOff(loadEnv().OFF_BASE_URL, ean);
    if (resultat.etat === 'indisponible') {
      throw new ErreurMetier(503, 'source_indisponible', 'Open Food Facts ne répond pas : la fiche n’a pas pu être lue. Réessayez, ou créez le produit à la main.');
    }
    if (resultat.etat === 'inconnu') {
      throw new ErreurMetier(404, 'produit_inconnu', 'Produit inconnu d’Open Food Facts : vous pouvez le créer à la main.', { ean });
    }
    return versProduit(await this.enregistrerFicheOff(resultat.fiche));
  }

  /** La ligne d'un EAN ; les fiches retirées ne se voient que sur demande. */
  async trouverParEan(ean: string, options: { retireesComprises?: boolean } = {}): Promise<LigneProduit | null> {
    const condition = options.retireesComprises ? eq(produit.ean, ean) : and(eq(produit.ean, ean), isNull(produit.deletedAt));
    const [l] = await this.db.select().from(produit).where(condition).limit(1);
    return l ?? null;
  }

  /** Création manuelle (produit absent d'OFF). Un EAN déjà connu (vivant ou retiré) → 409 `produit_existant`. */
  async creerManuel(c: CreationManuelle): Promise<Produit> {
    if (c.ean) {
      const existante = await this.trouverParEan(c.ean, { retireesComprises: true });
      if (existante) throw new ErreurMetier(409, 'produit_existant', 'Ce code-barres a déjà une fiche.', { ean: c.ean });
    }
    const [l] = await this.db
      .insert(produit)
      .values({ ean: c.ean, nom: c.nom, marque: c.marque, ...normes(c.nom, c.marque), ingredientsTexte: c.ingredientsTexte, additifs: c.ingredientsTexte ? extraireCodesE(c.ingredientsTexte) : [], source: 'manuel' })
      .returning();
    return versProduit(l);
  }

  /** Les ingrédients saisis par l'utilisateur (lot 1 : texte collé ; lot 3 : OCR relu). */
  async mettreAJourIngredients(ean: string, ingredientsTexte: string): Promise<Produit> {
    const existante = await this.trouverParEan(ean);
    if (!existante) throw new ErreurMetier(404, 'produit_inconnu', 'Produit inconnu : créez-le d’abord.', { ean });
    const [l] = await this.db
      .update(produit)
      .set({ ingredientsTexte, additifs: extraireCodesE(ingredientsTexte), updatedAt: new Date() })
      .where(eq(produit.id, existante.id))
      .returning();
    return versProduit(l);
  }

  /** Les derniers produits lus (console), du plus récent au plus ancien. */
  async derniers(limite = 50): Promise<Produit[]> {
    const lignes = await this.db.select().from(produit).where(isNull(produit.deletedAt)).orderBy(desc(produit.luLe)).limit(limite);
    return lignes.map(versProduit);
  }

  /** Écrit (ou relit) une fiche OFF vivante ; une fiche retirée n'est jamais ressuscitée (`deleted_at` intouché). */
  private async enregistrerFicheOff(f: FicheOff): Promise<LigneProduit> {
    const [l] = await this.db
      .insert(produit)
      .values({ ean: f.ean, nom: f.nom, marque: f.marque, ...normes(f.nom, f.marque), imageUrl: f.imageUrl, ingredientsTexte: f.ingredientsTexte, additifs: f.additifs, source: 'off' })
      .onConflictDoUpdate({
        target: produit.ean,
        set: { nom: f.nom, marque: f.marque, ...normes(f.nom, f.marque), imageUrl: f.imageUrl, ingredientsTexte: f.ingredientsTexte, additifs: f.additifs, source: 'off', luLe: new Date(), updatedAt: new Date() },
        setWhere: isNull(produit.deletedAt),
      })
      .returning();
    if (!l) throw new ErreurMetier(404, 'produit_inconnu', 'Produit inconnu.', { ean: f.ean });
    return l;
  }
}
