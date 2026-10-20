import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, isNull, sql } from 'drizzle-orm';
import type { ContributionConsole, ContributionProposee, ContributionPublique, ContributionsProduit, EtatContribution, PropositionContribution } from '@moutar/shared-types';
import { ErreurMetier } from '../../common/erreurs/erreur-metier';
import type { Database } from '../../database/client';
import { DRIZZLE } from '../../database/database.module';
import { contribution, produit, verdict } from '../../database/schema';
import { journaliserSur, type SessionLue } from '../admin/admin.service';
import { ProduitsService } from '../produits/produits.service';
import { nettoyerProposition, verdictDeContribution } from './contributions-regles';

type LigneContribution = typeof contribution.$inferSelect;

/** Ce que la console décide d'une contribution : validée, ou refusée (avec un motif facultatif). */
export interface DecisionContribution {
  etat: 'validee' | 'refusee';
  motifRefus: string | null;
}

/**
 * Lot 5 : les contributions communautaires (niveau 3). Le public PROPOSE (texte brut, preuve vérifiée par le contrôleur) ;
 * la console VALIDE ou REFUSE dans une transaction sous le verrou du produit (`pg_advisory_xact_lock(hashtext('produit:<id>'))`),
 * qui écrit le verdict de niveau 3 à la validation et le retire (doux) au refus ; chaque décision va au journal d'administration.
 * La carte lit les contributions VALIDÉES (règle pure `ligneCommunautaire`), le verdict n'est que la trace.
 */
@Injectable()
export class ContributionsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly produits: ProduitsService,
  ) {}

  /** Une proposition du public : 201 `{ id, etat: 'proposee' }`. Le produit doit exister (404 sinon). */
  async proposer(ean: string, brute: PropositionContribution): Promise<ContributionProposee> {
    const p = await this.produits.lireParEan(ean);
    const c = nettoyerProposition(brute);
    if (!c.sourceTexte) throw new ErreurMetier(400, 'requete_invalide', 'Dites ce que la source affirme (texte vide après nettoyage).');
    const [l] = await this.db
      .insert(contribution)
      .values({ produitId: p.id, niveau: 3, statutPropose: c.statutPropose, sourceType: c.sourceType, sourceTexte: c.sourceTexte, sourceDate: c.sourceDate, preuveUrl: c.preuveUrl, auteurNom: c.auteurNom, etat: 'proposee' })
      .returning({ id: contribution.id });
    return { id: l.id, etat: 'proposee' };
  }

  /** Ce que le public lit : les contributions VALIDÉES (la plus récente d'abord) et le nombre en attente. */
  async publiques(produitId: string): Promise<ContributionsProduit> {
    const validees = await this.db
      .select()
      .from(contribution)
      .where(and(eq(contribution.produitId, produitId), eq(contribution.etat, 'validee'), isNull(contribution.deletedAt)))
      .orderBy(desc(contribution.valideeLe));
    const [attente] = await this.db
      .select({ n: count() })
      .from(contribution)
      .where(and(eq(contribution.produitId, produitId), eq(contribution.etat, 'proposee'), isNull(contribution.deletedAt)));
    return { contributions: validees.map(versPublique), enAttente: Number(attente?.n ?? 0) };
  }

  async publiquesParEan(ean: string): Promise<ContributionsProduit> {
    const p = await this.produits.lireParEan(ean);
    return this.publiques(p.id);
  }

  /** La console : les contributions d'un état, avec le produit nommé, les plus récentes d'abord (200 au plus). */
  async console(etat: EtatContribution, limite = 200): Promise<ContributionConsole[]> {
    const lignes = await this.db
      .select({ c: contribution, p: { id: produit.id, ean: produit.ean, nom: produit.nom, marque: produit.marque } })
      .from(contribution)
      .innerJoin(produit, eq(produit.id, contribution.produitId))
      .where(and(eq(contribution.etat, etat), isNull(contribution.deletedAt)))
      .orderBy(desc(contribution.createdAt))
      .limit(limite);
    return lignes.map(({ c, p }) => versConsole(c, p));
  }

  /**
   * La décision de la console, dans UNE transaction : verrou du produit, contribution RELUE sous le verrou (404 inconnue,
   * 409 `etat_identique`), mise à jour, verdict de niveau 3 écrit (validation) ou retiré en douceur (refus), journal
   * `contribution.validation` / `contribution.refus`. Aucun appel réseau dans la transaction.
   */
  async decider(id: string, decision: DecisionContribution, session: SessionLue): Promise<ContributionConsole> {
    const avant = await this.lire(id);
    const ligne = await this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`produit:${avant.produitId}`}))`);
      const [c] = await tx
        .select()
        .from(contribution)
        .where(and(eq(contribution.id, id), isNull(contribution.deletedAt)))
        .limit(1);
      if (!c) throw new ErreurMetier(404, 'contribution_inconnue', 'Contribution inconnue.');
      if (c.etat === decision.etat) throw new ErreurMetier(409, 'etat_identique', `Cette contribution est déjà ${decision.etat === 'validee' ? 'validée' : 'refusée'}.`, { etat: c.etat });
      const maintenant = new Date();
      // L'ancien verdict de CETTE contribution (une validation d'avant un refus) se retire d'abord : un seul verdict vivant par contribution.
      await tx
        .update(verdict)
        .set({ deletedAt: maintenant })
        .where(and(eq(verdict.produitId, c.produitId), eq(verdict.niveau, 3), isNull(verdict.deletedAt), sql`${verdict.detail}->>'contributionId' = ${c.id}`));
      const [apres] = await tx
        .update(contribution)
        .set(
          decision.etat === 'validee'
            ? { etat: 'validee', valideePar: session.compteId, valideeLe: maintenant, motifRefus: null, updatedAt: maintenant }
            : { etat: 'refusee', valideePar: session.compteId, valideeLe: null, motifRefus: decision.motifRefus, updatedAt: maintenant },
        )
        .where(eq(contribution.id, c.id))
        .returning();
      if (decision.etat === 'validee') {
        await tx.insert(verdict).values({ produitId: c.produitId, ...verdictDeContribution({ id: c.id, statutPropose: c.statutPropose, sourceType: c.sourceType, sourceTexte: c.sourceTexte, sourceDate: c.sourceDate, auteurNom: c.auteurNom }, maintenant) });
      }
      await journaliserSur(tx, session.compteId, decision.etat === 'validee' ? 'contribution.validation' : 'contribution.refus', c.id, { produitId: c.produitId, statutPropose: c.statutPropose, sourceType: c.sourceType, etatAvant: c.etat, motifRefus: decision.motifRefus });
      return apres;
    });
    const [p] = await this.db.select({ id: produit.id, ean: produit.ean, nom: produit.nom, marque: produit.marque }).from(produit).where(eq(produit.id, ligne.produitId)).limit(1);
    return versConsole(ligne, p ?? { id: ligne.produitId, ean: null, nom: '?', marque: null });
  }

  private async lire(id: string): Promise<LigneContribution> {
    const [c] = await this.db
      .select()
      .from(contribution)
      .where(and(eq(contribution.id, id), isNull(contribution.deletedAt)))
      .limit(1);
    if (!c) throw new ErreurMetier(404, 'contribution_inconnue', 'Contribution inconnue.');
    return c;
  }
}

function versPublique(c: LigneContribution): ContributionPublique {
  return { id: c.id, statutPropose: c.statutPropose, sourceType: c.sourceType, sourceTexte: c.sourceTexte, sourceDate: c.sourceDate, preuveUrl: c.preuveUrl, auteurNom: c.auteurNom, valideeLe: (c.valideeLe ?? c.updatedAt).toISOString() };
}

function versConsole(c: LigneContribution, p: { id: string; ean: string | null; nom: string; marque: string | null }): ContributionConsole {
  return {
    id: c.id,
    produit: p,
    niveau: 3,
    statutPropose: c.statutPropose,
    sourceType: c.sourceType,
    sourceTexte: c.sourceTexte,
    sourceDate: c.sourceDate,
    preuveUrl: c.preuveUrl,
    auteurNom: c.auteurNom,
    etat: c.etat,
    valideeLe: c.valideeLe?.toISOString() ?? null,
    motifRefus: c.motifRefus,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}
