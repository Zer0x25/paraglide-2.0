# ---- Etapa 1: dependencias de producción (en BUILDPLATFORM nativo) ----
ARG BUILDPLATFORM=linux/amd64
FROM --platform=$BUILDPLATFORM node:22-alpine AS prod-deps
WORKDIR /app
COPY package*.json .npmrc* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
# loglevel=error silencia los deprecation warnings de dependencias transitivas
# en la reinstalación de producción.
RUN npm ci --omit=dev --workspace=api --workspace=@parapente/shared --no-audit --prefer-offline --loglevel=error

# Regenerar el cliente Prisma contra el schema real con binaryTargets multi-arquitectura
COPY apps/api/prisma ./apps/api/prisma
COPY apps/api/prisma.config.ts ./apps/api/prisma.config.ts
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma

# ---- Etapa 2: build (toolchain completo en BUILDPLATFORM nativo) ----
FROM --platform=$BUILDPLATFORM node:22-alpine AS build
WORKDIR /app
COPY package*.json .npmrc* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
RUN npm ci --workspace=api --workspace=@parapente/shared --no-audit --prefer-offline --loglevel=error
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/
RUN npm run build -w @parapente/shared
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma
RUN npm run build -w api

# ---- Etapa 3: runtime (imagen final para TARGETPLATFORM, sin ejecución en QEMU) ----
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ARG GIT_COMMIT_SHA=unknown
ENV GIT_COMMIT_SHA=${GIT_COMMIT_SHA}

# Copiar manifiestos y dependencias de producción ya generadas para ambas arquitecturas
COPY package*.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=prod-deps /app/apps/api/node_modules ./apps/api/node_modules

# Artefactos compilados + fuentes/scripts que el deploy usa en runtime
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY apps/api/scripts ./apps/api/scripts
COPY apps/api/src ./apps/api/src
COPY apps/api/prisma ./apps/api/prisma
COPY apps/api/prisma.config.ts ./apps/api/prisma.config.ts
# modules.service.ts lo lee en prod desde /app/apps/api/modules.config.json
COPY apps/api/modules.config.json ./apps/api/modules.config.json

EXPOSE 3001

# cwd = /app (no /app/apps/api) para que `docker compose exec api ... --schema=apps/api/prisma/schema.prisma`
# y `npx tsx apps/api/scripts/indexes-especiales.ts` sigan resolviendo las rutas.
CMD ["node", "apps/api/dist/server.js"]
