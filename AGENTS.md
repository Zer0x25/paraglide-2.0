# AGENTS.md — paraglide

Sistema de reservas para escuela de parapente (Español).
Monorepo: `apps/web` (Next.js 16 + PWA), `apps/api` (Fastify 5 + Prisma + Postgres), `apps/mcp` (Servidor MCP), `packages/shared` (DTOs/Zod).

---

## 1. Marco de Gobernanza (7 Pilares)

El desarrollo en este repositorio sigue una disciplina estricta de 7 capas que garantiza trazabilidad desde el producto hasta la ejecución técnica:

| Elemento | Dónde vive | Función |
|---|---|---|
| **PRD** | [`PRD.md`](PRD.md) | Alcance de la entrega, usuarios, requisitos y aceptación final |
| **ADR** | [`docs/adr/`](docs/adr/README.md) | Decisiones arquitectónicas significativas |
| **Prompt maestro** | [`PROMPT-MAESTRO.md`](PROMPT-MAESTRO.md) | Invocación, referencia al PRD y autonomía autorizada |
| **SDD + BDD** | [`specs/`](specs/README.md) (cada spec) | Contratos, límites y escenarios Dado/Cuando/Entonces |
| **TDD** | Pruebas e implementación | Verificar comportamiento antes de implementarlo |
| **DoD** | [`AGENTS.md`](AGENTS.md) (Sección 6) | Condiciones comunes de calidad y cierre del proyecto |
| **Seguimiento** | [`STATE.md`](STATE.md) y aprendizaje | Evidencia, pendientes y siguiente acción |

### Niveles de Rigor Operativo (Governance Tiering)
Para balancear rigor técnico con agilidad operativa, las tareas se clasifican en:
- **Tier 1 (Architectural)**: Cambios en `schema.prisma`, pagos, concurrencia o nuevos módulos. Exige el ciclo completo de 7 capas (PRD/Spec/STATE).
- **Tier 2 (Standard)**: Nuevos endpoints CRUD, modales UI o componentes. Exige DTOs en `packages/shared`, BDD integrado en tests y gate `npm run check:quick`.
- **Tier 3 (Fast-Track)**: Bugfixes, fallos de CI, ajustes CSS o refactors locales. Diagnóstico con `debug-flujo`, fix mínimo y gate `npm run check:quick`. Cero burocracia documental.

> Manual detallado del marco en [`docs/gobernanza.md`](docs/gobernanza.md).

---

## 2. Entorno y Puertos (Seguridad de DB)

- **Root `.env` único** (dotenvx): Cargado por `apps/web/next.config.ts`, `apps/api/src/config.ts` y `apps/mcp/src/config.ts`. No existe `apps/web/.env`.
- **Dev (Local)**: Web `:3000`, API `:3001`, DB Postgres `:5679` (`docker compose -f docker-compose.dev-db.yml up -d`, `parapente_dev_db`).
- **Staging (Preproducción)**: Web `:3200`, API `:3201`, DB Postgres `:5680` (`docker compose -f docker-compose.staging.yml up -d --build`, `parapente_db_staging`).
- **Producción (Host/Caddy)**: Web `:3100`, API `:3101`, DB Postgres `:5678` (`parapente_postgres` en `docker-compose.yml`).
- 🚨 **PROHIBIDO tocar el puerto 5678**: Es la DB de producción. Scripts destructivos o tests jamás deben apuntar a este puerto.
- **Node.js**: Versión **22** (imágenes Docker alpine/slim). Verificar con `node --version` si hay paridad de entornos.

---

## 3. Guía Rápida de Comandos

### Flujo Cotidiano de Desarrollo
| Comando | Propósito |
| :--- | :--- |
| `npm run dev` | Inicia Web (`:3000`, `--webpack`) y API (`:3001`) concurrentemente. |
| `npm run check:quick` | **Gate principal**: Build de `@parapente/shared` + Typecheck monorepo + Vitest unitarios. |
| `npx tsc --noEmit` | Validación rápida de tipos TypeScript (ejecutar en raíz o sub-app). |
| `npm run build:shared` | Compilar DTOs/Zod tras modificar `packages/shared`. |
| `npx prisma generate` | Regenerar cliente Prisma tras editar `apps/api/prisma/schema.prisma`. |
| `npm run format` | Formateo incremental con Prettier: solo los archivos que Git ve cambiados (staged, modificados y untracked). Ejecutar antes de commitear. |
| `npm run format:check` | Verifica formato sin escribir. Sale con código `1` si algún archivo cambiado no cumple. |

### Suites de Pruebas Específicas
- `npm run test:api`: Tests unitarios de API con mocks de Prisma (`src/**/__tests__/**/*.test.ts`).
- `npm run test:api:integration`: 11 suites de integración con DB real en Dev (`:5679`).
- `npm run test:web`: Tests unitarios y de componentes de Web.
- `npm run test:mcp`: Tests unitarios de tools del servidor MCP.
- `npm run test:e2e`: Pruebas Playwright E2E en `apps/web` (vouchers, deslinde, reagendamiento).

### Staging y Producción (Operaciones)
- `npm run test:staging` / `test:staging:quick` / `test:staging:stress`: Suites contra Staging (`:3200`).
- `npm run test:prod:all`: Ejecución completa de suites contra producción.
- `npm run staging:up` / `staging:down` / `staging:seed`: Gestión del stack de Staging.
- `npm run deploy:status`: Diagnóstico de despliegue HTTP y estado de contenedores en VM.

---

## 4. Guardrails y Reglas Inmutables

### Seguridad y Base de Datos
- **Aislamiento**: Dev siempre en `:5679`, Staging en `:5680`. Nunca referenciar `:5678` en tareas locales.
- **Soft Delete**: Extensión Prisma auto-inyecta `deletedAt: null`. Prohibido saltársela con SQL crudo sin filtro.
- **Side Effects DB**: Capturar flags en `$transaction` y emitir SSE (`broadcastDatos`) o notificaciones **solo tras el commit exitoso**.

### Lógica de Negocio y Finanzas
- **Dinero**: Usar siempre `toNum()` de `money.util.ts` (`Decimal(12,2)`). Prohibidos operadores nativos JS (`+`, `-`, `>=`) sobre `Decimal`.
- **Concurrencia**: Control optimista obligatorio con `version Int`. Fallos de concurrencia deben retornar HTTP `409 Conflict`.
- **Fechas / Timezone**: Normalizar con `dateKeyLocal`/`getDateKey` (offset TZ local). Nunca `new Date().toISOString().slice(0, 10)` directo.

### Contrato de Datos y API (ADR 005)
- **Colecciones**: Paginación con helper `listar()` (`pageSize <= 500`). Respuesta estándar `{ data: T[], pagination }`.
- **Clientes**: Consumir colecciones usando `unwrapList` (`@parapente/shared`). En tests, mockear siempre el sobre completo `{ data, pagination }`.
- **Vistas Públicas**: Exponer identificadores no secuenciales (`tokenPublico`/`shortId`). Registrar rutas en `publicPaths`.

### Frontend, React y PWA
- **Data Fetching**: TanStack Query (`@tanstack/react-query`) + `typedApi` + `Skeleton` loaders. Prohibido SWR o `api.get` crudo en `useEffect`.
- **Rules of Hooks**: Retornos condicionales y guards siempre **después** de todos los hooks.
- **Tailwind v4**: Clases canónicas v4 (`border-slate-200 dark:border-slate-700`, `bg-linear-to-*`). Sin tokens ficticios.
- **Offline & Outbox**: Estado reactivo en `useOnlineStatus` (`networkMode: 'offlineFirst'`). Capturar `isQueuedError(error) || error?.queued`, informar con `toast.info` y aplicar inyección optimista (no tratarlo como error de red fatal).
- **Service Worker**: `matchOptions: { ignoreSearch: true, ignoreVary: true }` en Workbox. `useWarmupData` sincronizado con `controller` y `controllerchange`.

### Servidor MCP e Integridad
- **MCP Server**: Conexión HTTP vía cliente tipado y `x-api-key` con rol `RECEPCION`. Consultar versión previa para control de concurrencia.
- **Integridad JSON**: Validar sintaxis de archivos JSON antes de commit (`node -e "JSON.parse(...)"`).

---

## 5. Arquitectura Modular (Core vs Premium)

- **Módulos Core**: Inicio `/`, Pilotos `/pilotos`, Reservas `/reservas`, Calendario `/calendario`, Analíticas `/analiticas`, Auditoría `/auditoria`.
- **Módulos Premium**: Equipos, reportes, meteorología, pantalla, plantillas.
- **Activación en Runtime**: `modules.config.json` → API `GET /api/modules` + broadcast SSE `modulos-cambios` → Web `runtime.ts` + `registry.ts`.
- **Protección UI**: Páginas premium envueltas en `withModule(id, Page)`. La configuración general vive en `/configuracion` (admin, con pestañas); los bloques de vuelo se editan desde el modal `ConfigBloquesModal` en calendario.

---

## 6. Definition of Done (DoD) de Paraglide

Toda tarea, refactor o nueva feature debe cumplir estrictamente esta lista de condiciones de calidad y cierre antes de darse por completada:

1. **Contratos & Tipos (SDD)**:
   - Toda modificación en DTOs o esquemas Zod en `packages/shared` compilada con `npm run build:shared`.
   - `npx tsc --noEmit` verificado sin ningún error de tipos en la raíz y en cada workspace afectado.
2. **Pruebas Automatizadas (TDD)**:
   - Escenarios BDD cubiertos con tests unitarios (`test:api`, `test:web`, `test:mcp`) o integración (`test:api:integration` en Dev `:5679`).
   - El gate obligatorio `npm run check:quick` finaliza con código de salida `0` (build shared + typecheck monorepo + unit tests).
   - Cero promesas no manejadas, advertencias en `stderr` o errores en consola de pruebas.
3. **Guardrails Inmutables de Base de Datos y Negocio**:
   - 🚨 Verificado: Cero referencias o conexiones al puerto `5678` (aislado para Dev `:5679` o Staging `:5680`).
   - Dinero procesado exclusivamente mediante `toNum()` de `money.util.ts` (`Decimal(12,2)`).
   - Soft-delete respetado en todas las consultas (`deletedAt: null`).
   - Control optimista de concurrencia implementado con `version Int` (retorno HTTP 409 Conflict ante choques).
   - Side effects (SSE `broadcastDatos`, notificaciones) emitidos **solo tras el commit** exitoso de la transacción.
4. **Formateo Incremental de Código**:
   - `npm run format` ejecutado y aplicado sobre los archivos modificados. (Archivos `.md` quedan deliberadamente fuera del formateo Prettier para preservar legibilidad de tablas).
5. **Frontend, React y PWA (si aplica)**:
   - Clases canónicas de Tailwind v4 sin tokens ficticios.
   - Rules of Hooks cumplidas (guards y retornos siempre después de todos los hooks).
   - Operaciones sin conexión tratadas con optimismo e inyección en outbox local (`isQueuedError`), sin toast de error de red fatal.
   - Vista móvil verificada en 375px sin scroll o desbordamiento horizontal.
6. **Seguimiento y Registro de Aprendizaje**:
   - [`STATE.md`](STATE.md) actualizado con el resumen de la sesión, evidencia de tests ejecutados, tareas pendientes y siguientes pasos.
   - Lecciones operativas o postmortems complejos documentados en [`.agents/memories/`](.agents/memories/).
7. **Control de Versiones y Entrega**:
   - Commits atómicos con convención Conventional Commits obligatoria (`feat(web):`, `fix(api):`, `chore(agents):`) para `release-please`.

---

## 7. Orquestación y Flujo de Trabajo

- **Antes de empezar**: Revisa los [protocolos de agente](#8-referencias-contextuales). Usa **Agente Autónomo** al implementar/verificar cambios y **Debug de Flujo** ante bugs o test rotos. Delega en los agentes personalizados cuando la tarea lo requiera (schema, API, ADR, UI, E2E, staging/MCP).

1. **Ciclo de Edición**: Tras modificar código, ejecutar `npx tsc --noEmit` y la prueba unitaria de la ruta afectada.
2. **Formateo Incremental**: Ejecutar `npm run format` tras implementar y antes de commitear. Es **incremental por diseño**: `scripts/format.mjs` solo formatea lo que Git ve cambiado (staged + modificados + untracked), nunca el repo completo. Reglas:
   - El formateo es **parte del paso del agente**, no una extensión del editor: no hay `formatOnSave`. Los archivos que edite el agente deben quedar formateados porque él corre el comando.
   - **No** agregues `format:check` a `check:quick`. El gate principal es obligatorio y el repo tiene cientos de archivos legacy sin formatear; un check global lo rompería de forma permanente sin valor real.
   - **Markdown queda fuera del scope**: `.md` no se formatea (tablas realineadas y líneas en blanco son ruido puro en la documentación que el agente lee).
   - Para acotar el alcance: `npm run format -- apps/web/src`. Para otra base: `FORMAT_BASE=origin/main npm run format`.
3. **Cero Ruido en Tests**: Garantizar que `npm run test` corra limpio sin promesas no manejadas ni advertencias en `stderr`.
4. **Mocks E2E (DOM)**: En specs Playwright que usan un JWT falso, toda llamada `/api/` debe quedar mockeada con el catch-all neutro de `tests/helpers/api-mocks.ts` (`mockAppShellApi`). Una llamada real sin mock con token falso provoca un `401` que dispara el interceptor y redirige a `/login` (flake intermitente según paralelismo).
5. **Gate Pre-Commit / Pre-Push**: Ejecutar `npm run check:quick` antes de cualquier entrega.
6. **Commits Atómicos**: Convención Conventional Commits obligatoria (`feat(web):`, `fix(api):`, `chore(agents):`) para `release-please`.

---

## 8. Referencias Contextuales

- **Documentación de Paquetes**: [apps/api/AGENTS.md](apps/api/AGENTS.md) | [apps/web/AGENTS.md](apps/web/AGENTS.md)
- **Gobernanza del Sistema**: [Marco de Gobernanza](docs/gobernanza.md) | [PRD Central](PRD.md) | [Prompt Maestro](PROMPT-MAESTRO.md) | [Especificaciones SDD+BDD](specs/README.md) | [Estado y Seguimiento](STATE.md)
- **Skills** (flujos on-demand en el contexto del agente activo):
  - [Agente Autónomo](.agents/skills/agente-autonomo/SKILL.md): ciclo de vida autónomo con gates obligatorios y auto-verificación. Úsalo al implementar, refactorizar o verificar cambios.
  - [Debug de Flujo](.agents/skills/debug-flujo/SKILL.md): resolución sistemática de bugs con límite de iteraciones. Úsalo ante tests rotos, errores de CI o comportamientos inesperados.
- **Agentes Personalizados** (`.agent.md`, espejo en `.agents/agents/`):
  - [db-schema-guardian](.github/agents/db-schema-guardian.agent.md): esquema Prisma, migraciones, soft delete y enums Zod/PG.
  - [api-contract-enforcer](.github/agents/api-contract-enforcer.agent.md): envelope de colecciones (ADR 005), `listar()`, `unwrapList`, DTOs y vistas públicas.
  - [auditor-adr](.github/agents/auditor-adr.agent.md): auditoría **solo lectura** del diff contra los ADRs de dinero, concurrencia, SSE, TZ y write fencing.
  - [web-ui-guardrails](.github/agents/web-ui-guardrails.agent.md): Next.js 16, TanStack Query, Rules of Hooks, Tailwind v4 y offline/outbox.
  - [e2e-flake-guard](.github/agents/e2e-flake-guard.agent.md): specs Playwright y prevención del flake de `/login` por fugas de `/api/`.
  - [release-ops](.github/agents/release-ops.agent.md): staging, suites de prod, `deploy:status` y Conventional Commits para `release-please`.
  - [mcp-server-dev](.github/agents/mcp-server-dev.agent.md): tools de `apps/mcp`, `x-api-key` rol `RECEPCION` y control de versión.
- **Documentación del Proyecto**: [Índice General](docs/README.md) | [Design System](docs/design-system.md) | [ADRs (001 a 015)](docs/adr/README.md)
