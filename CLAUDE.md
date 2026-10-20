# Moutar — vérifier la cacherout d'un produit (projet d'un médecin, usage familial d'abord)

## Règles non négociables
- **Moutar ne décide pas, il cite.** Chaque verdict porte sa SOURCE, sa DATE et sa VALIDITÉ ; jamais un « oui » ou un « non » unique sans source ; une source périmée s'affiche en ambre, jamais en « oui ». Le niveau 4 (composition) porte toujours son avertissement (équipement, arômes, lait non surveillé, vin, bichoul). L'utilisateur choisit son seuil (défaut : niveau 2).
- **Aucune donnée de santé, aucune identité** : pas de compte pour chercher, un compte simple pour contribuer ; l'historique des scans reste sur le téléphone ; aucun hébergement HDS nécessaire. Jamais une photo d'utilisateur conservée sans qu'il l'ait demandé (contribution).
- **Sources et droits** : Open Food Facts (ODbL, attribution affichée) ; listes Consistoire et Rav Wolff importées pour un usage privé, source et date sur chaque ligne ; Les Bons Plans Cachères = contributions manuelles sourcées, jamais de scraping de Facebook ; table d'additifs À NOUS, sourcée ligne par ligne (jamais recopier un site sans licence).
- **Catalogues EN CODE et testés** (certificateurs et leurs logos, additifs, rubriques des listes) ; les règles métier dans des modules PURS (`*-regles.ts` + `*.spec.ts` à côté) ; le service lit, écrit, appelle la règle.
- **L'IA propose, l'utilisateur valide d'un clic** : la reconnaissance d'un logo ou l'OCR d'une liste d'ingrédients est une PROPOSITION (organisme reconnu, texte lu) ; c'est le CODE qui calcule le verdict à partir des catalogues. Tout appel passe par un module `ia` unique (moteur compatible OpenAI : OVHcloud AI Endpoints ; journal sans contenu ; hôte hors liste = l'API ne démarre pas). Aucune identité ne part au moteur.
- **UI** : mobile d'abord, une action par écran, pouce droit ; jetons de design uniquement (jamais une couleur en dur) ; **rouge réservé à « non cacher » ou au danger**, ambre à « non vérifié / périmé / en attente », vert à « permis selon la source » ; jamais une information par la seule couleur (le mot s'écrit à côté) ; contraste AA ; `prefers-reduced-motion` ; texte à 16 px au moins sur mobile. Tout en français.
- Secrets en variables d'env ; un jeton ne se garde que HACHÉ ; soft-delete uniquement.

## Stack (celle de Kora, reprise)
Monorepo pnpm : `apps/web` (React 18 + Vite + Tailwind, PWA), `apps/api` (NestJS + Drizzle + PostgreSQL, validation zod), `packages/shared-types` (types et règles pures partagées). Code-barres lu dans le navigateur ; dictée par la Web Speech API ; vision et OCR par OVHcloud AI Endpoints.
Maquettes HTML statiques dans `mockups/` AVANT tout écran (jetons dans `mockups/moutar.css`).

## Lots
0. Cadrage + maquette (en cours) · 1. Code-barres → Open Food Facts → additifs · 2. Listes officielles · 3. Logo par photo · 4. Dictée et texte · 5. Contributions.
Une fiche par sujet dans `docs/fonctionnalites/` ; la lire avant de toucher le sujet, la compléter à la fin du lot ; `docs/cadrage.md` fait foi sur le périmètre.

## Méthode (préférences du médecin-utilisateur)
Cadrage + GO avant tout code ; incréments courts qu'il teste lui-même sur son téléphone ; après le GO, autonomie, choix le plus protecteur noté « à valider » ; relecture critique par un sous-agent pour tout lot ; commit sélectif (jamais `git add -A`) ; rapport en français. Typecheck et unitaires avant de conclure.
