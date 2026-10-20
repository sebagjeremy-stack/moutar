# Cadrage — Moutar : vérifier la cacherout d'un produit de grande distribution

Projet à part de Kora. Cadrage du 20/10/2026, **GO donné le 20/10/2026** (nom : Moutar ; dépôt : `sebagjeremy-stack/moutar`).

> À confirmer (20/10/2026, 20h38) : un cadrage parallèle, hors de cette session, propose un nom neutre (« Licite ») et une extension halal en lot 6. Ici, la consigne est Moutar, casher. Pour ne rien fermer, chaque verdict et chaque ligne d'additif portent un champ `rite` (`casher` en v1), et le nom de l'application est un jeton (`--app-name`) dans la maquette.

## 1. Principe directeur
L'application **ne décide pas, elle cite** : pour un produit, elle rend ce que chaque source dit, avec la date et la validité de la source. L'utilisateur choisit son seuil (« je m'arrête au niveau 2 »). Aucune donnée de santé, aucune identité : pas d'hébergement HDS, pas de compte obligatoire pour chercher.

## 2. Échelle de confiance (du plus haut au plus bas)
| Niveau | Source | Ce qu'on vérifie | Comment |
|---|---|---|---|
| 1 · Certifié | Logo de certification (hechsher) sur l'emballage | QUEL organisme (Beth Din de Paris, Rav Wolff, Badatz, OU, OK, Star-K, Kof-K, KLBD, Rabbinat de Hollande…) et sa mention (parvé, halavi, lait surveillé ou non, Pessah) | Photo → modèle de vision (OVHcloud AI Endpoints) + catalogue de logos EN CODE, validé par l'utilisateur d'un clic |
| 2 · Liste officielle | Consistoire de Paris (PDF « Produits 2025-2026 », juillet 2025) ; Rav Wolff (liste 2026, valable jusqu'au 01/11/2026, publiée par Chiourim) | Le produit, la marque ou la rubrique figure sur la liste | Import des listes en base (marque, rubrique, mention (L) = lait non surveillé), recherche par nom + marque ; règles du Consistoire : rubrique sans marque = tout autorisé, marques nommées = seules celles-là |
| 3 · Communautaire | Les Bons Plans Cachères (association loi 1901, groupe Facebook privé + lesbonsplanscachers.fr) | Produit validé par le groupe | PAS d'API, scraping Facebook impossible et interdit : saisie manuelle ou contribution d'utilisateurs, sourcée (date + capture facultative) |
| 4 · Sur composition | Liste d'ingrédients + table des additifs (E-numéros) | Aucun ingrédient ou additif problématique | Code-barres → Open Food Facts (API libre, ODbL : nom, marque, `ingredients_text_fr`, `additives_tags`) ; sinon OCR de la photo ; croisement avec NOTRE table d'additifs (statut casher / douteux / non casher, source par ligne — le site les-additifs-alimentaires.com sert de référence de départ, sa licence est à vérifier avant toute copie) |

Avertissement affiché au niveau 4 : la composition seule ne garantit rien (équipement partagé, arômes, lait non surveillé, vin, bichoul…). C'est le niveau le plus bas, jamais un « vert ».

## 3. Entrées (mobile d'abord)
- **Photo** (voie principale) : code-barres (EAN, lecture locale dans le navigateur) → logo → liste d'ingrédients. Une seule photo peut servir aux trois.
- **Dictée** : Web Speech API (navigateur), texte relu avant recherche.
- **Texte** : nom + marque, suggestions dès 3 caractères.

## 4. Sortie : la carte produit
Nom, marque, photo OFF. Puis 4 lignes, une par niveau : « Oui (source, date) » / « Non » / « Non vérifié » — jamais un verdict unique par la seule couleur, le mot s'écrit à côté. Bandeau de validité (liste périmée = ambre). Historique des scans gardé sur le téléphone seulement.

## 5. Stack (celle de Kora, reprise)
PWA React + Vite + Tailwind (design system de Kora réutilisé, sobriété), API NestJS + PostgreSQL + Drizzle, moteur IA = OVHcloud AI Endpoints (vision pour le logo, OCR). Hébergement simple (OVH VPS ou Vercel + Postgres managé) : pas de HDS. Catalogues (certificateurs, additifs) EN CODE et testés.

## 6. Modèle de données (esquisse)
`certificateur` (code, nom, pays, logos, niveau de reconnaissance) · `produit` (ean, nom, marque, source OFF) · `verdict` (produit ou marque ou rubrique, niveau 1-4, rite, source, mention, date, valable_jusqu_au, statut) · `liste_officielle` + `import_liste` (fichier, date, lignes) · `additif` (E, nom, rite, statut, source) · `contribution` (utilisateur, verdict proposé, preuve, validé par).

## 7. Lots
0. Cadrage + maquette HTML statique de la carte produit et de l'écran photo (GO sur maquette). **En cours.**
1. Code-barres → Open Food Facts → analyse des additifs (niveau 4). Déjà utile seul.
2. Import des listes Consistoire et Rav Wolff (niveau 2), recherche nom/marque, date de validité.
3. Reconnaissance du logo par photo (niveau 1), catalogue de certificateurs, validation d'un clic.
4. Dictée + texte, historique local.
5. Contributions (niveau 3, LBPC) avec validation par un modérateur.

## 8. Décisions prises au GO (20/10/2026)
1. Public : usage perso et famille, ouvert à quelques proches ; pas de compte pour chercher, compte simple pour contribuer ; pas de CGU ni de modération lourde en v1.
2. Listes : import du PDF du Consistoire et de la liste du Rav Wolff pour un usage privé, source et date sur chaque ligne ; un mot au Consistoire avant toute ouverture au grand public.
3. Certificateurs v1 : dix proposés (Beth Din de Paris, Rav Wolff, Badatz Eda Haredit, OU, OK, Star-K, Kof-K, KLBD, Rabbinat de Hollande, Rabbinat de Milan) — à compléter par le médecin-utilisateur avec ceux qu'il croise en rayon.
4. Pessah hors v1. Seuil par défaut : niveau 2. Hébergement décidé au lot 2.
5. Contraintes : la session cloud n'atteint ni Open Food Facts, ni le Consistoire, ni Chiourim ; les imports réels et les essais sur un vrai produit se font sur le Mac ; les PDF des listes déposés dans `docs/sources/` se traitent depuis le cloud.

## 9. Nom
**Moutar** (מותר, « permis ») — retenu le 20/10/2026. Alternatives écartées : Scanacher, Kachérou, Tov !, Hekhsher.
