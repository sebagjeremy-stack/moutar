import { boolean, integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { compteAdmin } from './admin';
import { produit } from './produit';
import { statutVerdictEnum } from './verdict';

/*
 * Tables réservées aux lots suivants, créées vides dès le lot 1 pour figer le modèle (cadrage § 6). Les listes officielles
 * (lot 2) vivent dans `listes.ts`.
 */

/** Lot 3 : la console peut désactiver un certificateur du catalogue EN CODE. */
export const certificateurSurcharge = pgTable('certificateur_surcharge', {
  code: text('code').primaryKey(),
  actif: boolean('actif').notNull().default(true),
  note: text('note'),
});

export const etatContributionEnum = pgEnum('etat_contribution', ['proposee', 'validee', 'refusee']);

/** Lot 5 : une contribution (niveau 3), sourcée, validée par un modérateur. */
export const contribution = pgTable('contribution', {
  id: uuid('id').primaryKey().defaultRandom(),
  produitId: uuid('produit_id')
    .notNull()
    .references(() => produit.id),
  niveau: integer('niveau').notNull(),
  statutPropose: statutVerdictEnum('statut_propose').notNull(),
  sourceTexte: text('source_texte').notNull(),
  preuveUrl: text('preuve_url'),
  auteurNom: text('auteur_nom').notNull(),
  etat: etatContributionEnum('etat').notNull().default('proposee'),
  valideePar: uuid('validee_par').references(() => compteAdmin.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});
