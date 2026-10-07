# Parapente School — Sistema de Gestión y Reservas

Sistema web integral y PWA para la gestión operativa, comercial y de seguridad de escuelas de parapente: control de reservas, pasajeros, asignación de pilotos, disponibilidad por bloques horarios, tracking de vuelos, analíticas financieras, equipos y meteorología en tiempo real.

---

## 🏗️ Arquitectura del Sistema

```mermaid
graph TD
    subgraph Client["Frontend / Cliente (Puerto :3000)"]
        Web["Next.js 16 + React 19 (PWA)"]
        TanStack["TanStack Query + typedApi"]
        SSEListener["useDatosStream (SSE Listener)"]
    end

    subgraph SharedPackage["Paquete Compartido"]
        Shared["@parapente/shared<br/>(DTOs • Zod Schemas • Enums • API Contracts)"]
    end

    subgraph Server["Backend API (Puerto :3001)"]
        API["Fastify 5 API Gateway"]
        Prisma["Prisma ORM<br/>(Soft-delete auto • toNum Decimal)"]
        SSEBus["Eventos SSE<br/>(datos-cambios • modulos-cambios)"]
    end

    subgraph Persistence["Bases de Datos"]
        DevDB[("Dev Postgres :5679<br/>(Aislada para desarrollo)")]
        StagingDB[("Staging Postgres :5680<br/>(Preproducción local)")]
        ProdDB[("Prod Postgres :5678<br/>(Producción)")]
    end

    Web -->|Proxy /api| API
    Web --> Shared
    API --> Shared
    API -->|Dev Pool| DevDB
    API -.->|Staging Pool| StagingDB
    API -.->|Prod Pool| ProdDB
    SSEBus -.->|Stream en vivo| SSEListener
```

---

## 🚀 Stack Tecnológico

| Capa | Tecnología | Descripción |
|------|-----------|-------------|
| **Frontend** | **Next.js 16** + **React 19** + **Tailwind CSS v4** | Arquitectura App Router, soporte PWA offline (`@ducanh2912/next-pwa`) y diseño adaptable a móviles/tablets. |
| **Data Fetching** | **TanStack Query v5** + **typedApi** | Cliente tipado end-to-end con revalidación quirúrgica vía SSE y caché optimista. |
| **Backend** | **Fastify 5** + **TypeScript** | Servidor de alto rendimiento con plugins de seguridad (Helmet, Rate-limit, CORS, JWT y Pino Logger). |
| **ORM & BD** | **Prisma 6** + **PostgreSQL 18.4 Alpine** | Enums nativos PG, dinero en `Decimal(12,2)`, soft-delete global automático e índices compuestos optimizados. |
| **Shared Core** | **@parapente/shared** | Contratos de API, validaciones Zod y DTOs compilados con `tsup` compartidos entre web y API. |
| **Testing** | **Vitest** + **Testing Library** + **Playwright** | Suite completa de pruebas unitarias/componentes en frontend y backend, más pruebas E2E en navegador real. |
| **Observabilidad** | **OpenTelemetry** + **Prometheus** + **Sentry** | Trazas distribuidas (`traceparent`), métricas de rendimiento (`/metrics`) y captura semántica de errores. |
| **Despliegue** | **Docker** + **GitHub Actions** + **GHCR** | Builds en CI con cache GHA, publicación de imágenes inmutables en GHCR y despliegue por pull en runner self-hosted. |

---

## 📁 Estructura del Monorepo

```text
paraglide/
├── apps/
│   ├── api/          # Servidor Fastify 5 + Prisma (Puerto :3001)
│   │   ├── prisma/   # Esquema Prisma, migraciones y seeds
│   │   └── src/      # Controladores, servicios, plugins y rutas
│   └── web/          # Aplicación Next.js 16 + PWA (Puerto :3000)
│       └── src/      # App Router, componentes, hooks, store y módulos
├── packages/
│   └── shared/       # DTOs, esquemas Zod y tipos comunes (@parapente/shared)
├── docs/
│   ├── adr/          # Architecture Decision Records (ADR 001 al 013)
│   └── auditorias/   # Auditorías de concurrencia e integridad
├── deploy/           # Configuraciones de Caddy y proxies de producción
├── docker-compose.yml        # Stack completo de producción
├── docker-compose.dev-db.yml # Base de datos de desarrollo aislada (5679)
├── docker-compose.staging.yml # Stack completo de preproducción/staging (Web 3200, API 3201, DB 5680)
└── .github/workflows/        # Pipeline de validación y despliegue (deploy.yml)
```

---

## 🧩 Arquitectura Modular (Básica vs Premium)

El sistema soporta activación de módulos en **runtime y versionada en repositorio**, sin requerir variables de entorno de compilación ni rebuilds.

* **Núcleo Core (Siempre activo):**
  - Inicio / Dashboard (`/`)
  - Pilotos (`/pilotos`)
  - Reservas y Pasajeros (`/reservas`)
  - Calendario de Vuelos (`/calendario` con modal de Configuración de Bloques)
  - Analíticas Financieras (`/analiticas`)
  - Auditoría del Sistema (`/auditoria`, exclusivo ADMIN con paginación keyset)

* **Módulos Premium (Gated):**

| Módulo | Ruta | Descripción |
|--------|------|-------------|
| **Equipos & Mantenimiento** | `/equipos` | Inventario de parapentes, sillas, paracaídas y bitácora de inspecciones. |
| **Manifiestos & Reportes** | `/reportes` | Generación de manifiestos DGAC y exportaciones de vuelos. |
| **Pista & Meteorología** | `/meteorologia` | Monitoreo en vivo de condiciones de despegue y aterrizaje. |
| **Pantalla Sala (FIDS)** | `/pantalla` | Tablero público de salidas y turnos en tiempo real para pantallas de sala. |
| **Plantillas & WhatsApp** | `/plantillas` | Automatización de confirmaciones y deslindes por mensajería. |

* **Mecanismo de Activación:**
  - Fuente de verdad: `apps/api/modules.config.json`.
  - La API expone `GET /api/modules` y el endpoint admin `PUT /api/admin/modules`.
  - Cada mutación emite el evento SSE `modulos-cambios`; la web actualiza la barra lateral al instante sin recarga mediante el runtime `apps/web/src/modules/runtime.ts`.

---

## ⚡ Concurrencia, Tiempo Real y Modo Offline

1. **Server-Sent Events (SSE)**: El endpoint `GET /api/eventos?token=...` emite eventos `datos-cambios`. El hook `useDatosStream` invalida selectivamente las queries de TanStack Query correspondientes a la entidad modificada.
2. **Concurrencia Optimista (`version Int`)**: Mutaciones críticas (disponibilidad de pilotos, reservas, vuelos, bloques) validan la versión del registro en una transacción atómica. Si hay desalineación, la API responde `409 Conflict` y la UI recarga los datos frescos.
3. **Disponibilidad por Bloques Horarios**: Asignación granular de pilotos por bloques de tiempo con soporte para arrastre táctil y selector de jornada completa o parcial.
4. **Arquitectura Offline-First (ADR 009)**:
   - **Navegación sin conexión**: Vistas operativas esenciales (`/`, `/pilotos`, `/reservas`, `/calendario`, `/configuracion`) precalentadas y cacheadas por Workbox (`pages-rsc` y `pages` con `ignoreVary: true`).
   - **Caché en IndexedDB**: TanStack Query + Persister guardan colecciones completas en `parapente-cache` (store `kv`, retención de 7 días).
   - **Escritura y Outbox**: Mutaciones sin conexión encoladas en IndexedDB `parapente-outbox` con UUID `X-Client-Id`; el modal se cierra fluidamente con `toast.info` y actualización optimista.
   - **Replay Automático**: Al recuperar conectividad, el outbox se reenvía en segundo plano sin duplicados.

---

## 🗄️ Reglas de Integridad y Rendimiento

* **Manejo de Dinero**: Campos monetarios en `Decimal(12,2)`. Las operaciones aritméticas en backend usan obligatoriamente `toNum()` (`money.util.ts`).
* **Soft Delete Centralizado**: Las eliminaciones lógicas marcan `deletedAt`. La extensión Prisma inyecta automáticamente `deletedAt: null` en las consultas.
* **Contrato de Listados (`listar()`)**: Todas las colecciones responden `{ data, pagination: { page, pageSize, total, totalPages, hasMore, nextPage, nextCursor } }` con un tope estricto de `pageSize <= 500`.
* **Agregaciones en DB**: Sumas y agrupaciones financieras se delegan a PostgreSQL (`groupBy`, `aggregate`, `$queryRaw`), nunca en memoria JS.

---

## 🛠️ Requisitos Previos

- [Node.js](https://nodejs.org/) v20 o v22 LTS
- [Docker](https://www.docker.com/) & Docker Compose
- npm v9 o superior

---

## 🚀 Inicio Rápido (Desarrollo Local)

### 1. Clonar e Instalar Dependencias
```bash
npm install
```

### 2. Levantar la Base de Datos de Desarrollo (Puerto 5679)
```bash
docker compose -f docker-compose.dev-db.yml up -d
```
> ⚠️ **IMPORTANTE**: La base de datos de desarrollo corre en el puerto **`5679`** (`parapente_dev_db`). **PROHIBIDO** apuntar desarrollo al puerto `5678`, ya que corresponde a la base de datos de producción y las herramientas de dev (`reset-db`, `simulate`) borrarían datos reales.

### 3. Configurar Variables de Entorno
Copia la plantilla `.env.example` en la raíz como `.env`:
```bash
cp .env.example .env
```
Verifica que `DATABASE_URL` apunte al puerto `5679`:
```env
DATABASE_URL="postgresql://admin:adminpassword@localhost:5679/parapente_dev_db"
JWT_SECRET="supersecret_jwt_key"
PORT=3001
NEXT_PUBLIC_API_URL="/api"
INTERNAL_API_URL="http://localhost:3001"
```

### 4. Sincronizar Esquema y Cargar Datos Base
```bash
cd apps/api
npx prisma db push                       # sincroniza schema.prisma (fuente de verdad)
npx tsx scripts/indexes-especiales.ts    # índices BRIN/GIN/parciales (idempotente)
npx tsx prisma/seed.ts
cd ../..
```
> **Esquema**: la fuente de verdad es [`apps/api/prisma/schema.prisma`](apps/api/prisma/schema.prisma).
> [`apps/api/prisma/migrations/`](apps/api/prisma/migrations/) contiene el *baseline* exacto del
> esquema actual por si se necesita reconstruir/adoptar `prisma migrate deploy` ([ADR 015](docs/adr/015-fuente-de-verdad-esquema.md)).
> El deploy de producción usa `db push` **sin** `--accept-data-loss`: un cambio destructivo exige revisión manual.

*Credenciales por defecto:* Usuario `admin@parapente.com` / Contraseña `admin123`.

### 5. Iniciar Servidores de Desarrollo
```bash
npm run dev
```
- **Web App**: [http://localhost:3000](http://localhost:3000)
- **API REST**: [http://localhost:3001](http://localhost:3001)

---

## 🚢 Despliegue Continuo (CI/CD)

El proyecto utiliza un pipeline automatizado en [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) que sigue el principio de **Build en CI y Deploy por Pull** (sin compilar en el servidor de producción):

```mermaid
sequenceDiagram
    participant Git as GitHub (Push to main)
    participant CI as GitHub Actions (Ubuntu)
    participant GHCR as GitHub Container Registry
    participant Server as Homelab Runner

    Git->>CI: Dispara deploy.yml
    CI->>CI: Ejecuta Tests (API + Web con Vitest)
    CI->>GHCR: Compila y publica imágenes Docker (sha-<hash> y latest)
    CI->>Server: Notifica al runner homelab
    Server->>GHCR: docker compose pull api web
    Server->>Server: docker compose up -d --no-build
    Server->>Server: npx prisma db push (en contenedor API)
    Server->>CI: Health Check HTTP (/api/public/health) OK
```

* **Rollback Instantáneo**: Permite revertir a cualquier versión anterior apuntando a los tags inmutables de GHCR:
  ```bash
  API_IMAGE=ghcr.io/zer0x25/paraglide-2.0-api:sha-<hash> \
  WEB_IMAGE=ghcr.io/zer0x25/paraglide-2.0-web:sha-<hash> \
  docker compose up -d --no-build
  ```

---

## 📊 Endpoints Principales de la API

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/api/auth/login` | Autenticación y emisión de token JWT |
| `GET` / `POST` | `/api/pilotos` | Listar pilotos (liviano) / Registrar nuevo piloto |
| `GET` / `PUT` | `/api/pilotos/:id/disponibilidad` | Carga on-demand / Guardado atómico con `version` (`409 Conflict`) |
| `GET` / `POST` | `/api/reservas` | Listar reservas con filtros server-side / Crear reserva |
| `GET` / `POST` | `/api/vuelos` | Listado por rango de fechas (`desde`/`hasta`) / Agendamiento |
| `GET` / `POST` | `/api/pasajeros` | Listado y registro de pasajeros |
| `GET` / `POST` | `/api/gastos` | Registro y filtrado de gastos operacionales |
| `GET` / `POST` | `/api/equipos` | Inventario y control de estado de equipos |
| `GET` | `/api/eventos?token=` | Stream SSE en tiempo real (`datos-cambios`, `modulos-cambios`) |
| `GET` / `PUT` | `/api/admin/modules` | Consulta y alternancia en caliente de módulos premium |
| `GET` | `/api/auditoria` | Registro de auditoría con cursor keyset (`nextCursor`) |
| `POST` | `/api/agent/chat` | Interacción con el Copiloto IA SDK |

---

## 🛠️ Scripts Disponibles

| Script | Descripción |
|--------|-------------|
| `npm run dev` | Inicia Web (`:3000`) y API (`:3001`) concurrentemente con base de datos local `:5679` |
| `npm run check:quick` | Verificación rápida integral de tipos (`tsc`), lint (`eslint`), formato y tests unitarios |
| `npm run build:shared` | Compila `@parapente/shared` (`dist/`) con tsup |
| `npm run build` | Compila paquete compartido, API y Frontend para producción |
| `npm run test` | Ejecuta la suite completa de CI (`build:shared` → `test:api` → `test:web` → `test:mcp`) |
| `npm run test:api` | Ejecuta las pruebas unitarias del backend con Vitest y mocks de Prisma |
| `npm run test:web` | Ejecuta las pruebas de componentes y vistas web con Vitest |
| `npm run test:mcp` | Ejecuta las pruebas unitarias del servidor MCP con Vitest |
| `npm run test:e2e` | Ejecuta pruebas End-to-End locales con Playwright |
| `npm run staging:up` | Levanta el stack de preproducción Docker completo (`web :3200`, `api :3201`, `db :5680`) |
| `npm run staging:seed` | Sincroniza esquema de base de datos y ejecuta seed en Staging |
| `npm run test:staging` | Ejecuta la suite E2E completa de 11 fases contra Staging (`http://localhost:3200`) |
| `npm run test:staging:mvp` | Suite Fase 10 de estrés y combinaciones MVP contra Staging (`:3200`) o Prod (`test:mvp:prod`) |
| `npm run test:staging:reagenda` | Suite de estrés para re-agendamiento dinámico, concurrencia y validación de `version` |
| `npm run test:prod` | Ejecuta la suite E2E completa de 11 pasos contra producción (`https://parapente.zer0x.org`) |
| `npm run deploy:status` | Diagnóstico de despliegue HTTP y estado de contenedores en servidor |
| `npx tsc --noEmit` | Verificación estricta de tipos en `apps/web`, `apps/api` o `apps/mcp` |

---

## 📚 Documentación Adicional

- [Portal de Documentación](docs/README.md) — Índice maestro de arquitectura, guías de diseño y hojas de ruta.
- [Architecture Decision Records (ADRs)](docs/adr/README.md) — Registro detallado de decisiones de diseño y arquitectura (ADR 001 al 013).
- [Guía para Agentes AI](AGENTS.md) — Reglas, guardrails y contexto para asistentes de desarrollo.

