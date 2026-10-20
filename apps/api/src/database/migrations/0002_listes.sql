-- Lot 2 : listes officielles. pg_trgm (extension de confiance depuis PostgreSQL 13 : aucun superutilisateur requis) porte
-- les index trigram de la recherche par nom et marque sur les colonnes normalisées. La normalisation est APPLICATIVE
-- (`packages/shared-types/src/regles/normalisation.ts`), une seule règle pour l'API et l'écran : `unaccent` n'est pas utilisé.
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
ALTER TABLE "liste_officielle" ALTER COLUMN "publie_le" SET DATA TYPE date;--> statement-breakpoint
ALTER TABLE "liste_officielle" ALTER COLUMN "valable_jusqu_au" SET DATA TYPE date;--> statement-breakpoint
ALTER TABLE "produit" ADD COLUMN "nom_norm" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "produit" ADD COLUMN "marque_norm" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "ligne_liste" ADD COLUMN "rubrique_reservee" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ligne_liste" ADD COLUMN "ordre" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ligne_liste" ADD COLUMN "rubrique_norm" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "ligne_liste" ADD COLUMN "marque_norm" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "ligne_liste" ADD COLUMN "produit_norm" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "ligne_liste" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "ligne_liste" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "ligne_liste" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "liste_officielle" ADD COLUMN "note_source" text;--> statement-breakpoint
ALTER TABLE "liste_officielle" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "produit_nom_trgm_idx" ON "produit" USING gin ("nom_norm" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "produit_marque_trgm_idx" ON "produit" USING gin ("marque_norm" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ligne_liste_liste_marque_idx" ON "ligne_liste" USING btree ("liste_id","marque_norm");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ligne_liste_liste_ordre_idx" ON "ligne_liste" USING btree ("liste_id","ordre");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ligne_liste_marque_trgm_idx" ON "ligne_liste" USING gin ("marque_norm" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ligne_liste_produit_trgm_idx" ON "ligne_liste" USING gin ("produit_norm" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ligne_liste_rubrique_trgm_idx" ON "ligne_liste" USING gin ("rubrique_norm" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "liste_officielle_active_par_code_idx" ON "liste_officielle" USING btree ("code") WHERE "liste_officielle"."active" = true AND "liste_officielle"."deleted_at" IS NULL;--> statement-breakpoint
-- Remplissage des colonnes normalisées des produits déjà lus (approximation SQL de la règle applicative : minuscules,
-- accents courants, ponctuation en espace) ; toute écriture suivante les retient par le code.
UPDATE "produit" SET
  "nom_norm" = btrim(regexp_replace(lower(translate("nom", 'ÀÂÄÉÈÊËÎÏÔÖÙÛÜÇàâäéèêëîïôöùûüç', 'AAAEEEEIIOOUUUCaaaeeeeiioouuuc')), '[^a-z0-9]+', ' ', 'g')),
  "marque_norm" = btrim(regexp_replace(lower(translate(coalesce("marque", ''), 'ÀÂÄÉÈÊËÎÏÔÖÙÛÜÇàâäéèêëîïôöùûüç', 'AAAEEEEIIOOUUUCaaaeeeeiioouuuc')), '[^a-z0-9]+', ' ', 'g'));
