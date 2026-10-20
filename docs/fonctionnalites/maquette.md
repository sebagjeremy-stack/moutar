# Maquette (lot 0)

## Décisions
- 20/10/2026 — Deux écrans suffisent au GO visuel : **l'accueil** (photographier, dicter, écrire ; le seuil ; les derniers produits) et **la carte produit** (synthèse selon le seuil, puis les quatre niveaux, une ligne par source avec date et validité, ingrédients repliés, pied à deux actions).
- La page EST l'écran (430 px au plus, pas de faux cadre) ; jetons dans `mockups/moutar.css`, une seule source ; le nom de l'application est le jeton `--app-name` (un cadrage parallèle propose un nom neutre : rien n'est fermé).
- Une pastille porte toujours son MOT (« Permis · niveau 2 », « Non vérifié », « Non cacher ») ; rouge réservé à « non cacher » ; une source périmée est ambre (« Cité · liste périmée »), jamais verte.
- Le niveau 4 (composition) porte son avertissement dans sa propre ligne, pas en tête de carte.

- 20/10/2026, relecture critique (5 bloquants, 22 mineurs, corrigés) : le niveau 4 n'est JAMAIS vert (pastille neutre « … · composition seule ») ; le niveau 2 écrit UNE sous-ligne PAR source, avec date de publication et validité ; la synthèse nomme la source qui la fonde et ne répète rien ; le bouton primaire est sous le pouce droit (pied collant, à droite) — « à valider » pour l'accueil ; marques fictives seulement (« Marque Repère » est une marque réelle, retirée) ; `--ok` assombri pour l'AA ; `color-scheme: light dark`.
- 20/10/2026, demande du médecin-utilisateur : quand aucun logo n'est lu et qu'aucune liste ne cite le produit, la carte propose en ACTION PRINCIPALE « Scanner les ingrédients » (variante maquettée) ; le code-barres identifie le produit par Open Food Facts (cadrage § 4).

## Reste à faire après le GO sur maquette
- Écran « Historique » et écran « Mon seuil » (choix du niveau) : non maquettés, à dessiner au lot 4.
- Écran de prise de photo (viseur, trois lectures d'une seule image) : à dessiner au lot 1 avec le composant réel de lecture de code-barres.
- État « Non cacher » (rouge) de la carte produit : non montré ; à montrer au lot 2 avec un produit d'une rubrique où la marque n'est pas citée.

## État
Non poussé (dépôt GitHub `sebagjeremy-stack/moutar` à créer par le médecin-utilisateur ; la session cloud ne peut pas le créer).
