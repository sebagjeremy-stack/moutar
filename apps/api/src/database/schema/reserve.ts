import { boolean, integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { compteAdmin } from './admin';
import { produit } from './produit';
import { statutVerdictEnum } from './verdict';

/*
 * Tables réservées aux lots suivants, créées vides dès le lot 1 pour figer le modèle (cadrage § 6).
 */

/** Lot 3 : la console peut désactiver un certificateur du catalogue EN CODE. */
export const certificateurSurcharge = pgTable('certificateur_surcharge', {
  code: text('code').primaryKey(),
  actif: boolean('actif').notNull().default(true),
  note: text('note'),
});

export const codeListeEnum = pgEnum('code_liste', ['consistoire_paris', 'rav_wolff']);

/** Lot 2 : une édition importée d'une liste officielle. */
export const listeOfficielle = pgTable('liste_officielle', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: codeListeEnum('code').notNull(),
  titre: text('titre').notNull(),
  publieLe: timestamp('publie_le', { withTimezone: true }),
  valableJusquAu: timestamp('valable_jusqu_au', { withTimezone: true }),
  importeLe: timestamp('importe_le', { withTimezone: true }).notNull().defaultNow(),
  fichierNom: text('fichier_nom'),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

/** Lot 2 : une ligne d'une liste (rubrique ; marque et produit facultatifs ; `toute_marque` = rubrique sans marque nommée). */
export const ligneListe = pgTable('ligne_liste', {
  id: uuid('id').primaryKey().defaultRandom(),
  listeId: uuid('liste_id')
    .notNull()
    .references(() => listeOfficielle.id),
  rubrique: text('rubrique').notNull(),
  marque: text('marque'),
  produitLibelle: text('produit_libelle'),
  mention: text('mention'),
  touteMarque: boolean('toute_marque').notNull().default(false),
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
