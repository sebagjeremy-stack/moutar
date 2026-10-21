import { index, integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { produit } from './produit';

export const actionJournalProduitEnum = pgEnum('action_journal_produit', ['ingredients.ecriture', 'produit.creation']);

/**
 * Journal des écritures PUBLIQUES sur une fiche produit (21/10/2026) : la création manuelle (`produit.creation`) et chaque
 * réécriture des ingrédients (`ingredients.ecriture`, `PUT /produits/:ean/ingredients`). Il ne porte JAMAIS le texte :
 * la source déclarée (`manuel`, `ocr`), la longueur et l'empreinte SHA-256 du texte — de quoi voir qu'une fiche a été
 * réécrite, quand, et retrouver un texte identique. En AJOUT SEUL, comme `journal_ia` (déclencheurs de la migration 0006 ;
 * SELECT et INSERT seulement pour `moutar_app`, `database/droits-application.ts`). Lisible à la console
 * (`GET /admin/journal-produits?page=`).
 */
export const journalProduit = pgTable(
  'journal_produit',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    produitId: uuid('produit_id')
      .notNull()
      .references(() => produit.id),
    action: actionJournalProduitEnum('action').notNull(),
    /** La source déclarée par l'écran (`manuel`, `ocr`) ; jamais un libellé libre. */
    source: text('source').notNull(),
    /** La longueur du texte écrit (0 pour une création sans ingrédients). */
    longueur: integer('longueur').notNull(),
    /** SHA-256 (hexadécimal) du texte écrit — jamais le texte lui-même. */
    empreinte: text('empreinte').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('journal_produit_created_idx').on(t.createdAt), index('journal_produit_produit_idx').on(t.produitId)],
);
