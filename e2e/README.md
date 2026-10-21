# Tests bout-en-bout (Playwright)

Des parcours RÉELS dans Chromium headless contre la pile de développement : l'accueil, la carte produit, les ingrédients
(saisie et OCR simulé), le logo (lecture simulée, validation et retrait réels), les contributions (écran et console), le
seuil et l'historique, la console, les garde-fous d'écran et la dictée de secours. Chaque spec est autonome et **nettoie
ce qu'elle crée** (retrait doux : `deleted_at`, par l'écran, l'API ou SQL).

## Prérequis
1. La pile démarrée : `bash scripts/dev-restart.sh` (web **5273**, API **3100**, Postgres 5433) — un `EADDRINUSE` dans
   `.devstack/dev.log` traîne souvent : relancer avant une passe, puis `curl localhost:3100/api/v1/health` → 200.
2. La graine : `pnpm db:seed-e2e` (idempotente). Elle crée ou REMET quatre produits fictifs à EAN fixes
   (`3000000000901` Petit Beurre · Lu, cité par les listes fictives actives ; `902` Bonbons gélifiés, gélatine + E120 ;
   `903` et `904` sans ingrédients), retire leurs traces d'une passe d'avant, et le compte de console `e2e@exemple.fr`.
   Le mot de passe vient de `E2E_ADMIN_PASSWORD`, sinon de `.devstack/e2e/mot-de-passe-admin` (ignoré par git), sinon
   d'un tirage aléatoire **imprimé une fois** et gardé là — jamais dans un fichier suivi. Elle écrit
   `.devstack/e2e/graine.json` (EAN, compte, import éventuel), que les specs lisent. Elle refuse la production.
3. Chromium : celui de `PLAYWRIGHT_BROWSERS_PATH` (`/opt/pw-browsers` dans le conteneur). Si sa révision n'est pas celle
   que `@playwright/test` attend, `e2e/_chromium.ts` pointe `executablePath` vers le Chromium présent — rien n'est
   téléchargé (`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`). Le moteur WebKit n'est pas installé : le projet `mobile` est un
   Chromium à la taille d'un iPhone 13 (390 × 844, tactile, thème clair).

## Commandes (depuis la racine)
- Toute la suite : `pnpm e2e` (= `playwright test --reporter=line`). Le projet `setup` se connecte UNE fois à la console
  et enregistre les cookies dans `.devstack/e2e/admin.json` ; `mobile` et `console` en dépendent.
- Une spec : `pnpm exec playwright test e2e/accueil.spec.ts --reporter=line` ; un projet : `--project=console`.
- Les types des specs : `pnpm exec tsc -p e2e/tsconfig.json`.
- Une trace est gardée sur échec (`.devstack/e2e/resultats/…/trace.zip`, `pnpm exec playwright show-trace <zip>`).

## Projets
- `setup` (`auth.setup.ts`) : `POST /admin/connexion` avec le compte e2e, cookies enregistrés ; si la graine l'a demandé
  (aucune liste active ne cite « Lu »), importe une liste Consistoire FICTIVE par l'API de la console (elle devient
  l'édition active du code, il n'y en avait pas).
- `mobile` (390 × 844) : `accueil`, `carte-produit`, `ingredients`, `logo`, `seuil-historique`, `accessibilite`, `dictee`.
- `console` (1 100 px, session administrateur par `storageState`) : `admin`, `contribution`.

## Pièges
- **La connexion à la console est limitée à 10 essais par quart d'heure, par e-mail et par adresse** : jamais un
  `POST /admin/connexion` dans un test — les cookies du `setup` sont REJOUÉS (`storageState`, ou `sessionAdmin` de
  `e2e/_sessions.ts`). Une session dure 12 h : au-delà, relancer `pnpm e2e:setup`.
- **Jamais un appel réel au moteur d'IA** : la lecture du logo (`…/logo`), l'OCR (`…/ingredients/ocr`) et la
  transcription (`/transcriptions`) sont interceptés par `page.route` avec des réponses du contrat. Le **jeton de
  proposition** d'un logo ne s'obtient que d'une lecture réelle (haché en mémoire de l'API) : la validation d'un clic avec
  un jeton simulé reçoit 400 `proposition_inconnue` — c'est ce que `logo.spec` vérifie ; la carte « Certifié · OU » se
  teste avec une certification POSÉE EN BASE (`poserCertification`, la ligne que le serveur écrit), retirée par l'écran.
- **Limites par adresse** : 10 validations ou retraits de certification par heure (`logo.spec` en consomme 2), 10
  contributions par heure (`contribution.spec` en consomme 1), 30 lectures d'image par 10 minutes (aucune ici : les routes
  sont interceptées), 120 recherches par minute. Au-delà d'une poignée de passes dans l'heure, les 429 arrivent :
  attendre, ou relancer l'API (`bash scripts/dev-restart.sh` : les compteurs sont en mémoire).
- **Nettoyage** : `logo.spec` retire les verdicts de niveau 1 du produit cité ; `contribution.spec` retire (doux) les
  contributions et le verdict de niveau 3 ; `ingredients.spec` remet le produit `904` sans ingrédients ; `admin.spec`
  remet la surcharge de l'additif `E1520` comme avant (PUT de l'ancienne valeur, ou ligne retirée s'il n'y en avait
  pas : la table n'a pas de retrait doux) et n'importe JAMAIS une liste (l'aperçu seulement : un import désactiverait
  l'édition active). Les journaux (`journal_admin`) sont en ajout seul : chaque passe y laisse ses lignes, c'est normal.
  Les signalements des produits de la graine sont effacés par la graine elle-même (pas de retrait doux sur cette table).
- **Pas deux passes en parallèle** (`workers: 1`, `fullyParallel: false`) : les specs partagent les produits de la
  graine et les limites par adresse ; une seconde passe en même temps ferait tomber le nettoyage et les 429.
- **Ne rien modifier dans le code pendant une passe** (`nest start --watch` et Vite rechargent : 500 transitoires).
- La liste fictive du Rav Wolff importée au lot 2 est valable jusqu'au 01/11/2026 : passé ce jour, la sous-ligne du
  niveau 2 de « Petit Beurre » dira « Cité · liste périmée » (ambre) ; `carte-produit.spec` tolère les deux formes
  (une pastille qui commence par « Cité », des dates écrites).
- La caméra n'existe pas en headless : `/scan` tombe sur le secours « Choisir une image de l'appareil », et les specs
  chargent un PNG (une image de synthèse de `.devstack` si elle existe, sinon un PNG généré par `imagePng()` — jamais une
  photo réelle) dans l'entrée de fichier masquée (`setInputFiles`).
- `page.route('**/api/v1/produits/**')` : le glob `*` ne traverse pas un `/` — la carte est `…/produits/<ean>/carte`.
