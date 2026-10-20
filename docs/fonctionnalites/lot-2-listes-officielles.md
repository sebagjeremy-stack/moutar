# Lot 2 — Listes officielles (niveau 2) : import à la console, recherche par nom ou marque, carte

Côté serveur, 20/10/2026 (`apps/api`, `packages/shared-types`). L'écran (`apps/web`) se fait en parallèle sur le contrat JSON du § « Contrat pour le web ». Rien n'est commité par la session : le pilote relit et commite.

## Décisions
- **Schéma** (migration `0002_listes`) : `liste_officielle` (code `consistoire_paris` | `rav_wolff`, titre, `publie_le` et `valable_jusqu_au` en **colonnes `date`** — des JOURS `AAAA-MM-JJ`, aucun fuseau n'entre en jeu —, `importe_le`, `fichier_nom`, `note_source` (l'introduction de la source), `active`, `deleted_at`) ; **une seule liste active par code** (index unique partiel `liste_officielle_active_par_code_idx`). `ligne_liste` (rubrique, marque, produit_libelle, mention, `toute_marque`, `rubrique_reservee`, `ordre`, colonnes normalisées `rubrique_norm`, `marque_norm`, `produit_norm`, `deleted_at`). `produit` reçoit `nom_norm` et `marque_norm` (tenues à chaque écriture, `produits.service.ts : normes`). Index : `(liste_id, marque_norm)`, `(liste_id, ordre)`, trigram GIN (`pg_trgm`, extension de confiance : créée par la migration sans superutilisateur) sur les cinq colonnes normalisées.
- **Normalisation APPLICATIVE, une seule règle** (`packages/shared-types/src/regles/normalisation.ts`, testée) : minuscules, accents retirés (NFD), « œ » → « oe », tout ce qui n'est ni lettre ni chiffre devient une espace. `unaccent` n'est pas utilisé (deux normalisations auraient divergé). La migration remplit les colonnes des produits déjà lus par une approximation SQL (accents courants) ; toute écriture suivante passe par le code.
- **Catalogue en code** `catalogues/rubriques-listes.ts` : rubriques RÉSERVÉES (viande, charcuterie, vin, jus de raisin, fromage — cadrage § 2 — plus « volaille » et « boucherie » par prudence, **à valider**), mots vides d'une rubrique, mentions connues (`lait_non_surveille` → « lait non surveillé »).
- **Analyseurs PURS** (`modules/listes/analyse-liste-commun.ts`, `-consistoire.ts`, `-rav-wolff.ts`, `-csv.ts`, 25 tests sur des échantillons **FICTIFS**). Heuristiques :
  - une ligne en MAJUSCULES (trois lettres au moins, aucune minuscule) ou terminée par « : » est une rubrique ; pour le Rav Wolff, un titre court (≤ 4 mots, capitale initiale, sans chiffre ni ponctuation) isolé par une ligne vide l'est aussi ;
  - sous une rubrique : « Lu » (marque), « Lu : Petit Beurre, Prince » ou « Lu – Petit Beurre » (une marque, une ligne par produit nommé), « Lu, Bonne Maman » (plusieurs marques) ;
  - « (L) », « (l) », « lait non surveillé » → mention `lait_non_surveille`, retirée du nom ; une autre parenthèse finale → mention libre ; une mention sur la rubrique elle-même (« PÂTES À TARTINER (L) ») vaut pour toutes ses lignes ;
  - une rubrique sans aucune ligne, ou la ligne « Toutes marques », → une ligne `touteMarque` ; une rubrique RÉSERVÉE n'est jamais « toute marque » (avertissement, aucune ligne) ;
  - ce qui précède la première rubrique est la `note` (introduction) ; numéros de page, filets et lignes d'un caractère sont ignorés ; « voir … » est signalé, pas lu ;
  - CSV `rubrique;marque;produit;mention` (séparateur deviné : « ; », « , » ou tabulation ; en-tête facultatif ; guillemets tolérés).
  - Chaque analyseur rend `{ lignes, avertissements, note }` ; **la console corrige les lignes à l'aperçu** avant l'import. **Piège connu** : une marque écrite en majuscules (« LU ») sous une rubrique serait lue comme une rubrique ; à régler sur les vrais fichiers.
- **PDF** : `pdf-parse` 1.1.1 côté serveur (sans réseau), chargé par `pdf-parse/lib/pdf-parse.js` (son `index.js` entre en « mode débogage » et lit un fichier de test quand il est chargé sans `module.parent`, ce qui est le cas sous `import()` — déclaration de type dans `pdf-parse-lib.d.ts`). C'est le CONTENU (`%PDF`) qui dit qu'un fichier est un PDF, jamais l'extension. Un PDF sans texte (scan) ou illisible → 422 `pdf_illisible` ; le motif va au journal du serveur, jamais au client. Un fichier non PDF est lu en UTF-8 (latin-1 si l'UTF-8 ne tient pas).
- **Import** (`ListesService.importer`) : dans UNE transaction, l'ancienne liste active du même code passe `active = false` (elle reste lisible et modifiable), la liste et ses lignes (lots de 500) s'écrivent, le journal note `liste.import` (code, titre, nombre de lignes, fichier, dates). Aucune ligne → 400 `liste_vide` ; ligne incohérente → 400 `ligne_invalide` (laquelle), rien n'est écrit. `verifierLigne` (pure) : « toute marque » exclut marque et produit et jamais sous une rubrique réservée ; une ligne nomme une marque ou un produit, ou vaut « toute marque ». Une mention saisie « L » / « (L) » / « lait non surveillé » devient `lait_non_surveille` (`codeMention`).
- **Journal** : `liste.import`, `liste.modification`, `ligne.ajout`, `ligne.modification` (avant / après), `ligne.suppression` ; une seule voie, `journaliserSur(db | tx, …)` (`admin.service.ts`), dans la transaction quand il y en a une.
- **Correspondance** (`modules/listes/correspondance-liste-regles.ts`, pure, 15 tests) : pour un produit (nom, marque) et une liste active, `cite` quand une ligne nomme la marque en MOTS ENTIERS normalisés (« Lu » jamais dans « Lutine » ; la marque se cherche dans « marque + nom ») — et, si la ligne nomme aussi un produit, que ce libellé figure dans le nom — ou quand une ligne sans marque nomme un produit (libellé ≥ 4 caractères) qui figure dans le nom ; `cite_par_rubrique` quand aucune marque ne correspond mais qu'une rubrique « toute marque » partage un mot (radical : pluriel toléré, mots vides exclus) avec le nom ; `non_cite` sinon ; `perime` quand la validité de la liste est passée au jour du centre. **Confiance** : `forte` quand la rubrique de la ligne se retrouve dans le nom du produit, `faible` sinon (marque citée pour une autre famille, peut-être) ; « par rubrique » est toujours faible. Un candidat « marque + produit » passe devant « marque seule », devant « produit seul », devant « rubrique ».
- **Carte** (`carte-regles.ts : ligneListeOfficielle`, `lignesSyntheseNiveau2`, `mentionSousLigne`) : UNE ligne de niveau 2 pour l'écran, qui porte `sousLignes` (une par liste active). Pastille : `cite` → vert « Cité · Consistoire » / « Cité · Rav Wolff » (confiance forte d'abord) ; `cite_par_rubrique` → vert « Cité par rubrique · … », mention « rubrique « YAOURTS », toute marque » ; `perime` → ambre « Cité · liste périmée » ; `non_cite` → neutre « Non cité » (ce n'est PAS un « non », jamais rouge) ; aucune liste active → ambre « Non vérifié », « aucune liste importée ». **Une marque citée avec confiance faible porte dans sa mention « rubrique « X » : à vérifier »**, que la synthèse affiche (« Permis · rubrique « BISCUITS SECS » : à vérifier ») — choix le plus protecteur, **à valider**. La synthèse reçoit UNE `LigneSynthese` par liste (statut `cite` / `perime` / `non_cite`, validité en jour), la confiance forte d'abord ; une liste périmée seule → « Non vérifié · liste périmée » (règle du lot 1).
- **Verdicts** de niveau 2 (`enregistrerVerdictsNiveau2`) : un par liste active, écrit seulement quand l'empreinte change (liste, statut, ligne, mention, validité, confiance) ; le statut écrit est celui de la LISTE (`cite` / `non_cite`), « périmé » se lit par `valable_jusqu_au` (midi UTC du jour), jamais figé.
- **Cache** : les listes actives et leurs lignes sont gardées 30 s en mémoire (`listesActives`), oubliées à chaque écriture de la console.
- **Recherche publique** `GET /recherche?q=` : ≥ 3 caractères utiles (sinon 400 `recherche_trop_courte`), chaque mot normalisé doit figurer (`LIKE '%mot%'` sur les colonnes normalisées, index trigram), 20 produits + 20 lignes des listes ACTIVES (rubriques « toute marque » comprises, `perimee` calculée au jour du centre), **120 recherches par minute et par adresse** (429 `trop_de_demandes`) — aucune donnée personnelle.
- **Corps JSON jusqu'à 1 Mo** (`main.ts`, `bodyParser: false` + `useBodyParser`) au lieu de 100 Ko : l'import des lignes corrigées d'une liste de quelques milliers de lignes pèse plusieurs centaines de Ko ; au-delà, 413 `corps_trop_grand` (vérifié). Fichier de liste : 10 Mo (413 `fichier_trop_grand`, vérifié à 11 Mo).

## Contrat pour le web
Toutes les routes sous `/api/v1`. Erreurs : `{ code, message }` (400 `requete_invalide` avec `details`, 401 `non_connecte`, 403 `session_invalide`, 404 `liste_inconnue` / `ligne_inconnue`, 413, 422 `pdf_illisible`, 429).

### `GET /produits/:ean/carte?seuil=` — niveau 2
`lignes[1]` (niveau 2) est une `LigneCarte` à laquelle s'ajoute `sousLignes: SousLigneListe[]` (vide quand aucune liste n'est active) ; `publieLe` et `valableJusquAu` y sont des JOURS `AAAA-MM-JJ` (ou null), pas des instants.
```json
{ "niveau": 2, "statut": "cite", "pastille": "Cité · Consistoire", "ton": "ok",
  "source": "Consistoire de Paris — Produits 2025-2026", "mention": "lait non surveillé",
  "detail": "Consistoire de Paris — Produits 2025-2026 (01/07/2025), valable jusqu'au 31/07/2026 : la marque « Lu » est nommée sous la rubrique « BISCUITS SECS ». Liste du Rav Wolff 2026 (01/01/2026), valable jusqu'au 01/11/2026 : ni la marque « Lu » ni le produit « Petit Beurre » n'y figurent.",
  "publieLe": "2025-07-01", "valableJusquAu": "2026-07-31", "composition": null, "avertissement": null,
  "sousLignes": [
    { "listeId": "uuid", "code": "consistoire_paris", "source": "Consistoire de Paris — Produits 2025-2026",
      "publieLe": "2025-07-01", "valableJusquAu": "2026-07-31", "statut": "cite", "confiance": "forte",
      "mention": "lait non surveillé", "detail": "… : la marque « Lu » est nommée sous la rubrique « BISCUITS SECS ». Mention : lait non surveillé.",
      "ligne": { "id": "uuid", "rubrique": "BISCUITS SECS", "marque": "Lu", "produitLibelle": null } },
    { "listeId": "uuid", "code": "rav_wolff", "source": "Liste du Rav Wolff 2026", "publieLe": "2026-01-01", "valableJusquAu": "2026-11-01",
      "statut": "non_cite", "confiance": null, "mention": null, "detail": "… n'y figurent.", "ligne": null }
  ] }
```
`statut` d'une sous-ligne : `cite` | `cite_par_rubrique` | `non_cite` | `perime` ; `confiance` : `forte` | `faible` | null. Pastilles possibles de la ligne : « Cité · Consistoire », « Cité · Rav Wolff », « Cité par rubrique · … », « Cité · liste périmée », « Non cité », « Non vérifié ». La synthèse (`synthese.pastille`) dit « Permis · <mention> » ou « Permis · niveau 2 » quand une liste valide cite le produit.

### `GET /recherche?q=bisc` (publique)
```json
{ "q": "bisc",
  "produits": [ { "id": "uuid", "ean": "3017760000001", "nom": "Petit Beurre", "marque": "Lu", "imageUrl": null } ],
  "lignes": [ { "id": "uuid", "listeId": "uuid", "code": "consistoire_paris", "source": "Consistoire de Paris — Produits 2025-2026",
                "publieLe": "2025-07-01", "valableJusquAu": "2026-07-31", "perimee": false,
                "rubrique": "BISCUITS SECS", "marque": "Lu", "produitLibelle": null, "mention": null, "touteMarque": false } ] }
```
Types partagés : `ResultatRecherche`, `ProduitTrouve`, `LigneTrouvee` (`@moutar/shared-types`). `mention` y est le CODE (`lait_non_surveille`) : l'écran le traduit par `libelleMention` (`@moutar/shared-types/catalogues/rubriques-listes`).

### Console (cookie de session, `AdminGuard`)
- `GET /admin/listes` → `{ compte, listes: ListeOfficielle[] }` (actives d'abord par code, puis par date d'import ; `nombreLignes` = lignes vivantes).
- `POST /admin/listes/apercu` → `{ lignes: LigneAnalysee[], avertissements: string[], note: string | null, fichierNom: string | null }`, **sans écrire**. Multipart : champs `code`, `format` (`auto` | `texte` | `csv`, défaut `auto` : `.csv` → CSV), fichier `fichier` (PDF, texte ou CSV, 10 Mo) ; ou JSON `{ code, texte }`.
- `POST /admin/listes` → `ListeOfficielle` (201). JSON `{ code, titre, publieLe?, valableJusquAu?, fichierNom?, noteSource?, lignes: LigneAnalysee[] }` (les lignes corrigées à l'aperçu ; `ordre` est recalculé dans l'ordre reçu) ; ou multipart avec `fichier` / `texte` SANS `lignes` (analysé puis importé tel quel ; `lignes` peut aussi être un champ multipart JSON). Désactive l'ancienne liste du même code.
- `GET /admin/listes/:id` → `ListeOfficielle`. `PUT /admin/listes/:id` `{ titre?, publieLe?, valableJusquAu?, noteSource?, active? }` → `ListeOfficielle` (`active: true` désactive l'autre liste du même code).
- `GET /admin/listes/:id/lignes?q=` → `{ liste, compte, lignes: LigneListe[] }` (ordre croissant ; `q` filtre sur rubrique, marque, produit normalisés ; 5 000 au plus).
- `POST /admin/listes/:id/lignes` `{ rubrique, marque?, produitLibelle?, mention?, touteMarque?, rubriqueReservee? }` → `LigneListe` (ajoutée à la fin).
- `PUT /admin/listes/:id/lignes/:ligneId` (mêmes champs, tous facultatifs, plus `ordre?`) → `LigneListe` ; `rubriqueReservee` se recalcule si la rubrique change sans qu'on l'ait donné. `DELETE …/lignes/:ligneId` → `{ ok: true }` (retrait doux).
- Un `publieLe` / `valableJusquAu` vide vaut null ; format `AAAA-MM-JJ`. Les champs d'un multipart arrivent en chaînes : `touteMarque` accepte `"true"` / `"false"`.

## Ce qui marche (smoke-tests du 20/10/2026, en conteneur, API 3100, base locale sans donnée)
- Connexion admin, garde (401 sans cookie). Aperçu d'un texte fictif Consistoire : 7 lignes (marques, « Bonne Maman : Tartelettes fraise, Galettes bretonnes » → deux lignes, « (L) » → mention, YAOURTS → toute marque, CHARCUTERIE réservée, VINS vide → avertissement, « Toutes marques » explicite), note = préambule. Aperçu d'un **PDF** (fabriqué par reportlab, multipart) : 4 lignes lues ; un PDF écrit à la main (xref faux) → 422 `pdf_illisible` (poppler le lisait, pdf.js non). 11 Mo → 413 `fichier_trop_grand` ; sans texte → 400 `texte_absent`.
- Import (JSON, lignes de l'aperçu) → liste active, 7 lignes ; `GET /admin/listes` les compte. Lignes : filtre `q=saint`, PUT (marque), PUT incohérente → 400 `ligne_invalide`, POST manuel (mention « L » → `lait_non_surveille` après correction), DELETE doux.
- Carte : « Petit Beurre » de Lu → niveau 2 « Cité · Consistoire », synthèse « Permis » ; « Yaourt nature » Danone → « Cité par rubrique », synthèse « Permis · rubrique « YAOURTS », toute marque » ; « Biscuits » Lutine → « Non cité » (neutre), synthèse « Non vérifié ». Verdict de niveau 2 écrit une fois (relecture sans nouvelle ligne).
- Recherche : `bisc` → 2 produits + 4 lignes ; `sàint-MICHEL` → la ligne « Saint Michel » ; `lu` → 400 ; 121e appel dans la minute → 429.
- Seconde édition du même code (multipart, fichier texte, sans lignes) → la première passe `active: false`. Rav Wolff importé (texte JSON) → la carte de Lu porte deux sous-lignes ; « Gerblé » cité par les deux avec la mention. Validité du Rav Wolff reculée → sous-ligne `perime`, recherche `perimee: true` ; Consistoire désactivé → « Cité · liste périmée », synthèse « Non vérifié · liste périmée ». Réactivation croisée des éditions : une seule active par code. Journal : `liste.import` ×3, `liste.modification`, `ligne.*`. Corps JSON de 1,1 Mo → 413 `corps_trop_grand`.
- Tests : API 136, paquet partagé 34, web 12 (inchangé) ; typecheck des trois paquets. Migration appliquée.

## Ce qui reste
- **Importer les vrais PDF depuis le Mac** (le conteneur n'atteint ni le Consistoire ni Chiourim) ; relire l'aperçu, **régler les heuristiques** sur la vraie structure (marques en majuscules, colonnes du PDF, en-têtes de page répétés, rubriques sur deux lignes) ; corriger les lignes à la console ; vérifier `note_source`.
- Écran de la console (import, aperçu, correction des lignes), écran de recherche et carte (sous-lignes) : `apps/web`, en parallèle, sur ce contrat.
- Synonymes de marques (« St Michel » / « Saint Michel »), rubriques sur deux niveaux, un produit cité sous plusieurs rubriques.
- Le cache des listes actives (30 s) est par instance ; `LimiteDeDebit` en mémoire, par adresse (une seule instance).
- Cadrage de l'hébergement (cadrage § 8.4, « décidé au lot 2 ») : non traité ici — à ouvrir avec le pilote.

## À valider par le médecin-utilisateur
1. Rubriques réservées : les cinq du cadrage, plus « volaille » et « boucherie ».
2. Une marque citée sous une rubrique étrangère au nom du produit reste « Cité » (vert) mais sa mention dit « rubrique « X » : à vérifier », et la synthèse l'affiche.
3. « Cité par rubrique » (rubrique sans marque nommée) fonde un « Permis » (vert) : c'est la règle du Consistoire (cadrage § 2) ; la pastille et la mention le disent.
4. « Non cité » en neutre, jamais rouge ; sans liste active, « Non vérifié » en ambre.
5. Corps JSON à 1 Mo (au lieu de 100 Ko) ; recherche limitée à 120 par minute et par adresse.
6. Les dates des listes en JOURS (`date`), saisies `AAAA-MM-JJ` (le Consistoire « juillet 2025 » → `2025-07-01`).
