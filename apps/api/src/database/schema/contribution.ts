import { date, index, integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { compteAdmin } from './admin';
import { produit } from './produit';

/** Ce qu'une contribution propose (niveau 3) : cité par la source, non cité, ou douteux. Jamais « non cacher ». */
export const statutContributionEnum = pgEnum('statut_contribution', ['cite', 'non_cite', 'douteux']);
/** La source citée : Les Bons Plans Cachères (groupe Facebook, site), ou une autre source communautaire. */
export const sourceContributionEnum = pgEnum('source_contribution', ['lbpc', 'autre']);
export const etatContributionEnum = pgEnum('etat_contribution', ['proposee', 'validee', 'refusee']);
export const etatSignalementEnum = pgEnum('etat_signalement', ['ouvert', 'traite']);

/**
 * Lot 5 : une contribution communautaire (niveau 3), sourcée (ce que dit la source, sa date, une preuve en lien https
 * vers un hôte admis), signée d'un pseudonyme facultatif, validée ou refusée à la console. AUCUNE donnée personnelle :
 * ni e-mail, ni adresse IP (l'adresse ne sert qu'à la limite de débit, en mémoire). Soft-delete.
 */
export const contribution = pgTable(
  'contribution',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    produitId: uuid('produit_id')
      .notNull()
      .references(() => produit.id),
    /** 3 en v1 (le seul niveau qu'une contribution fonde). */
    niveau: integer('niveau').notNull().default(3),
    statutPropose: statutContributionEnum('statut_propose').notNull(),
    sourceType: sourceContributionEnum('source_type').notNull().default('lbpc'),
    /** Ce que dit la source, en texte brut (≤ 1 000 caractères, balises retirées à l'écriture). */
    sourceTexte: text('source_texte').notNull(),
    /** Le jour de la publication citée (`AAAA-MM-JJ`), ou null. */
    sourceDate: date('source_date', { mode: 'string' }),
    /** Un lien https vers un hôte de `CONTRIBUTION_HOTES_PREUVE`, ou null. */
    preuveUrl: text('preuve_url'),
    /** Un pseudonyme (≤ 40), ou null. */
    auteurNom: text('auteur_nom'),
    etat: etatContributionEnum('etat').notNull().default('proposee'),
    valideePar: uuid('validee_par').references(() => compteAdmin.id),
    valideeLe: timestamp('validee_le', { withTimezone: true }),
    motifRefus: text('motif_refus'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('contribution_produit_etat_idx').on(t.produitId, t.etat)],
);

/** Lot 5 : « Signaler une erreur » sur une ligne de la carte (niveau 1-4), lu et traité à la console. Aucune donnée personnelle. */
export const signalement = pgTable(
  'signalement',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    produitId: uuid('produit_id')
      .notNull()
      .references(() => produit.id),
    niveau: integer('niveau').notNull(),
    texte: text('texte').notNull(),
    etat: etatSignalementEnum('etat').notNull().default('ouvert'),
    traiteLe: timestamp('traite_le', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('signalement_etat_idx').on(t.etat, t.createdAt)],
);
