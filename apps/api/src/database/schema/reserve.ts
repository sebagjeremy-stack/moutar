import { boolean, pgTable, text } from 'drizzle-orm/pg-core';

/*
 * Tables réservées aux lots suivants, créées vides dès le lot 1 pour figer le modèle (cadrage § 6). Les listes officielles
 * (lot 2) vivent dans `listes.ts`, les contributions et les signalements (lot 5) dans `contribution.ts`.
 */

/** Lot 3 : la console peut désactiver un certificateur du catalogue EN CODE. */
export const certificateurSurcharge = pgTable('certificateur_surcharge', {
  code: text('code').primaryKey(),
  actif: boolean('actif').notNull().default(true),
  note: text('note'),
});
