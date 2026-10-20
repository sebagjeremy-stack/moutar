import { boolean, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/** Le compte d'administration (console) : e-mail + mot de passe haché (bcrypt 12). Soft-delete. */
export const compteAdmin = pgTable('compte_admin', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  motDePasseHash: text('mot_de_passe_hash').notNull(),
  nom: text('nom').notNull(),
  actif: boolean('actif').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

/** Une session de console : le jeton n'est gardé que HACHÉ (SHA-256) ; 12 h ; révocable. */
export const sessionAdmin = pgTable(
  'session_admin',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    compteId: uuid('compte_id')
      .notNull()
      .references(() => compteAdmin.id),
    jetonHash: text('jeton_hash').notNull().unique(),
    expireLe: timestamp('expire_le', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    revoqueeLe: timestamp('revoquee_le', { withTimezone: true }),
  },
  (t) => [index('session_admin_compte_idx').on(t.compteId)],
);

/** Journal d'administration, en AJOUT SEUL (des déclencheurs SQL refusent UPDATE et DELETE — migration 0000 — et TRUNCATE — migration 0001). */
export const journalAdmin = pgTable(
  'journal_admin',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    compteId: uuid('compte_id').references(() => compteAdmin.id),
    action: text('action').notNull(),
    objet: text('objet'),
    detail: jsonb('detail').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('journal_admin_created_idx').on(t.createdAt)],
);
