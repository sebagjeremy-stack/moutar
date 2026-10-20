import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import type { EtatSignalement, Niveau, SignalementConsole, SignalementCree } from '@moutar/shared-types';
import { ErreurMetier } from '../../common/erreurs/erreur-metier';
import { texteBrut } from '../../common/validation/texte-brut';
import type { Database } from '../../database/client';
import { DRIZZLE } from '../../database/database.module';
import { produit, signalement } from '../../database/schema';
import { journaliserSur, type SessionLue } from '../admin/admin.service';
import { ProduitsService } from '../produits/produits.service';
import { SIGNALEMENT_TEXTE_MAX } from './contributions-regles';

/** Lot 5 : « Signaler une erreur » sur une ligne de la carte ; lu et traité à la console (journal `signalement.traitement`). */
@Injectable()
export class SignalementsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly produits: ProduitsService,
  ) {}

  async signaler(ean: string, s: { niveau: Niveau; texte: string }): Promise<SignalementCree> {
    const p = await this.produits.lireParEan(ean);
    const texte = texteBrut(s.texte).slice(0, SIGNALEMENT_TEXTE_MAX);
    if (!texte) throw new ErreurMetier(400, 'requete_invalide', 'Dites ce qui est faux (texte vide après nettoyage).');
    const [l] = await this.db.insert(signalement).values({ produitId: p.id, niveau: s.niveau, texte, etat: 'ouvert' }).returning({ id: signalement.id });
    return { id: l.id, etat: 'ouvert' };
  }

  async console(etat: EtatSignalement, limite = 200): Promise<SignalementConsole[]> {
    const lignes = await this.db
      .select({ s: signalement, p: { id: produit.id, ean: produit.ean, nom: produit.nom, marque: produit.marque } })
      .from(signalement)
      .innerJoin(produit, eq(produit.id, signalement.produitId))
      .where(eq(signalement.etat, etat))
      .orderBy(desc(signalement.createdAt))
      .limit(limite);
    return lignes.map(({ s, p }) => versConsole(s, p));
  }

  /** Marque un signalement traité ; 404 inconnu, 409 `etat_identique` s'il l'est déjà ; journalisé dans la transaction. */
  async traiter(id: string, session: SessionLue): Promise<SignalementConsole> {
    const ligne = await this.db.transaction(async (tx) => {
      const [s] = await tx.select().from(signalement).where(eq(signalement.id, id)).limit(1);
      if (!s) throw new ErreurMetier(404, 'signalement_inconnu', 'Signalement inconnu.');
      if (s.etat === 'traite') throw new ErreurMetier(409, 'etat_identique', 'Ce signalement est déjà traité.');
      const [apres] = await tx
        .update(signalement)
        .set({ etat: 'traite', traiteLe: new Date() })
        .where(and(eq(signalement.id, id), eq(signalement.etat, 'ouvert')))
        .returning();
      await journaliserSur(tx, session.compteId, 'signalement.traitement', id, { produitId: s.produitId, niveau: s.niveau });
      return apres;
    });
    const [p] = await this.db.select({ id: produit.id, ean: produit.ean, nom: produit.nom, marque: produit.marque }).from(produit).where(eq(produit.id, ligne.produitId)).limit(1);
    return versConsole(ligne, p ?? { id: ligne.produitId, ean: null, nom: '?', marque: null });
  }
}

function versConsole(s: typeof signalement.$inferSelect, p: { id: string; ean: string | null; nom: string; marque: string | null }): SignalementConsole {
  return { id: s.id, produit: p, niveau: s.niveau as Niveau, texte: s.texte, etat: s.etat, traiteLe: s.traiteLe?.toISOString() ?? null, createdAt: s.createdAt.toISOString() };
}
