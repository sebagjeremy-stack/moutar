import { boolean, index, integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const usageIaEnum = pgEnum('usage_ia', ['lecture_logo', 'ocr_ingredients', 'transcription']);

/**
 * Journal des appels au moteur d'IA (lot 3) : fournisseur, modèle, usage, durée, jetons si connus, réussite et code
 * d'erreur — JAMAIS le contenu (ni l'image, ni la consigne, ni la réponse). En AJOUT SEUL, comme `journal_admin`
 * (déclencheurs de la migration 0003 : UPDATE, DELETE et TRUNCATE refusés).
 */
export const journalIa = pgTable(
  'journal_ia',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fournisseur: text('fournisseur').notNull(),
    modele: text('modele').notNull(),
    usage: usageIaEnum('usage').notNull(),
    dureeMs: integer('duree_ms').notNull(),
    jetonsEntree: integer('jetons_entree'),
    jetonsSortie: integer('jetons_sortie'),
    ok: boolean('ok').notNull(),
    /** Un code stable de `CodeErreurIa` (`moteur_indisponible` — réseau, 5xx ou délai —, `moteur_sature`, `reponse_illisible`, `lecture_refusee`, `non_supporte`), jamais un message du moteur. */
    erreur: text('erreur'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('journal_ia_created_idx').on(t.createdAt)],
);
