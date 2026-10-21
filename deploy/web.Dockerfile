# Image web Moutar : build Vite (PWA) puis Caddy (HTTPS automatique, fichiers statiques, proxy /api → api:3100).
# Images de base par étiquette ; à épingler par leur empreinte à la première mise en ligne (deploy/README.md).
FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@11.5.2 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared-types/package.json packages/shared-types/
RUN pnpm install --frozen-lockfile --filter @moutar/web...
# Les SOURCES seulement (jamais un node_modules ni un dist du poste).
COPY packages/shared-types/package.json packages/shared-types/tsconfig.json packages/shared-types/
COPY packages/shared-types/src packages/shared-types/src
COPY apps/web/package.json apps/web/tsconfig.json apps/web/vite.config.ts apps/web/index.html apps/web/postcss.config.js apps/web/tailwind.config.cjs apps/web/
COPY apps/web/public apps/web/public
COPY apps/web/src apps/web/src
# `build` = `tsc --noEmit && vite build` (apps/web/package.json) : une erreur de type arrête la construction, avant toute bascule.
RUN pnpm --filter @moutar/web build

FROM caddy:2-alpine
COPY deploy/Caddyfile /etc/caddy/Caddyfile
# Le Caddyfile se VALIDE à la construction : une faute arrête la construction AVANT la bascule, au lieu d'un Caddy qui ne
# démarre pas et d'un site tombé. Valeurs de pure forme pour les variables (aucun certificat n'est demandé).
RUN DOMAINE=exemple.invalid ACME_EMAIL=a@exemple.invalid caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
COPY --from=build /app/apps/web/dist /srv/web
# Caddy tourne sous l'utilisateur de l'image officielle (root dans son conteneur, sans aucune capacité hors
# NET_BIND_SERVICE : deploy/docker-compose.yml, `cap_drop`/`cap_add`, `no-new-privileges`). À durcir en 10002 si le pilote le
# souhaite (Kora le fait ; ici, pas de donnée à protéger derrière Caddy, les fichiers servis sont publics).
