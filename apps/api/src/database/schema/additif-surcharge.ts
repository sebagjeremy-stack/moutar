import { pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { riteEnum } from './verdict';

export const statutAdditifEnum = pgEnum('statut_additif', ['casher', 'douteux', 'non_casher', 'inconnu']);

/** Surcharge de console du catalogue d'additifs EN CODE : le médecin confirme ou corrige une ligne, avec sa source. */
export const additifSurcharge = pgTable('additif_surcharge', {
  codeE: text('code_e').primaryKey(),
  rite: riteEnum('rite').notNull().default('casher'),
  statut: statutAdditifEnum('statut').notNull(),
  source: text('source').notNull(),
  note: text('note'),
  updatedBy: uuid('updated_by'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
