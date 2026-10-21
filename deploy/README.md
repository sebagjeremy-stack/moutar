# Mise en ligne de Moutar — runbook

> **Pas à pas pour le médecin-utilisateur** (commander le VPS, le DNS, SSH, Docker, `.env.prod`, le déploiement, le
> compte admin, le téléphone, la sauvegarde, les pannes probables) : **`deploy/PAS-A-PAS.md`**. Cette page est le runbook
> technique de référence.

État au 21/10/2026 : **fichiers écrits et relus, jamais encore déployés** (Docker n'est pas disponible dans la session qui
les a écrits : `docker compose config` a validé la composition, les images n'ont pas été construites). Ce qui reste à
décider : le **nom de domaine** et le **VPS** (voir « À décider » en bas). Aucune donnée de santé ni d'identité dans
Moutar (`docs/cadrage.md` § 8) : pas d'hébergement HDS, un VPS en Union européenne suffit.

## Architecture (une machine, quatre conteneurs)

```
téléphone ──HTTPS──▶ web (Caddy : certificats Let's Encrypt, fichiers de la PWA, /api/* ──▶ api:3100)
                                                                      api (NestJS, rôle PostgreSQL « moutar_app »)
                                                                      db  (PostgreSQL 16, volume /srv/moutar/pgdata)
                     migrate (one-shot : migrations Drizzle puis db:droits, rôle propriétaire « moutar », puis s'arrête)
```

- `deploy/docker-compose.yml` : les services, le réseau interne (seule `web` publie 80/443), les plafonds, les sondes de
  santé, `restart: unless-stopped`.
- `deploy/api.Dockerfile` (multi-étapes : `pnpm install`, `nest build`, dépendances de production seules, utilisateur
  10001, `TZ=Europe/Paris`, `CMD node --require tsx/cjs dist/main.js` — l'API lit le TypeScript de `packages/shared-types`
  à l'exécution, comme `nest start` par l'`exec` de `nest-cli.json`).
- `deploy/web.Dockerfile` : build Vite (PWA) puis Caddy ; le `Caddyfile` se valide à la construction.
- `deploy/Caddyfile` : site `{$DOMAINE}`, HTTPS automatique, en-têtes de sécurité et CSP, `/api/*` → `api:3100`, le reste
  en statique avec repli `index.html` (routes React), journal sans chaîne de requête ni Referer.
- Sur le serveur : `/srv/moutar/.env.prod` (secrets, mode 600), `/srv/moutar/app` (le code copié), `/srv/moutar/pgdata`
  (la base), `/srv/moutar/sauvegardes` (les dumps).

## Prérequis

- **VPS OVH** (ou équivalent, UE) : Debian 12 ou Ubuntu 24.04, 2 vCPU / 4 Go suffisent largement ; Docker Engine + plugin
  Compose v2 (`apt install docker-ce docker-ce-cli containerd.io docker-compose-plugin` depuis le dépôt Docker, ou le
  script officiel) ; `rsync`, `curl`, `openssl` ; un pare-feu qui n'ouvre que 22, 80 et 443 (`ufw allow 22,80,443/tcp`,
  `ufw allow 443/udp`, `ufw enable`) ; connexion SSH par clé, mot de passe désactivé.
- **DNS** : un enregistrement `A` (et `AAAA` si le VPS a une IPv6) du domaine choisi vers l'IP du VPS, posé AVANT la première
  mise en ligne (Let's Encrypt vérifie par HTTP-01 sur le port 80).
- **Sur le poste** : `git`, `rsync`, `ssh`, `curl` ; le dépôt à jour, typecheck et tests verts.
- **Clé OVHcloud AI Endpoints** (`IA_API_KEY`) : obligatoire en production dès que `IA_BASE_URL` est posée ; sans elle,
  vider `IA_BASE_URL` (les routes d'IA répondent alors 503 `moteur_non_configure`, le reste fonctionne).

## Première mise en ligne

1. Sur le serveur : `mkdir -p /srv/moutar && chmod 700 /srv/moutar`, puis copier `deploy/env.prod.example` en
   `/srv/moutar/.env.prod`, le remplir (`DOMAINE`, `ACME_EMAIL`, `POSTGRES_PASSWORD` = `openssl rand -hex 24`, `IA_API_KEY`,
   `ADMIN_EMAIL_INITIAL`), `chmod 600 /srv/moutar/.env.prod`. `MOUTAR_APP_PASSWORD` se tire tout seul au premier
   déploiement (ajouté au fichier, jamais affiché).
2. Depuis le poste : `bash deploy/scripts/deployer.sh <ip-ou-nom-du-vps>` (variables facultatives :
   `MOUTAR_SSH_UTILISATEUR`, `MOUTAR_DIR`, `MOUTAR_CLE_SSH`). Le script copie le code, contrôle le compose, construit les
   images, démarre `db` → `migrate` (migrations puis `db:droits`) → `api` → `web`, et attend `https://<domaine>/api/v1/health`.
3. Le compte de la console (mot de passe aléatoire, affiché UNE fois, à mettre dans un gestionnaire de mots de passe) :
   ```sh
   cd /srv/moutar/app/deploy && docker compose --env-file /srv/moutar/.env.prod run --rm migrate ./node_modules/.bin/tsx src/database/seed-admin.ts
   ```
4. Vérifier le rôle applicatif (voir « Rôle applicatif ») et poser la sauvegarde en cron (voir « Sauvegarde »).
5. Depuis le téléphone : ouvrir `https://<domaine>`, scanner un code-barres, « Ajouter à l'écran d'accueil » (PWA),
   puis `/admin` avec le compte créé.

## Mise à jour

`bash deploy/scripts/deployer.sh <hôte>` — idempotent : sauvegarde de la base, images reconstruites (les précédentes
gardées sous l'étiquette `precedente`), migrations et droits rejoués, API relancée, santé vérifiée. Quelques secondes
d'indisponibilité de l'API au redémarrage du conteneur ; un téléphone qui a la PWA ouverte reçoit la nouvelle version au
prochain chargement (le service worker se revalide à chaque fois).

## Sauvegarde et restauration

- `deploy/scripts/sauvegarde.sh` (sur le serveur) : `pg_dump --format=custom --no-acl --no-owner` dans
  `/srv/moutar/sauvegardes/moutar-<date>.dump`, relu avant d'être compté, rotation 14 jours. Cron :
  ```
  15 3 * * * MOUTAR_DIR=/srv/moutar bash /srv/moutar/app/deploy/scripts/sauvegarde.sh >> /srv/moutar/sauvegarde.log 2>&1
  ```
  `deployer.sh` l'appelle aussi avant chaque migration. **À décider** : une copie hors du serveur (rclone vers un Object
  Storage OVH, ou un `scp` quotidien vers le poste) — tant qu'elle n'existe pas, la perte du VPS est la perte des listes
  importées et des contributions.
- Restauration (base arrêtée pour l'API) :
  ```sh
  cd /srv/moutar/app/deploy
  C="docker compose --env-file /srv/moutar/.env.prod"
  $C stop api web
  $C exec -T db pg_restore -U moutar -d moutar --clean --if-exists --no-acl --no-owner < /srv/moutar/sauvegardes/moutar-<date>.dump
  $C run --rm migrate          # rejoue les migrations manquantes et REPOSE les droits de moutar_app (le dump n'en porte pas)
  $C up -d
  ```
- Restauration sur une machine neuve : installer, poser `.env.prod` (les mêmes `POSTGRES_PASSWORD` / `MOUTAR_APP_PASSWORD`
  ne sont pas nécessaires : le propriétaire est recréé par l'image, le rôle applicatif par `migrate`), déployer, puis
  restaurer comme ci-dessus.

## Rôle applicatif de la base (`moutar_app`)

L'API ne se connecte jamais avec le propriétaire : `migrate` tourne avec `moutar` (`DATABASE_URL_MIGRATIONS`), l'API avec
`moutar_app` (`DATABASE_URL`), que `db:droits` (`apps/api/src/database/droits-application.ts`) crée et dote de :
SELECT/INSERT/UPDATE/DELETE sur les tables, **SELECT et INSERT seulement sur `journal_admin`, `journal_ia` et tout
`journal_*`**, USAGE sur les séquences, rien sur le schéma `drizzle`, pas de CREATE sur `public`, privilèges par défaut
pour les tables futures. En production, l'API refuse de démarrer si `DATABASE_URL` porte le propriétaire
(`refusRoleProprietaire`) ou si son rôle est superutilisateur (`verifierRoleApplicatif`, relu en base). Vérifier :
```sh
docker compose --env-file /srv/moutar/.env.prod exec -T db psql -U moutar -d moutar -c "select rolname, rolsuper from pg_roles where rolname='moutar_app'" \
  -c "select table_name, string_agg(privilege_type, ',') from information_schema.role_table_grants where grantee='moutar_app' group by 1 order by 1"
```
Rotation du mot de passe de `moutar_app` : changer `MOUTAR_APP_PASSWORD` dans `.env.prod`, puis redéployer (`migrate` le
remet, l'API redémarre avec).

## Compte admin : rotation du mot de passe

La console ne sait pas encore changer un mot de passe (`docs/fonctionnalites/console-admin.md`, « Reste »). En attendant,
sur le serveur, sans que le mot de passe passe par la ligne de commande ni le journal :
```sh
cd /srv/moutar/app/deploy
read -rs -p "Nouveau mot de passe : " MDP; echo
HASH=$(docker compose --env-file /srv/moutar/.env.prod run --rm -e MDP="$MDP" migrate node -e "console.log(require('bcryptjs').hashSync(process.env.MDP, 12))" | tail -1)
docker compose --env-file /srv/moutar/.env.prod exec -T db psql -U moutar -d moutar -c "update compte_admin set mot_de_passe_hash = '$HASH' where email = '<email>'" -c "update session_admin set revoquee_le = now() where revoquee_le is null"
unset MDP HASH
```

## Journaux

- `docker compose --env-file /srv/moutar/.env.prod logs -f api` (ou `web`, `db`, `migrate`) ; bornés par le compose
  (5 × 20 Mo par service). Le journal de Caddy ne porte ni chaîne de requête ni Referer.
- Les journaux de l'application (`journal_admin`, `journal_ia`) sont dans la base, en ajout seul, lisibles à la console.

## Retour arrière

- Images : les précédentes sont gardées sous `moutar-api:precedente` et `moutar-web:precedente`. Pour y revenir sans
  rebuild : `docker tag moutar-api:precedente moutar-api:latest && docker tag moutar-web:precedente moutar-web:latest`, puis
  `docker compose --env-file /srv/moutar/.env.prod up -d --no-build api web`. Une migration déjà appliquée ne se défait pas
  seule : si elle est incompatible avec l'ancien code, restaurer la sauvegarde prise juste avant (voir ci-dessus).
- Code : redéployer le SHA précédent (`git checkout <sha>` sur le poste, puis `deployer.sh`).

## Images de base

`node:22-alpine`, `caddy:2-alpine`, `postgres:16-alpine` sont référencées par étiquette. À la première mise en ligne,
depuis un poste qui atteint le registre, les épingler par leur empreinte (`docker buildx imagetools inspect node:22-alpine`
→ `image@sha256:…`) dans les deux Dockerfiles et le compose, pour que la même image serve à chaque construction.

## À décider (avec le pilote)

- Le nom de domaine (et qui le détient), l'adresse `ACME_EMAIL`.
- Le VPS (OVH : gamme, région, IPv6), et son durcissement (fail2ban, mises à jour automatiques).
- La copie des sauvegardes hors du serveur.
- Caddy sous un utilisateur non root dans son conteneur (Kora le fait ; ici, rien de privé derrière Caddy).
