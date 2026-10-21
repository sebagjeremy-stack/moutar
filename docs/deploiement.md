# Hébergement et migrations — règles de déploiement (court)

Moutar ne porte aucune donnée de santé ni d'identité (cadrage § 8.4) : pas d'hébergement HDS. Un PostgreSQL managé ou une
machine en Union européenne suffit. Ce qui suit vaut pour TOUTE migration et tout rôle de base, quel que soit l'hébergeur.

## État (21/10/2026)
- **Écrit, relu, jamais déployé** : `deploy/` (compose à quatre services `db` / `migrate` / `api` / `web`, deux Dockerfiles,
  `Caddyfile`, `env.prod.example`, `scripts/deployer.sh`, `scripts/sauvegarde.sh`) et le runbook `deploy/README.md`.
  `docker compose config -q` accepte la composition avec l'exemple d'environnement ; les images n'ont pas été construites
  (pas de Docker dans la session qui les a écrites) ; `caddy validate` tourne à la construction de l'image web.
- **Rôle applicatif posé et éprouvé sur la base locale** (voir « Rôles PostgreSQL ») : le reste bloquant de
  `console-admin.md` est levé côté code ; en production, il le sera au premier passage de `migrate`.

## Check-list avant la première mise en ligne
1. Nom de domaine choisi, enregistrement `A` (et `AAAA`) vers le VPS ; `ACME_EMAIL` décidé.
2. VPS OVH installé (Docker + Compose v2, rsync, pare-feu 22/80/443, SSH par clé) — `deploy/README.md`, « Prérequis ».
3. `/srv/moutar/.env.prod` copié de `deploy/env.prod.example` et rempli (`POSTGRES_PASSWORD` tiré au hasard,
   `IA_API_KEY` de OVHcloud AI Endpoints — ou `IA_BASE_URL` vidée —, `ADMIN_EMAIL_INITIAL`), mode 600.
4. Images de base épinglées par leur empreinte (`deploy/README.md`, « Images de base ») — depuis un poste qui atteint le registre.
5. `bash deploy/scripts/deployer.sh <hôte>` : `migrate` joue les migrations puis `db:droits` ; vérifier en SQL que
   `moutar_app` n'est pas superutilisateur et n'a que SELECT/INSERT sur les journaux (requête dans le runbook).
6. Compte admin créé par la graine (`seed-admin.ts` dans le conteneur `migrate`), mot de passe rangé.
7. Sauvegarde en cron (03:15) ; décider la copie hors du serveur.
8. Essai depuis le téléphone : scan d'un code-barres, carte produit, installation de la PWA, connexion à `/admin`.

## Migrations (Drizzle, `apps/api/src/database/migrations`)
- Une migration tourne pendant que l'ancienne API sert encore : toute migration qui VERROUILLE une table (`ALTER TABLE`,
  index, `DROP`) commence par `SET LOCAL lock_timeout = '5s';` (10 s au plus), et par `SET LOCAL statement_timeout = '…'`
  si elle RÉÉCRIT la table (remplissage de colonne, `UPDATE` de masse). Un échec sur le délai se rejoue à une heure creuse ;
  il ne bloque jamais le service.
- Une transaction par migration ; une valeur nouvelle d'énumération se pose dans une migration et ne s'UTILISE que dans la
  suivante.
- La session de migration pose `SET TIME ZONE 'Europe/Paris'` (les colonnes `date` des listes sont des jours ; aucun calcul
  de date ne doit dépendre du fuseau du serveur de base).
- `pg_trgm` (recherche par nom, lot 2) est une **extension de confiance** : `CREATE EXTENSION IF NOT EXISTS pg_trgm`
  demande le droit `CREATE` sur la base au rôle qui migre, pas le superutilisateur. Sur un PostgreSQL managé, vérifier que
  l'extension est dans la liste autorisée du fournisseur avant la première migration.
- Les migrations se jouent avec le rôle PROPRIÉTAIRE des tables (`chaineMigrations`), jamais avec le rôle applicatif.

## Rôles PostgreSQL (BLOQUANT avant la mise en ligne — `docs/fonctionnalites/console-admin.md`)
- Un rôle applicatif distinct, NON superutilisateur, sans `CREATE` sur le schéma : l'API ne se connecte qu'avec lui.
- Les journaux (`journal_admin`, `journal_ia`, tout `journal_*`) sont en AJOUT SEUL pour ce rôle : `SELECT` et `INSERT`,
  jamais `UPDATE`, `DELETE` ni `TRUNCATE` (une migration `GRANT`/`REVOKE` le pose ; une relecture critique le vérifie).
- Le retrait d'une donnée est doux (`deleted_at`) : aucun `DELETE` applicatif n'est attendu hors nettoyage planifié.

## Concurrence (rappel pour les écritures de la console)
- Deux écritures concurrentes sur un même objet : `pg_advisory_xact_lock(hashtext('<objet>:<id>'))` dans la transaction,
  l'état relu sous le verrou (listes : `liste:<code>` à l'import et à l'activation ; contributions : `produit:<id>`).
- « Un seul vivant » se garantit en plus par un index unique partiel (`liste_officielle_active_par_code_idx`) ; la violation
  (`23505`) devient un 409 explicite (`import_concurrent`), jamais une 500.
