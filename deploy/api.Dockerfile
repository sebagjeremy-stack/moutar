# Image de l'API Moutar (NestJS + Drizzle) — contexte de build = racine du dépôt.
# Elle sert à deux services de deploy/docker-compose.yml : `migrate` (rôle propriétaire : migrations puis db:droits, puis
# s'arrête) et `api` (rôle applicatif `moutar_app`). Images de base par étiquette ; à épingler par leur empreinte
# (`node:22-alpine@sha256:…`) à la première mise en ligne, depuis un poste qui atteint le registre (deploy/README.md).

# 1. Construction : toutes les dépendances (TypeScript, Nest CLI), puis l'API compilée.
FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@11.5.2 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared-types/package.json packages/shared-types/
RUN pnpm install --frozen-lockfile --filter @moutar/api...
# Les SOURCES seulement (jamais un node_modules ni un dist du poste : le dépôt n'a pas de .dockerignore à la racine).
COPY packages/shared-types/package.json packages/shared-types/tsconfig.json packages/shared-types/
COPY packages/shared-types/src packages/shared-types/src
COPY apps/api/package.json apps/api/tsconfig.json apps/api/nest-cli.json apps/api/
COPY apps/api/src apps/api/src
# Les tests compilés n'ont rien à faire dans l'image (ils importeraient vitest, absent de l'image finale).
RUN pnpm --filter @moutar/api build && find apps/api/dist -name '*.spec.js*' -delete

# 2. Les dépendances de PRODUCTION seules : ni vitest, ni Nest CLI, ni TypeScript, ni drizzle-kit. `tsx` en est : le
# serveur lit le TypeScript du paquet partagé à l'exécution (`--require tsx/cjs`, comme `nest start` par l'`exec` de
# nest-cli.json), et le conteneur `migrate` lance ses outils par lui (`src/database/*.ts`).
FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@11.5.2 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared-types/package.json packages/shared-types/
RUN pnpm install --frozen-lockfile --prod --filter @moutar/api...

# 3. L'image finale : utilisateur fixe, non root (10001), pendule de Paris, production.
FROM node:22-alpine
RUN addgroup -S -g 10001 moutar && adduser -S -u 10001 -G moutar -h /home/moutar moutar
ENV NODE_ENV=production
ENV TZ=Europe/Paris
WORKDIR /app
# Les dépendances de production d'abord, puis ce que l'API lit à l'exécution : le code compilé (`dist`), ses sources
# TypeScript (outils du conteneur `migrate` : migrations, graine du compte admin, droits) et le paquet partagé, lu par `tsx`.
COPY --from=deps --chown=moutar:moutar /app /app
COPY --from=build --chown=moutar:moutar /app/tsconfig.base.json /app/
COPY --from=build --chown=moutar:moutar /app/packages/shared-types/package.json /app/packages/shared-types/tsconfig.json /app/packages/shared-types/
COPY --from=build --chown=moutar:moutar /app/packages/shared-types/src /app/packages/shared-types/src
COPY --from=build --chown=moutar:moutar /app/apps/api/package.json /app/apps/api/tsconfig.json /app/apps/api/nest-cli.json /app/apps/api/
COPY --from=build --chown=moutar:moutar /app/apps/api/src /app/apps/api/src
COPY --from=build --chown=moutar:moutar /app/apps/api/dist /app/apps/api/dist
USER moutar
WORKDIR /app/apps/api
EXPOSE 3100
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3100/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Démarrage de l'API compilée (le script `start` de apps/api/package.json). Les migrations tournent AVANT, dans le service
# `migrate` du compose, seul à porter le mot de passe du propriétaire de la base.
CMD ["node", "--require", "tsx/cjs", "dist/main.js"]
