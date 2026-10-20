CREATE TYPE "public"."usage_ia" AS ENUM('lecture_logo', 'ocr_ingredients', 'transcription');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "journal_ia" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fournisseur" text NOT NULL,
	"modele" text NOT NULL,
	"usage" "usage_ia" NOT NULL,
	"duree_ms" integer NOT NULL,
	"jetons_entree" integer,
	"jetons_sortie" integer,
	"ok" boolean NOT NULL,
	"erreur" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "journal_ia_created_idx" ON "journal_ia" USING btree ("created_at");--> statement-breakpoint
-- Lot 3 : le journal des appels au moteur d'IA est en AJOUT SEUL, comme journal_admin (UPDATE, DELETE et TRUNCATE
-- refusés par déclencheur). Il ne porte jamais de contenu : fournisseur, modèle, usage, durée, jetons, réussite, code d'erreur.
CREATE OR REPLACE FUNCTION journal_ia_ajout_seul() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'journal_ia est en ajout seul (UPDATE, DELETE et TRUNCATE refusés)';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER journal_ia_ajout_seul BEFORE UPDATE OR DELETE ON "journal_ia" FOR EACH ROW EXECUTE FUNCTION journal_ia_ajout_seul();
--> statement-breakpoint
CREATE TRIGGER journal_ia_pas_de_truncate BEFORE TRUNCATE ON "journal_ia" FOR EACH STATEMENT EXECUTE FUNCTION journal_ia_ajout_seul();
