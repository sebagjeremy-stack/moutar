-- Le journal d'administration est en AJOUT SEUL : la migration 0000 refuse UPDATE et DELETE ligne par ligne ; celle-ci
-- refuse aussi TRUNCATE (un déclencheur d'instruction). En développement le rôle « moutar » est superutilisateur : la
-- protection tient par les déclencheurs ; un rôle applicatif distinct, non super, sans UPDATE/DELETE/TRUNCATE sur les
-- journaux reste BLOQUANT avant la mise en ligne (docs/fonctionnalites/console-admin.md).
CREATE OR REPLACE FUNCTION journal_admin_ajout_seul() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'journal_admin est en ajout seul (UPDATE, DELETE et TRUNCATE refusés)';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS journal_admin_pas_de_truncate ON "journal_admin";
--> statement-breakpoint
CREATE TRIGGER journal_admin_pas_de_truncate BEFORE TRUNCATE ON "journal_admin" FOR EACH STATEMENT EXECUTE FUNCTION journal_admin_ajout_seul();
