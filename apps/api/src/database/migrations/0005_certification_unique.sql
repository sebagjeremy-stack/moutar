-- Lot 3 (relecture) : UN verdict de niveau 1 VIVANT par produit. Les doublons éventuels (deux validations d'un clic qui se
-- sont croisées avant le verrou) sont d'abord retirés en douceur — on garde le plus récent —, puis l'index unique partiel
-- garantit la règle que le service tient par ailleurs sous `pg_advisory_xact_lock(hashtext('produit:<id>'))`.
-- La migration verrouille la table : délai de verrou borné (elle tourne pendant que l'ancienne API sert).
SET LOCAL lock_timeout = '5s';--> statement-breakpoint
UPDATE "verdict" v SET "deleted_at" = now()
WHERE v."niveau" = 1 AND v."deleted_at" IS NULL
  AND EXISTS (
    SELECT 1 FROM "verdict" r
    WHERE r."produit_id" = v."produit_id" AND r."niveau" = 1 AND r."deleted_at" IS NULL
      AND (r."created_at" > v."created_at" OR (r."created_at" = v."created_at" AND r."id" > v."id"))
  );--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "verdict_niveau1_vivant_uidx" ON "verdict" USING btree ("produit_id") WHERE "verdict"."niveau" = 1 and "verdict"."deleted_at" is null;
