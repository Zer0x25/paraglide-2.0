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
COPY apps/mcp/package.json ./apps/mcp/

RUN npm install --workspace=web --workspace=@parapente/shared --no-audit --prefer-offline --loglevel=error

COPY packages/ ./packages/
COPY apps/web/ ./apps/web/

RUN npm run build -w @parapente/shared
RUN npm run build -w web

# ---- Etapa 2: runtime (servidor estático ultraligero + proxy /api) ----
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Copiar bundle compilado de Vite y el servidor standalone
COPY --from=build /app/apps/web/dist ./dist
COPY --from=build /app/apps/web/server.mjs ./server.mjs

EXPOSE 3000
CMD ["node", "server.mjs"]
