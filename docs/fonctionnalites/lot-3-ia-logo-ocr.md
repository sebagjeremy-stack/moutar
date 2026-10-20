# Lot 3 — Module d'IA à deux fournisseurs, logo de certification par photo (niveau 1), OCR des ingrédients

Côté serveur, 20/10/2026 (`apps/api`, `packages/shared-types`). L'écran (`apps/web`) se fait en parallèle sur le contrat JSON du § « Contrat pour le web ». Rien n'est commité par la session : le pilote relit et commite.

## Décisions
- **Un seul module `ia`** (`modules/ia`) : `FournisseurIa` { `lireImage(image, consigne, schemaZod)`, `transcrire(audio)` }, deux fournisseurs interchangeables choisis par `IA_FOURNISSEUR` :
  - `ovh` (défaut) : `OvhOpenAiFournisseur`, `chat/completions` compatible OpenAI sur OVHcloud AI Endpoints (UE), l'image en `image_url` `data:<type>;base64`, consigne système + demande utilisateur, `temperature: 0`, `response_format: { type: 'json_object' }` (accepté par `Qwen2.5-VL-72B-Instruct`, vérifié) — si un modèle le refuse (400 qui nomme `response_format`), la demande repart sans et c'est l'extraction du premier bloc JSON qui lit la réponse (`extraction-json.ts`). Transcription par `audio/transcriptions` (Whisper), branchée au lot 4. `IA_BASE_URL` vide = moteur non configuré : l'API démarre, les routes IA répondent 503 `moteur_non_configure` ; un hôte hors `IA_HOTES_AUTORISES` = l'API ne démarre pas (inchangé). `IA_API_KEY` : le jeton OVH, vide quand un mandataire authentifie (conteneur de développement).
  - `anthropic` : `AnthropicFournisseur`, SDK officiel `@anthropic-ai/sdk` (0.135), `messages.create` avec `{ type: 'image', source: { type: 'base64', media_type, data } }` + le texte de la consigne, `system` = la consigne système, `max_tokens` 4096, **ni `thinking` ni `budget_tokens`, pas de pré-remplissage de l'assistant** ; `maxRetries: 0` (c'est le moteur qui relance). `stop_reason: 'refusal'` → 503 `lecture_refusee` ; `max_tokens` → 502 `reponse_illisible`. Erreurs typées : `Anthropic.RateLimitError` → 429 `moteur_sature` ; `APIConnectionError` / `APIConnectionTimeoutError` / 5xx → 503 `moteur_indisponible` relançable ; 4xx → 503 non relançable (motif au journal du serveur). Exige `ANTHROPIC_API_KEY` (sinon l'API **refuse de démarrer**, `refusDemarrage`) ; modèle `IA_MODELE_ANTHROPIC` (défaut `claude-opus-5-5`). Pas de transcription chez Claude : 501 `non_supporte`.
  - **`MoteurIa`** (le seul point d'entrée) : délai **30 s** (`AbortSignal.timeout`), **1 tentative + 1 relance** sur 5xx, réseau ou délai (jamais sur une réponse illisible, une saturation ou un refus), réponse validée par le schéma zod de l'appelant (jamais une confiance aveugle au modèle), erreurs traduites en `{ code, message }`. **Aucun appel réseau dans une transaction.** Ce qui part au moteur : l'image et la consigne, rien d'autre — ni EAN, ni nom de produit, ni identité (il n'y en a pas).
- **Journal `journal_ia`** (migration `0003_ia`, en AJOUT SEUL par déclencheurs comme `journal_admin` : UPDATE, DELETE et TRUNCATE refusés, vérifié) : une ligne par TENTATIVE — fournisseur, modèle, usage (`lecture_logo` | `ocr_ingredients` | `transcription`, énumération `usage_ia`), durée ms, jetons entrée/sortie si connus, `ok`, code d'erreur — **jamais le contenu** (ni image, ni consigne, ni texte lu ; `moteur-ia.spec.ts` fige les colonnes). L'écriture est attendue ; un journal en panne ne fait pas échouer la lecture (avertissement au journal du serveur).
- **Image reçue** (multipart, champ `image`) : 8 Mo au plus (multer, 413 `fichier_trop_grand`), type lu dans les **octets** (`common/validation/type-image.ts` : JPEG `FF D8 FF`, PNG, WebP `RIFF….WEBP` ; GIF, PDF, HEIC → 415 `type_image_refuse`) ; absente → 400 `image_absente`. Pas de recompression. **Limite : 30 lectures d'image (logo et OCR confondus) par 10 minutes et par adresse** (`LimiteLectures`, 429 `trop_de_lectures`) ; une image refusée ne compte pas.
- **Catalogue des certificateurs** (`catalogues/certificateurs.ts`, dix lignes) enrichi : `nomCourt` (la pastille), `motsCles` (textes lisibles sur le logo), `mentionsPossibles` (`parve` | `halavi` | `lait_non_surveille` | `pessah` | `mehadrin`, libellés dans `LIBELLES_MENTIONS_CERTIFICATION`), `formeDuLogo` (français). Le type `Certificateur` remplace `mentions` par `mentionsPossibles` (l'écran ne l'utilisait pas). **Surcharge de console** `certificateur_surcharge` (`actif`, `note`) : un certificateur désactivé n'est plus proposé, ne fonde plus une validation (409 `certificateur_desactive`), et une certification déjà validée avec lui redevient « Non vérifié » (ambre) sur la carte.
- **Lecture d'un logo** : consigne stricte (ci-dessous) → le modèle rend des CANDIDATS `{ texteLu, forme, confiance }`, des mentions lues et les autres textes ; puis **le code fait la correspondance** (`correspondance-certificateur-regles.ts`, pure, 13 tests) :
  - un mot-clé LONG (≥ 3 caractères) se lit en mots entiers normalisés (« OK » ne se lit pas dans « OKAY », « KLBD » pas dans « KLBDX ») ;
  - un mot-clé COURT (« OU », « U », « OK », « K ») n'est retenu que s'il est SEUL dans le symbole lu, les mots de mention retirés (« OU-D » → « ou »), ET si la forme lue partage un mot de forme avec `formeDuLogo` (cercle/rond/circle, étoile/star, ovale, rectangle, cartouche, kof, hébraïque) : **« OU » demande le cercle ou « Orthodox Union »** (« parve ou halavi » ne vaut rien) ; un « K » seul va à OK dans un cercle, Star-K dans une étoile, Kof-K dans un kof — un mot-clé court peut donc être partagé, la forme tranche (le test du catalogue n'impose l'unicité qu'aux mots-clés longs) ;
  - un nom d'organisme écrit hors symbole (`autresTextes`, « Sous le contrôle du Rav Wolff ») compte, moins fort (0,6), jamais un sigle court ;
  - score = confiance du modèle (bornée 0-1) × force (long 1 ; court avec forme 0,9 ; hors symbole 0,6) ; une proposition par organisme, triées ; mentions lues dans les mentions globales et dans le symbole (« OU-D » → halavi, « OU P » → Pessah, « Chalav Yisrael » → halavi, « lait non surveillé » → lait non surveillé), gardées seulement si l'organisme peut les porter ;
  - `aucun: true` quand rien n'est reconnu — **ce n'est pas un « non cacher »** ; les candidats non reconnus sont rendus (`candidatsNonReconnus`) pour que l'écran puisse les montrer (« symbole lu « XYZ », inconnu du catalogue »).
- **Validation d'un clic** (`POST /produits/:ean/certification`) : écrit le verdict de niveau 1 — `statut: 'cite'`, `source` = nom du certificateur, `mention` = libellés des mentions, `publie_le` = l'instant de la validation, `valable_jusqu_au` null, `detail { certificateur, mentions, texteLu, validePar: 'utilisateur' }` — dans une transaction qui retire (doux) l'ancienne certification du produit. `DELETE` retire (doux, 404 `certification_absente` s'il n'y en a pas). Les mentions hors `mentionsPossibles` de l'organisme sont ignorées.
- **Carte, niveau 1** (`carte-regles.ts : ligneCertifie`, `ligneSyntheseNiveau1`) : sans validation → neutre « Aucun logo lu » ; validée → vert « Certifié · OU », mention « parvé », source, détail daté au jour du centre ; synthèse « Permis · OU · parvé » (fondée sur l'organisme, jamais « niveau 1 » seul) ; certificateur désactivé depuis → ambre « Non vérifié », le détail le dit.
- **OCR des ingrédients** (`POST /produits/:ean/ingredients/ocr`) : consigne stricte (ci-dessous) → `{ texte, langue, lisible, confiance }` ; le serveur rend la transcription **nettoyée** (`nettoyage-ocr.ts`, pure, 9 tests : « E 1 2 0 » → E120, « E-322 » → E322, « e471 » → E471, « E 472 e » → E472e, « e 3 0 6 » → E306 ; césures recollées ; retours à la ligne → espaces ; « de 2024 », « sucre 3 0 6 », « 250 g e » intouchés) ET le texte brut, **sans rien enregistrer** ; c'est `PUT /produits/:ean/ingredients` `{ ingredientsTexte, source: 'ocr' }` qui écrit après relecture — la fiche passe alors `source: 'ocr'`, ce qui la soustrait à la relecture silencieuse d'Open Food Facts (30 jours) : les ingrédients relus par l'utilisateur ne sont pas écrasés. `lisible` est faux si le texte est vide.
- **Correction du lot 2 demandée par le pilote (choix 2)** : une marque citée sous une rubrique ÉTRANGÈRE au nom du produit (`cite`, `confiance: 'faible'`) ne fonde PLUS un « permis » : la ligne de niveau 2 devient ambre « Cité dans une autre rubrique · à vérifier » (après une citation forte et une citation par rubrique, avant une liste périmée), la `LigneSynthese` vaut `non_verifie` (mention gardée), et la synthèse partagée dit « Non vérifié · à vérifier », fondée sur la liste, avec la phrase « Cité par … sous une autre rubrique (…) : vérifiez que ce produit en relève ». Tests mis à jour (`carte-regles.spec.ts`, `synthese.spec.ts`).
- **Erreurs** : `ErreurMetier` pose désormais `code` et `message` APRÈS le détail (un détail nommé `code` écrasait le code lu par l'écran — vu au smoke) ; une exception de Nest lui-même (multer « File too large ») répond un corps propre `{ code, message }` en français, sans son message anglais ; le message du 413 dit « 8 Mo au plus pour une photo, 10 Mo pour un fichier de liste ».

## Consignes aux modèles (copiées du code)
Logo (`modules/certification/consigne-logo.ts`), système :
> Tu es un lecteur d’étiquettes alimentaires. Tu décris les SYMBOLES DE CERTIFICATION CACHER (hechsher) visibles sur la photo d’un emballage : une lettre ou des lettres dans un cercle, un K dans une étoile, un K dans une lettre hébraïque, un sigle (KBDP, KLBD, NIK…), le nom d’un organisme (Beth Din, Badatz, Rabbinat, Orthodox Union, Rav Wolff, Star-K, Kof-K…), un texte en hébreu dans un cartouche. Règles strictes : tu ne devines JAMAIS un symbole absent ; tu transcris les lettres EXACTEMENT comme elles sont écrites (« U », pas « OU », si seul un U est lisible) ; tu ne nommes pas l’organisme à la place des lettres ; tu ne juges pas si le produit est cacher. Réponds UNIQUEMENT par un objet JSON, sans texte autour, de cette forme exacte : {"candidats":[{"texteLu":"les lettres ou mots lus DANS le symbole, tels quels","forme":"description courte de la forme (ex. lettre U dans un cercle ; K dans une étoile ; rectangle avec texte hébreu)","confiance":0.0}], "mentions":["les mentions lues PRÈS des symboles, telles quelles (par ex. Parve, D, Dairy, P, Pessah, Mehadrin, Halavi, Chalav Yisrael)"], "autresTextes":["les autres textes visibles sur l’emballage, un par entrée"]}. Si aucun symbole de certification n’est visible, "candidats" est une liste vide. "confiance" est un nombre entre 0 et 1.

Utilisateur : « Décris les symboles de certification cacher visibles sur cette photo, en JSON, selon la consigne. »

OCR (`modules/ocr/consigne-ocr.ts`), système :
> Tu es un transcripteur d’étiquettes alimentaires. Tu transcris FIDÈLEMENT la LISTE D’INGRÉDIENTS lisible sur la photo, et SEULEMENT elle : ni le tableau nutritionnel, ni les textes publicitaires, ni les conseils de conservation. Tu gardes les codes des additifs tels qu’écrits (E 120, E-322, E471), les pourcentages, les parenthèses et les allergènes en majuscules. Tu ne corriges pas, tu ne complètes pas, tu n’inventes rien : un mot illisible s’écrit « [illisible] ». Si l’étiquette est en français, tu transcris en français ; sinon, dans sa langue, sans traduire. Réponds UNIQUEMENT par un objet JSON, sans texte autour, de cette forme exacte : {"texte":"la liste d’ingrédients transcrite (sans le mot « Ingrédients : » en tête)","langue":"code de langue (fr, en, it, es, he…)","lisible":true,"confiance":0.0}. Si aucune liste d’ingrédients n’est visible ou lisible, "texte" est vide et "lisible" est false. "confiance" est un nombre entre 0 et 1.

Utilisateur : « Transcris la liste d’ingrédients visible sur cette photo, en JSON, selon la consigne. »

## Contrat pour le web
Toutes les routes sous `/api/v1`, publiques (sans compte) sauf la console. Erreurs : `{ code, message }` — 400 `image_absente` / `requete_invalide` / `certificateur_inconnu`, 404 `produit_inconnu` / `certification_absente`, 409 `certificateur_desactive`, 413 `fichier_trop_grand`, 415 `type_image_refuse`, 429 `trop_de_lectures` (notre limite) / `moteur_sature` (le fournisseur), 501 `non_supporte`, 502 `reponse_illisible`, 503 `moteur_non_configure` / `moteur_indisponible` / `lecture_refusee` / `source_indisponible`. Types partagés : `LectureLogo`, `PropositionCertificateur`, `ResultatLectureLogo`, `CertificationProduit`, `MentionCertification`, `TranscriptionOcr`, `SourceIngredients` (`@moutar/shared-types`) ; libellés des mentions par `libelleMentionCertification` (`@moutar/shared-types/catalogues/certificateurs`).

### `POST /produits/:ean/logo` et `POST /logos/lire` — multipart, champ `image` (JPEG, PNG, WebP, 8 Mo)
La première exige un produit connu (404 sinon ; l'EAN ne part pas au moteur) ; la seconde lit sans produit. **Rien n'est écrit.** Compter 2 à 6 s.
```json
{ "propositions": [ { "code": "ou", "nom": "Orthodox Union (OU)", "nomCourt": "OU", "confiance": 0.9, "texteLu": "U", "mentions": ["parve"] } ],
  "aucun": false,
  "candidatsNonReconnus": [],
  "autresTextes": ["Biscuits sablés CHOCO CROQ", "Poids net 250 g · À conserver au sec"] }
```
`aucun: true` = aucun organisme du catalogue reconnu (pastille neutre « Aucun logo reconnu », jamais rouge) ; `candidatsNonReconnus` : les symboles lus qui ne correspondent à rien (à montrer, l'utilisateur pourra signaler). L'écran montre les propositions dans l'ordre (la première en avant), les mentions cochées d'avance mais modifiables, et un bouton « C'est bien ce logo » par proposition → la route suivante.

### `POST /produits/:ean/certification` — JSON `{ code, mentions?, texteLu? }` → 201 `CertificationProduit`
La VALIDATION d'un clic ; `mentions` : codes parmi `parve`, `halavi`, `lait_non_surveille`, `pessah`, `mehadrin` (celles que l'organisme peut porter ; les autres sont ignorées).
```json
{ "verdictId": "uuid", "code": "ou", "nom": "Orthodox Union (OU)", "nomCourt": "OU", "mentions": ["parve"], "mentionsLibelles": ["parvé"],
  "texteLu": "U", "publieLe": "2026-10-20T22:51:51.049Z", "certificateurActif": true }
```
`GET /produits/:ean/certification` → le même objet, ou `null` (corps vide : lire le texte avant de parser). `DELETE /produits/:ean/certification` → `{ ok: true }` (404 `certification_absente`).

### `GET /produits/:ean/carte?seuil=` — niveau 1
`lignes[0]` : sans validation `{ statut: 'non_verifie', pastille: 'Aucun logo lu', ton: 'neutre', source: null }` ; validée :
```json
{ "niveau": 1, "statut": "cite", "pastille": "Certifié · OU", "ton": "ok", "source": "Orthodox Union (OU)", "mention": "parvé",
  "detail": "Logo « Orthodox Union (OU) » lu sur l’emballage et validé par vous le 21/10/2026 (texte lu : « U »). Mention : parvé.",
  "publieLe": "2026-10-20T22:51:51.049Z", "valableJusquAu": null, "composition": null, "avertissement": null }
```
Synthèse : `{ "verdict": "permis", "pastille": "Permis · OU · parvé", "source": "Orthodox Union (OU)", "niveauFondateur": 1 }`. Certificateur désactivé à la console depuis : `{ statut: 'non_verifie', pastille: 'Non vérifié', ton: 'warn' }`, le détail l'explique.

### `POST /produits/:ean/ingredients/ocr` — multipart, champ `image` → `TranscriptionOcr`, **sans écriture**
```json
{ "texte": "Farine de BLÉ 52 %, sucre, … colorant : E120, émulsifiant E322, gélifiant : E441 (gélatine), antioxydant : E306. Peut contenir : LAIT, ŒUF, fruits à coque.",
  "texteBrut": "Farine de BLÉ 52 %, sucre, … colorant : E 1 2 0, émulsifiant E-322, gélifiant : E-441 (gélatine), antioxydant : e 3 0 6. …",
  "langue": "fr", "lisible": true, "confiance": 1 }
```
L'écran met `texte` dans le champ (modifiable), garde `texteBrut` sous un « voir le texte lu tel quel », puis `PUT /produits/:ean/ingredients` `{ "ingredientsTexte": "…", "source": "ocr" }` (existant, `source` nouveau, défaut `manuel`) → `Produit` (`source: 'ocr'`). `lisible: false` → « Aucune liste d'ingrédients lisible : recadrez, rapprochez-vous ».

### Niveau 2 (correction du lot 2)
Nouvelle pastille possible de `lignes[1]` : « Cité dans une autre rubrique · à vérifier » (`statut: 'non_verifie'`, `ton: 'warn'`, `source` = la liste, `mention` = « rubrique « X » : à vérifier »). Synthèse : `{ "verdict": "non_verifie", "pastille": "Non vérifié · à vérifier", "source": "<liste>", "niveauFondateur": 2, "phrase": "Cité par <liste> sous une autre rubrique (rubrique « X » : à vérifier) : vérifiez que ce produit en relève. Il reste la composition (niveau 4)." }`.

### Console (cookie de session, `AdminGuard`)
- `GET /admin/certificateurs` → `CertificateurConsole[]` (le catalogue + `actif`, `note`, `surcharge: { actif, note } | null`) ; `GET /admin/certificateurs/:code` → une ligne (404 `certificateur_inconnu`).
- `PUT /admin/certificateurs/:code` JSON `{ actif: boolean, note?: string | null }` → la ligne ; journal `certificateur.surcharge` (objet = code, détail `{ actif, note }`), dans la transaction.

## Ce qui marche (smoke-tests RÉELS du 20/10/2026, en conteneur, OVH `Qwen2.5-VL-72B-Instruct`, images rendues par Playwright : `.devstack/rendre-images-lot3.mjs`)
- **Logo** : un PNG « U dans un cercle + PARVE » (faux logo OU dessiné) → le modèle rend `candidats: [{ texteLu: "U", forme: "lettre U dans un cercle", confiance: 1 }]`, `mentions: ["PARVE"]`, deux autres textes ; la correspondance rend **une proposition `ou`, confiance 0,9, mention `parve`**, en 5,2 s (663 jetons d'entrée, 102 de sortie). Un PNG sans logo (« Confiture de fraises ») → `propositions: []`, `aucun: true`, 1,3 s. OU désactivé à la console → `aucun: true`, `candidatsNonReconnus: ["U"]`.
- **OCR** : un PNG d'étiquette (farine de BLÉ, « E 500, E 503 », « E 1 2 0 », « E-322 », « E-441 (gélatine) », « e 3 0 6 », allergènes en gras) → transcription **fidèle au caractère près** (`texteBrut`), nettoyée en E500, E503, E120, E322, E441, E306, `langue: "fr"`, `lisible: true`, `confiance: 1`, 5,5 s. `PUT …/ingredients` avec `source: 'ocr'` → fiche `source: 'ocr'`, additifs `[E120, E441]`.
- Le premier appel OCR a reçu un **429 d'OVH** (endpoint sans clé, limite serrée) → 429 `moteur_sature` rendu, ligne d'échec au journal ; le second a réussi. Avec un jeton (`IA_API_KEY`), la limite d'OVH est celle du compte.
- 9 Mo → 413 `fichier_trop_grand` ; GIF → 415 `type_image_refuse` ; sans image → 400 `image_absente` ; EAN inconnu en conteneur → 503 `source_indisponible` (OFF injoignable, comme au lot 1).
- Validation `ou` + `parve` → 201, carte « Certifié · OU », synthèse « Permis · OU · parvé » ; `DELETE` → carte « Aucun logo lu » ; second `DELETE` → 404 ; code inconnu → 400 ; console : liste des 10, PUT inactif/actif, 404 hors catalogue, 401 sans cookie, journal `certificateur.surcharge` ×2.
- `journal_ia` : trois lignes (deux `lecture_logo` ok avec jetons, une `ocr_ingredients` en échec `moteur_sature`), DELETE et TRUNCATE refusés par les déclencheurs.
- Tests : API 193 (type-image 3, image reçue 3, extraction JSON 3, OVH 8, Anthropic 4, moteur 8, limite 1, correspondance 13, nettoyage OCR 9, carte 17), paquet partagé 36, web 46 (inchangé) ; typecheck des trois paquets ; migration `0003_ia` appliquée.

## Comparaison OVH / Claude, à faire par le médecin-utilisateur sur de vraies photos
Aucune clé Anthropic dans le conteneur : le fournisseur Claude est testé avec un client simulé (requête exacte, erreurs typées), pas en vrai. Procédure, sur le Mac :
1. Dix photos d'emballages réels (logos petits, mal éclairés, de biais ; étiquettes d'ingrédients longues, en petits caractères), les mêmes pour les deux.
2. Avec `IA_FOURNISSEUR=ovh` (défaut) : pour chaque photo, `POST /logos/lire` et `POST /produits/:ean/ingredients/ocr` ; noter propositions, `candidatsNonReconnus`, texte OCR, durée (`journal_ia`).
3. Poser `IA_FOURNISSEUR=anthropic` et `ANTHROPIC_API_KEY=<clé>` dans `.env` (jamais ailleurs), relancer l'API, rejouer les dix photos ; même relevé.
4. Trancher sur : logos reconnus / manqués / inventés, fidélité de l'OCR (codes E, allergènes), durée, coût (`journal_ia` : jetons ; Opus 5.5 ≈ 4 $ / 20 $ par million). Le modèle Claude se change par `IA_MODELE_ANTHROPIC`.
Note : Claude refuse une image de plus de 5 Mo en base64 (400 → 503 `moteur_indisponible`) ; notre limite est 8 Mo. Si les photos du téléphone dépassent 5 Mo, c'est l'écran qui recompresse (canvas) avant l'envoi — ou une recompression serveur (`sharp`) au lot suivant.

## Ce qui reste
- Écran (`apps/web`) : photo → propositions → clic de validation ; OCR → champ relu → `PUT` avec `source: 'ocr'` ; pastille « Cité dans une autre rubrique · à vérifier » ; console des certificateurs. La maquette fun de l'écran photo (`mockups/`) sert de référence.
- Vraies photos (ci-dessus) ; régler les consignes et les mots-clés du catalogue sur ce que le modèle rend vraiment (hébreu des Badatz, petits logos) ; compléter le catalogue avec les organismes croisés en rayon (une ligne de code par organisme).
- Recompression côté écran pour Claude (5 Mo) ; HEIC des iPhone (refusé par les octets : l'écran convertit en JPEG avant l'envoi).
- Lot 4 : `transcrire` est codé côté OVH (Whisper), non branché à une route.
- `LimiteLectures` en mémoire, par adresse : une seule instance (comme la recherche).

## À valider par le médecin-utilisateur
1. Correspondance : « OU » exige le cercle ou « Orthodox Union » ; un « K » seul se tranche par la forme (cercle → OK, étoile → Star-K, kof → Kof-K) ; un nom lu hors symbole compte à 0,6.
2. Une certification validée puis un certificateur désactivé à la console → la carte redevient « Non vérifié » (ambre), le verdict n'est pas effacé.
3. `PUT …/ingredients` avec `source: 'ocr'` fait passer la fiche en `source: 'ocr'` (plus de relecture silencieuse d'OFF).
4. Limite de 30 lectures d'image par 10 minutes et par adresse ; 8 Mo par image, sans recompression serveur.
5. Correction du lot 2 (choix 2) : « Cité dans une autre rubrique · à vérifier » en ambre, synthèse « Non vérifié · à vérifier ».
6. `IA_BASE_URL` vide n'empêche plus le démarrage (503 `moteur_non_configure` sur les routes IA seulement).
