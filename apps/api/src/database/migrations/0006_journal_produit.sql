-- 21/10/2026 : journal des écritures publiques sur une fiche produit (création manuelle, réécriture des ingrédients).
-- Il ne porte jamais le texte : source déclarée, longueur, empreinte SHA-256. La clé étrangère verrouille `produit`
-- (SHARE ROW EXCLUSIVE) : délai de verrou borné, la migration tourne pendant que l'ancienne API sert.
SET LOCAL lock_timeout = '5s';--> statement-breakpoint
CREATE TYPE "public"."action_journal_produit" AS ENUM('ingredients.ecriture', 'produit.creation');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "journal_produit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"produit_id" uuid NOT NULL,
	"action" "action_journal_produit" NOT NULL,
	"source" text NOT NULL,
	"longueur" integer NOT NULL,
	"empreinte" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "journal_produit" ADD CONSTRAINT "journal_produit_produit_id_produit_id_fk" FOREIGN KEY ("produit_id") REFERENCES "public"."produit"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "journal_produit_created_idx" ON "journal_produit" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "journal_produit_produit_idx" ON "journal_produit" USING btree ("produit_id");--> statement-breakpoint
-- En AJOUT SEUL, comme journal_admin et journal_ia : UPDATE, DELETE et TRUNCATE refusés par déclencheur (en plus des
-- droits du rôle applicatif, qui n'y a que SELECT et INSERT : database/droits-application.ts).
CREATE OR REPLACE FUNCTION journal_produit_ajout_seul() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'journal_produit est en ajout seul (UPDATE, DELETE et TRUNCATE refusés)';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER journal_produit_ajout_seul BEFORE UPDATE OR DELETE ON "journal_produit" FOR EACH ROW EXECUTE FUNCTION journal_produit_ajout_seul();
--> statement-breakpoint
CREATE TRIGGER journal_produit_pas_de_truncate BEFORE TRUNCATE ON "journal_produit" FOR EACH STATEMENT EXECUTE FUNCTION journal_produit_ajout_seul();
