# Mettre Moutar en ligne, pas à pas

Cette page s'adresse au médecin-utilisateur, sans connaissance d'informatique serveur. Chaque étape dit **où** taper
(sur le Mac, ou sur le serveur), **quoi** copier (les commandes, telles quelles), et **ce qu'on doit voir** à la fin.
Comptez une heure la première fois ; les mises à jour suivantes prennent cinq minutes (étape 8 seule).

Ce qu'on construit : un petit serveur loué chez OVH (un « VPS »), un nom de domaine qui pointe dessus, et Moutar qui y
tourne derrière HTTPS. Moutar ne contient aucune donnée de santé ni d'identité (`docs/cadrage.md` § 8) : un VPS
ordinaire en Union européenne suffit. Le détail technique est dans `deploy/README.md` (le runbook) ; cette page en est
la version guidée.

> Convention : une ligne qui commence par `$` se tape **sur le Mac** (application Terminal) ; une ligne qui commence par
> `#` se tape **sur le serveur**, une fois connecté en SSH (étape 3). Ne recopiez pas le `$` ni le `#`.
> Remplacez ce qui est entre chevrons : `<IP>` par l'adresse du serveur, `<domaine>` par votre nom de domaine.

## 1. Commander le VPS chez OVH (10 min)

1. Sur https://www.ovhcloud.com/fr/vps/ : choisissez la gamme **VPS « Essential » ou équivalent, 2 vCPU / 4 Go de
   RAM / 80 Go de disque** (Moutar en utilise une fraction ; 2 Go suffisent, 4 Go laissent de la marge aux sauvegardes).
2. Système : **Debian 12** (ou Ubuntu 24.04). Localisation : **France (Gravelines, Roubaix ou Strasbourg)**.
3. À la fin de la commande, OVH envoie un e-mail avec **l'adresse IP** du serveur et **le mot de passe root**. Gardez-les
   dans votre gestionnaire de mots de passe. L'IP ressemble à `57.128.xxx.xxx` : c'est `<IP>` dans tout ce qui suit.

## 2. Choisir le nom de domaine et poser le DNS (10 min, puis attendre)

1. Choisissez un nom (par exemple `moutar.fr`, ou un sous-domaine d'un nom que vous avez déjà : `moutar.mon-nom.fr`).
   Commandez-le chez OVH (rubrique « Noms de domaine ») ou chez votre registrar habituel.
2. Dans la zone DNS du domaine, ajoutez **un enregistrement de type `A`** : nom = `moutar` (ou `@` si le domaine entier
   sert à Moutar), cible = `<IP>`, TTL par défaut. Si OVH vous a donné une adresse IPv6, ajoutez aussi un `AAAA` vers elle.
3. Attendez quelques minutes (parfois une heure), puis vérifiez depuis le Mac :
   ```
   $ dig +short <domaine>
   ```
   On doit voir **exactement** `<IP>`. Tant que la ligne est vide ou montre une autre adresse, n'allez pas plus loin :
   le certificat HTTPS (étape 8) ne peut pas être obtenu sans ce DNS.

## 3. Première connexion SSH et création de votre clé (10 min)

1. Sur le Mac, ouvrez **Terminal** (Applications › Utilitaires). Créez votre clé SSH si vous n'en avez pas
   (`ls ~/.ssh/id_ed25519.pub` dit « No such file » quand elle manque) :
   ```
   $ ssh-keygen -t ed25519 -C "moutar" -f ~/.ssh/id_ed25519
   ```
   Appuyez sur Entrée aux questions (une phrase de passe est facultative ; si vous en mettez une, le Mac la demandera).
2. Copiez la clé sur le serveur (le mot de passe root de l'e-mail OVH est demandé **une fois**) :
   ```
   $ ssh-copy-id root@<IP>
   ```
3. Connectez-vous : plus de mot de passe demandé, l'invite devient `root@vps-…:~#`.
   ```
   $ ssh root@<IP>
   ```
4. Sur le serveur, mettez-le à jour et désactivez la connexion par mot de passe (seule votre clé ouvre la porte) :
   ```
   # apt update && apt -y upgrade
   # sed -i 's/^#\?PasswordAuthentication .*/PasswordAuthentication no/' /etc/ssh/sshd_config && systemctl restart ssh
   ```
   **Avant de fermer cette fenêtre**, ouvrez-en une seconde sur le Mac et vérifiez que `ssh root@<IP>` fonctionne encore.
5. Pare-feu : seules les portes 22 (SSH), 80 et 443 (web) sont ouvertes.
   ```
   # apt -y install ufw rsync curl openssl
   # ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw allow 443/udp && ufw --force enable
   ```

## 4. Installer Docker (5 min, sur le serveur)

Docker fait tourner les quatre « boîtes » de Moutar (base de données, migrations, API, site web). Le script officiel :
```
# curl -fsSL https://get.docker.com -o /root/get-docker.sh && sh /root/get-docker.sh
# docker --version && docker compose version
```
On doit voir deux numéros de version (par exemple `Docker version 27.x` et `Docker Compose version v2.x`).

## 5. Préparer le dossier et le fichier de réglages (10 min, sur le serveur)

1. Le dossier de Moutar sur le serveur, fermé aux autres utilisateurs :
   ```
   # mkdir -p /srv/moutar && chmod 700 /srv/moutar
   ```
2. Le fichier de réglages `/srv/moutar/.env.prod` se crée depuis le modèle `deploy/env.prod.example` du dépôt. Le plus
   simple : **depuis le Mac**, dans le dossier du dépôt Moutar (celui qui contient `deploy/`), copiez le modèle :
   ```
   $ scp deploy/env.prod.example root@<IP>:/srv/moutar/.env.prod
   ```
3. Sur le serveur, ouvrez-le avec l'éditeur `nano` (flèches pour se déplacer, `Ctrl+O` puis Entrée pour enregistrer,
   `Ctrl+X` pour sortir) :
   ```
   # nano /srv/moutar/.env.prod
   ```
   Et remplissez **quatre lignes** :
   - `DOMAINE=` → votre nom de domaine (`moutar.mon-nom.fr`), sans `https://`.
   - `ACME_EMAIL=` → votre adresse e-mail (Let's Encrypt y prévient si un certificat n'a pas pu être renouvelé).
   - `POSTGRES_PASSWORD=` → un mot de passe tiré au hasard. Pour l'obtenir, dans une seconde fenêtre du serveur :
     `openssl rand -hex 24`, puis collez le résultat. Vous n'aurez jamais à le retaper.
   - `IA_API_KEY=` → la clé **OVHcloud AI Endpoints**. Où la trouver : https://endpoints.ai.cloud.ovh.net/ (connexion
     avec votre compte OVH) → « Access tokens » / « Jetons d'accès » → « Create a new token » → copiez la clé affichée
     (elle ne se réaffiche pas). Sans cette clé, l'API refuse de démarrer tant que `IA_BASE_URL` est renseignée :
     si vous ne voulez pas (encore) de l'IA, mettez **`IA_BASE_URL=`** (vide) — la lecture des logos, l'OCR et la
     dictée de secours diront alors « non activée », le reste fonctionne.
   - `ADMIN_EMAIL_INITIAL=` → l'adresse e-mail de votre compte de console (`/admin`).
   Laissez les autres lignes telles quelles (`MOUTAR_APP_PASSWORD` s'ajoute tout seul à l'étape 8).
4. Fermez le fichier aux autres :
   ```
   # chmod 600 /srv/moutar/.env.prod
   ```

## 6. Sur le Mac : le dépôt à jour et les outils (5 min)

Dans le dossier du dépôt Moutar (par exemple `cd ~/Desktop/moutar`) :
```
$ git pull
$ pnpm install
$ pnpm typecheck && pnpm test
```
Tout doit être vert (« Done » trois fois, puis les tests « passed »). `rsync`, `ssh` et `curl` sont déjà sur le Mac.

## 7. Épingler les images de base (une fois, facultatif mais conseillé)

Les Dockerfiles citent `node:22-alpine`, `caddy:2-alpine` et `postgres:16-alpine` par leur étiquette. Pour que la même
image serve à chaque construction, remplacez-les une fois par leur empreinte (`deploy/README.md`, « Images de base ») :
```
$ docker buildx imagetools inspect node:22-alpine | head -3
```
Si Docker n'est pas installé sur le Mac, sautez cette étape : rien ne bloque.

## 8. Mettre en ligne depuis le Mac (10 min la première fois)

```
$ bash deploy/scripts/deployer.sh <IP>
```
Le script copie le code sur le serveur, vérifie les réglages, **tire le mot de passe du rôle de base `moutar_app`** (ajouté
à `.env.prod`, jamais affiché), construit les images, lance la base, les migrations, l'API, puis Caddy (qui obtient le
certificat HTTPS auprès de Let's Encrypt grâce au DNS de l'étape 2), et attend que `https://<domaine>/api/v1/health`
réponde. La dernière ligne attendue :
```
▸ Déployé : https://<domaine> (version <sha>)
```
Pour une **mise à jour** plus tard : les étapes 6 et 8 seules (`git pull`, puis le même script : il sauvegarde la base
avant de rejouer les migrations, et garde l'image précédente pour un retour arrière — `deploy/README.md`).

## 9. Créer le compte de la console et lire son mot de passe (2 min, sur le serveur)

```
# cd /srv/moutar/app/deploy && docker compose --env-file /srv/moutar/.env.prod run --rm migrate ./node_modules/.bin/tsx src/database/seed-admin.ts
```
Deux lignes s'affichent :
```
Compte d'administration créé : <votre e-mail>
Mot de passe (affiché une seule fois, à conserver dans un gestionnaire de mots de passe) : <mot de passe>
```
**C'est la seule fois où ce mot de passe s'affiche** : rangez-le tout de suite (Trousseau, 1Password, Bitwarden…).
Relancer la commande ne le réaffiche pas (« Le compte existe déjà : rien à faire ») ; pour le changer, suivez
« Compte admin : rotation du mot de passe » dans `deploy/README.md`.

## 10. Ouvrir Moutar sur le téléphone et l'installer (3 min)

1. Sur l'iPhone, dans **Safari** (pas Chrome : seul Safari installe une application web sur iOS), ouvrez
   `https://<domaine>`. L'accueil s'affiche, cadenas fermé dans la barre d'adresse.
2. Bouton **Partager** (le carré avec une flèche) → **« Sur l'écran d'accueil »** → **Ajouter**. L'icône Moutar
   (lavande, le « M » blanc) apparaît parmi vos applications ; ouverte depuis là, elle s'affiche en plein écran.
   Sur Android (Chrome) : menu ⋮ → « Installer l'application ».
3. Essayez : photographier un code-barres, lire la carte produit, puis `https://<domaine>/admin` avec le compte de
   l'étape 9.

## 11. Poser la sauvegarde automatique (3 min, sur le serveur)

Une sauvegarde de la base chaque nuit à 3 h 15, gardée 14 jours dans `/srv/moutar/sauvegardes` :
```
# (crontab -l 2>/dev/null; echo '15 3 * * * MOUTAR_DIR=/srv/moutar bash /srv/moutar/app/deploy/scripts/sauvegarde.sh >> /srv/moutar/sauvegarde.log 2>&1') | crontab -
# crontab -l
```
La seconde commande doit réafficher la ligne. Essai immédiat :
```
# MOUTAR_DIR=/srv/moutar bash /srv/moutar/app/deploy/scripts/sauvegarde.sh && ls -lh /srv/moutar/sauvegardes
```
Un fichier `moutar-<date>.dump` doit apparaître. **Reste à décider** : une copie hors du serveur (si le VPS est perdu,
les listes importées et les contributions le sont aussi) — `deploy/README.md`, « Sauvegarde et restauration ».

## Si une étape échoue : les cinq pannes les plus probables

1. **`dig +short <domaine>` ne montre pas l'IP, ou le script s'arrête sur « l'API ne répond pas derrière https://… »**
   → Le DNS n'est pas (encore) propagé, ou l'enregistrement `A` vise une autre adresse. Corrigez la zone DNS, attendez,
   revérifiez avec `dig`, puis relancez `bash deploy/scripts/deployer.sh <IP>`. Pour voir ce que dit Caddy :
   `# cd /srv/moutar/app/deploy && docker compose --env-file /srv/moutar/.env.prod logs --tail=50 web`
   (une ligne « acme » qui parle de `challenge` ou de `DNS` confirme le diagnostic).

2. **« Permission denied (publickey) » ou mot de passe redemandé à chaque `ssh`**
   → La clé n'est pas sur le serveur, ou vous vous connectez depuis un autre Mac. Refaites l'étape 3.2
   (`ssh-copy-id root@<IP>`) ; si le mot de passe root est refusé après l'étape 3.4, utilisez la console « KVM » de
   l'espace client OVH pour remettre `PasswordAuthentication yes` le temps de recopier la clé.

3. **« /srv/moutar/.env.prod absent », « docker compose refuse… » ou « IA_FOURNISSEUR=ovh exige IA_API_KEY »**
   → Le fichier de réglages manque ou une ligne est mal remplie (étape 5). Rouvrez-le avec `nano`, vérifiez les quatre
   lignes (pas d'espace avant ou après le `=`, pas de guillemets), et notamment `IA_API_KEY` : soit la clé OVH, soit
   `IA_BASE_URL=` vide. Puis relancez le script.

4. **Le script s'arrête pendant « Construction des images » (erreur `npm`, `pnpm`, `tsc`, « no space left »)**
   → Soit le réseau du serveur a coupé pendant le téléchargement (relancez le script, il reprend), soit le disque est
   plein (`# df -h /` ; libérez avec `# docker system prune -af`), soit le code copié a une erreur de type : revenez sur
   le Mac, `pnpm typecheck`, corrigez ou revenez au commit précédent (`git checkout main`), relancez.

5. **Le site s'affiche mais la console `/admin` refuse le mot de passe, ou la lecture des photos dit « non activée »**
   → Mot de passe : c'est celui de l'étape 9, affiché une seule fois ; perdu, suivez la rotation dans
   `deploy/README.md`. Après 10 essais ratés, la connexion est bloquée un quart d'heure : patientez. Lecture des photos :
   `IA_BASE_URL` est vide ou `IA_API_KEY` manque dans `.env.prod` ; remplissez, puis relancez l'étape 8.

Dans tous les cas, l'état des quatre boîtes se lit ainsi (sur le serveur) :
```
# cd /srv/moutar/app/deploy && docker compose --env-file /srv/moutar/.env.prod ps -a
# docker compose --env-file /srv/moutar/.env.prod logs --tail=100 api
```
`db`, `api` et `web` doivent être `running` (`healthy`) ; `migrate` finit en `exited (0)` : c'est normal, il ne tourne
qu'au démarrage.
