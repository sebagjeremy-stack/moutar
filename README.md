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

- Cadrage : [`docs/cadrage.md`](docs/cadrage.md) · Règles : [`CLAUDE.md`](CLAUDE.md) · Fiches : [`docs/fonctionnalites/`](docs/fonctionnalites/README.md)
- Maquettes HTML statiques : [`mockups/`](mockups/) (ouvrir `mockups/index.html`)

État : lot 1 codé (code-barres → Open Food Facts → composition) + socle de la console d'administration ; lot 2 côté serveur (listes Consistoire et Rav Wolff importées à la console, recherche par nom ou marque, niveau 2 de la carte).

## Développement
Prérequis : Node 22, pnpm 11, PostgreSQL 16 (`/usr/lib/postgresql/16/bin`, ou `PG_BIN=…`).

```sh
pnpm install
cp .env.example .env                       # puis ajuster ADMIN_EMAIL_INITIAL
pnpm db:start                              # Postgres local, port 5433, base « moutar » (.devstack/pg)
pnpm db:migrate                            # migrations Drizzle (apps/api/src/database/migrations)
pnpm db:seed-admin                         # le compte admin : mot de passe imprimé UNE fois
pnpm dev                                   # API http://localhost:3100/api/v1/health + web http://localhost:5273
```

- Typecheck : `pnpm typecheck` · tests unitaires : `pnpm test` · build web (avec PWA) : `pnpm --filter @moutar/web build`.
- Nouvelle migration : `pnpm db:generate --name=<nom>` puis `pnpm db:migrate` (la migration `0002_listes` crée l'extension PostgreSQL `pg_trgm`, de confiance : aucun superutilisateur requis).
- Listes officielles : import à la console (`/admin/listes`) d'un PDF (lu par `pdf-parse`, côté serveur), d'un texte collé ou d'un CSV `rubrique;marque;produit;mention` ; recherche publique `GET /api/v1/recherche?q=`.
- Relancer la pile : `bash scripts/dev-restart.sh` (journal dans `.devstack/dev.log`) ; arrêter la base : `pnpm db:stop`.
- Monorepo : `apps/api` (NestJS + Drizzle + zod), `apps/web` (React + Vite + Tailwind, PWA), `packages/shared-types` (types, règles pures `regles/`, catalogues `catalogues/`).
