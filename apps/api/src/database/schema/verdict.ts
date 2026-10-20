import { sql } from 'drizzle-orm';
import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { produit } from './produit';

export const riteEnum = pgEnum('rite', ['casher']);
export const statutVerdictEnum = pgEnum('statut_verdict', ['cite', 'non_cite', 'permis', 'non_casher', 'non_verifie', 'perime']);

/**
 * Ce qu'une source dit d'un produit, à un niveau donné. Le lot 1 n'écrit que le niveau 4 ; le lot 3 le niveau 1 (UN verdict
 * vivant par produit, tenu par l'index unique partiel `verdict_niveau1_vivant_uidx`, migration 0005) ; le lot 5 le niveau 3.
 */
export const verdict = pgTable(
  'verdict',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    produitId: uuid('produit_id')
      .notNull()
      .references(() => produit.id),
    niveau: integer('niveau').notNull(),
    rite: riteEnum('rite').notNull().default('casher'),
    statut: statutVerdictEnum('statut').notNull(),
    source: text('source').notNull(),
    mention: text('mention'),
    publieLe: timestamp('publie_le', { withTimezone: true }),
    valableJusquAu: timestamp('valable_jusqu_au', { withTimezone: true }),
    detail: jsonb('detail').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('verdict_produit_niveau_idx').on(t.produitId, t.niveau), uniqueIndex('verdict_niveau1_vivant_uidx').on(t.produitId).where(sql`${t.niveau} = 1 and ${t.deletedAt} is null`)],
);
