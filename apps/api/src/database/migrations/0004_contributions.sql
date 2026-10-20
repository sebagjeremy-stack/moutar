-- Lot 5 : contributions communautaires (niveau 3) et signalements. La table `contribution`, réservée et VIDE depuis le
-- lot 1, change de forme : statut proposé en énumération propre (cité / non cité / douteux, jamais « non cacher »), source
-- typée et datée, pseudonyme facultatif, motif de refus, dates. Aucune donnée personnelle (ni e-mail, ni adresse IP).
SET LOCAL lock_timeout = '5s';--> statement-breakpoint
CREATE TYPE "public"."etat_signalement" AS ENUM('ouvert', 'traite');--> statement-breakpoint
CREATE TYPE "public"."source_contribution" AS ENUM('lbpc', 'autre');--> statement-breakpoint
CREATE TYPE "public"."statut_contribution" AS ENUM('cite', 'non_cite', 'douteux');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "signalement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"produit_id" uuid NOT NULL,
	"niveau" integer NOT NULL,
	"texte" text NOT NULL,
	"etat" "etat_signalement" DEFAULT 'ouvert' NOT NULL,
	"traite_le" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contribution" ALTER COLUMN "niveau" SET DEFAULT 3;--> statement-breakpoint
ALTER TABLE "contribution" ALTER COLUMN "statut_propose" SET DATA TYPE statut_contribution USING "statut_propose"::text::statut_contribution;--> statement-breakpoint
ALTER TABLE "contribution" ALTER COLUMN "auteur_nom" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "contribution" ADD COLUMN "source_type" "source_contribution" DEFAULT 'lbpc' NOT NULL;--> statement-breakpoint
ALTER TABLE "contribution" ADD COLUMN "source_date" date;--> statement-breakpoint
ALTER TABLE "contribution" ADD COLUMN "validee_le" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "contribution" ADD COLUMN "motif_refus" text;--> statement-breakpoint
ALTER TABLE "contribution" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "signalement" ADD CONSTRAINT "signalement_produit_id_produit_id_fk" FOREIGN KEY ("produit_id") REFERENCES "public"."produit"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "signalement_etat_idx" ON "signalement" USING btree ("etat","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contribution_produit_etat_idx" ON "contribution" USING btree ("produit_id","etat");