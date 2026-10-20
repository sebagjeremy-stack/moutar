import { sql } from 'drizzle-orm';
import { boolean, date, index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

export const codeListeEnum = pgEnum('code_liste', ['consistoire_paris', 'rav_wolff']);

/**
 * Lot 2 : une édition importée d'une liste officielle (Consistoire de Paris, Rav Wolff). Les dates de publication et de
 * validité sont des JOURS (colonnes `date`, lues en chaîne `AAAA-MM-JJ`) : aucun fuseau n'entre en jeu. Une seule liste
 * ACTIVE par code (index unique partiel) : l'import d'une édition neuve désactive l'ancienne, qui reste lisible.
 */
export const listeOfficielle = pgTable(
  'liste_officielle',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: codeListeEnum('code').notNull(),
    titre: text('titre').notNull(),
    publieLe: date('publie_le', { mode: 'string' }),
    valableJusquAu: date('valable_jusqu_au', { mode: 'string' }),
    importeLe: timestamp('importe_le', { withTimezone: true }).notNull().defaultNow(),
    fichierNom: text('fichier_nom'),
    /** La note d'introduction de la source (avis indulgents, réserves), lue ou corrigée à la console. */
    noteSource: text('note_source'),
    active: boolean('active').notNull().default(true),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [uniqueIndex('liste_officielle_active_par_code_idx').on(t.code).where(sql`${t.active} = true AND ${t.deletedAt} IS NULL`)],
);

/**
 * Une ligne d'une liste : rubrique ; marque et/ou produit nommés, ou aucun (`toute_marque`). Les colonnes `*_norm` portent
 * le texte normalisé par la règle partagée (`regles/normalisation.ts` : minuscules, sans accent, mots séparés d'une espace)
 * et servent à la recherche (index trigram). `rubrique_reservee` : famille toujours sous surveillance, jamais « toute marque ».
 */
export const ligneListe = pgTable(
  'ligne_liste',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    listeId: uuid('liste_id')
      .notNull()
      .references(() => listeOfficielle.id),
    rubrique: text('rubrique').notNull(),
    marque: text('marque'),
    produitLibelle: text('produit_libelle'),
    /** `lait_non_surveille`, ou un texte libre. */
    mention: text('mention'),
    touteMarque: boolean('toute_marque').notNull().default(false),
    rubriqueReservee: boolean('rubrique_reservee').notNull().default(false),
    ordre: integer('ordre').notNull().default(0),
    rubriqueNorm: text('rubrique_norm').notNull().default(''),
    marqueNorm: text('marque_norm').notNull().default(''),
    produitNorm: text('produit_norm').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('ligne_liste_liste_marque_idx').on(t.listeId, t.marqueNorm),
    index('ligne_liste_liste_ordre_idx').on(t.listeId, t.ordre),
    index('ligne_liste_marque_trgm_idx').using('gin', t.marqueNorm.op('gin_trgm_ops')),
    index('ligne_liste_produit_trgm_idx').using('gin', t.produitNorm.op('gin_trgm_ops')),
    index('ligne_liste_rubrique_trgm_idx').using('gin', t.rubriqueNorm.op('gin_trgm_ops')),
  ],
);
