# Moutar — מותר, « permis »

Vérifier en rayon si un produit de grande distribution est cacher, et à quel niveau de confiance.
Webapp mobile d'abord : on photographie le produit (code-barres, logo de certification, liste d'ingrédients), on dicte ou on tape son nom.

**Moutar ne décide pas, il cite** : pour chaque produit, une ligne par source, avec sa date et sa validité. L'utilisateur choisit son seuil.

| Niveau | Source |
|---|---|
| 1 · Certifié | Logo de certification (hechsher) reconnu sur l'emballage |
| 2 · Liste officielle | Consistoire de Paris, Rav Wolff |
| 3 · Communautaire | Les Bons Plans Cachères (contributions sourcées) |
| 4 · Sur composition | Ingrédients et additifs (Open Food Facts + table d'additifs sourcée) |

- Cadrage : [`docs/cadrage.md`](docs/cadrage.md)
- Règles du projet : [`CLAUDE.md`](CLAUDE.md)
- Maquettes HTML statiques : [`mockups/`](mockups/) (ouvrir `mockups/index.html`)

État : lot 0 (cadrage + maquette). Aucun code applicatif encore.
