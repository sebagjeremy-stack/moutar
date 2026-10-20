CREATE TYPE "public"."source_produit" AS ENUM('off', 'manuel', 'ocr');--> statement-breakpoint
CREATE TYPE "public"."rite" AS ENUM('casher');--> statement-breakpoint
CREATE TYPE "public"."statut_verdict" AS ENUM('cite', 'non_cite', 'permis', 'non_casher', 'non_verifie', 'perime');--> statement-breakpoint
CREATE TYPE "public"."statut_additif" AS ENUM('casher', 'douteux', 'non_casher', 'inconnu');--> statement-breakpoint
CREATE TYPE "public"."code_liste" AS ENUM('consistoire_paris', 'rav_wolff');--> statement-breakpoint
CREATE TYPE "public"."etat_contribution" AS ENUM('proposee', 'validee', 'refusee');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "produit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ean" text,
	"nom" text NOT NULL,
	"marque" text,
	"image_url" text,
	"ingredients_texte" text,
	"additifs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source" "source_produit" NOT NULL,
	"lu_le" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "produit_ean_unique" UNIQUE("ean")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verdict" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"produit_id" uuid NOT NULL,
	"niveau" integer NOT NULL,
	"rite" "rite" DEFAULT 'casher' NOT NULL,
	"statut" "statut_verdict" NOT NULL,
	"source" text NOT NULL,
	"mention" text,
	"publie_le" timestamp with time zone,
	"valable_jusqu_au" timestamp with time zone,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "additif_surcharge" (
	"code_e" text PRIMARY KEY NOT NULL,
	"rite" "rite" DEFAULT 'casher' NOT NULL,
	"statut" "statut_additif" NOT NULL,
	"source" text NOT NULL,
	"note" text,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "compte_admin" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"mot_de_passe_hash" text NOT NULL,
	"nom" text NOT NULL,
	"actif" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "compte_admin_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "journal_admin" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"compte_id" uuid,
	"action" text NOT NULL,
	"objet" text,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "session_admin" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"compte_id" uuid NOT NULL,
	"jeton_hash" text NOT NULL,
	"expire_le" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoquee_le" timestamp with time zone,
	CONSTRAINT "session_admin_jeton_hash_unique" UNIQUE("jeton_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "certificateur_surcharge" (
	"code" text PRIMARY KEY NOT NULL,
	"actif" boolean DEFAULT true NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contribution" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"produit_id" uuid NOT NULL,
	"niveau" integer NOT NULL,
	"statut_propose" "statut_verdict" NOT NULL,
	"source_texte" text NOT NULL,
	"preuve_url" text,
	"auteur_nom" text NOT NULL,
	"etat" "etat_contribution" DEFAULT 'proposee' NOT NULL,
	"validee_par" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ligne_liste" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"liste_id" uuid NOT NULL,
	"rubrique" text NOT NULL,
	"marque" text,
	"produit_libelle" text,
	"mention" text,
	"toute_marque" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "liste_officielle" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" "code_liste" NOT NULL,
	"titre" text NOT NULL,
	"publie_le" timestamp with time zone,
	"valable_jusqu_au" timestamp with time zone,
	"importe_le" timestamp with time zone DEFAULT now() NOT NULL,
	"fichier_nom" text,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "verdict" ADD CONSTRAINT "verdict_produit_id_produit_id_fk" FOREIGN KEY ("produit_id") REFERENCES "public"."produit"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "journal_admin" ADD CONSTRAINT "journal_admin_compte_id_compte_admin_id_fk" FOREIGN KEY ("compte_id") REFERENCES "public"."compte_admin"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "session_admin" ADD CONSTRAINT "session_admin_compte_id_compte_admin_id_fk" FOREIGN KEY ("compte_id") REFERENCES "public"."compte_admin"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contribution" ADD CONSTRAINT "contribution_produit_id_produit_id_fk" FOREIGN KEY ("produit_id") REFERENCES "public"."produit"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contribution" ADD CONSTRAINT "contribution_validee_par_compte_admin_id_fk" FOREIGN KEY ("validee_par") REFERENCES "public"."compte_admin"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ligne_liste" ADD CONSTRAINT "ligne_liste_liste_id_liste_officielle_id_fk" FOREIGN KEY ("liste_id") REFERENCES "public"."liste_officielle"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "verdict_produit_niveau_idx" ON "verdict" USING btree ("produit_id","niveau");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "journal_admin_created_idx" ON "journal_admin" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_admin_compte_idx" ON "session_admin" USING btree ("compte_id");
--> statement-breakpoint
-- Le journal d'administration est en AJOUT SEUL : aucune mise à jour, aucune suppression, quel que soit le rôle.
CREATE OR REPLACE FUNCTION journal_admin_ajout_seul() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'journal_admin est en ajout seul (UPDATE et DELETE refusés)';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER journal_admin_ajout_seul BEFORE UPDATE OR DELETE ON "journal_admin" FOR EACH ROW EXECUTE FUNCTION journal_admin_ajout_seul();
