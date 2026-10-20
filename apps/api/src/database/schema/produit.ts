import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const sourceProduitEnum = pgEnum('source_produit', ['off', 'manuel', 'ocr']);

/** Une fiche produit : lue dans Open Food Facts, créée à la main, ou lue par OCR (lot 3). Soft-delete. */
export const produit = pgTable(
  'produit',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ean: text('ean').unique(),
    nom: text('nom').notNull(),
    marque: text('marque'),
    /** Nom et marque normalisés (`regles/normalisation.ts`) pour la recherche par texte (lot 2) ; tenus à chaque écriture. */
    nomNorm: text('nom_norm').notNull().default(''),
    marqueNorm: text('marque_norm').notNull().default(''),
    imageUrl: text('image_url'),
    ingredientsTexte: text('ingredients_texte'),
    /** Codes E lus dans la fiche source (`additives_tags` normalisés). */
    additifs: jsonb('additifs').$type<string[]>().notNull().default([]),
    source: sourceProduitEnum('source').notNull(),
    luLe: timestamp('lu_le', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('produit_nom_trgm_idx').using('gin', t.nomNorm.op('gin_trgm_ops')), index('produit_marque_trgm_idx').using('gin', t.marqueNorm.op('gin_trgm_ops'))],
);
