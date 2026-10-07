# ---- Etapa 1: build ----
ARG BUILDPLATFORM=linux/amd64
FROM --platform=$BUILDPLATFORM node:22-slim AS build
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ARG INTERNAL_API_URL=http://api:3001
ENV INTERNAL_API_URL=$INTERNAL_API_URL
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID=""
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID

# Copiar solo manifests y .npmrc para aprovechar la caché de capas de `npm ci`
COPY package*.json .npmrc* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/
COPY apps/api/package.json ./apps/api/

# loglevel=error silencia los deprecation warnings de dependencias transitivas
# (workbox/otel) que npm imprime siempre y no se pueden resolver en CI.
RUN npm ci --workspace=web --workspace=@parapente/shared --include=optional --no-audit --prefer-offline --loglevel=error

COPY packages/ ./packages/
COPY apps/web/ ./apps/web/

RUN npm run build -w @parapente/shared
RUN npm run build -w web

# ---- Etapa 2: runtime (standalone: server autocontenido) ----
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Next standalone: server.js + node_modules mínimo trazado (sin next completo)
COPY --from=build /app/apps/web/.next/standalone ./
# Estáticos que standalone NO copia automáticamente
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public
# @parapente/shared (workspace package) no lo traza Next en npm workspaces:
# lo copiamos donde node lo resuelve (node_modules/@parapente/shared)
COPY --from=build /app/packages/shared ./node_modules/@parapente/shared

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
