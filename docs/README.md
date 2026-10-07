# 📚 Documentación del Sistema — Parapente School

Portal central de documentación de arquitectura, diseño, hojas de ruta y auditorías del monorepo.

---

## 🏛️ Architecture Decision Records (ADRs)

Registro ordenado de las decisiones técnicas y arquitectónicas que guían el desarrollo del sistema en [`docs/adr/`](./adr/README.md):

| Grupo | ADRs Destacados | Enfoque Principal |
| :--- | :--- | :--- |
| **Fundamentos & Monorepo** | [ADR 001](./adr/001-stack-y-arquitectura.md), [ADR 002](./adr/002-monorepo-y-arquitectura.md), [ADR 003](./adr/003-modular-basica-premium.md) | Next.js 16, Fastify 5, `@parapente/shared`, activación runtime de módulos premium (`modules.config.json` + SSE). |
| **Concurrencia & Tiempo Real** | [ADR 004](./adr/004-sincronizacion-multicliente.md), [ADR 007](./adr/007-tiempo-real-sse.md) | Concurrencia optimista (`version Int` + `409 Conflict`), endpoints atómicos y revalidación quirúrgica vía SSE. |
| **Rendimiento & Datos** | [ADR 005](./adr/005-rendimiento-datos.md), [ADR 006](./adr/006-soft-delete-enums.md), [ADR 008](./adr/008-dinero-decimal.md) | Contrato de listados (`listar()`), keyset cursor, soft-delete global con `deletedAt`, enums nativos PG y dinero en `Decimal(12,2)` (`toNum()`). |
| **Resiliencia, Tipado & Ops** | [ADR 009](./adr/009-offline-first-conflictos.md), [ADR 010](./adr/010-cliente-api-tipado.md), [ADR 011](./adr/011-observabilidad.md), [ADR 012](./adr/012-write-fencing-primary.md), [ADR 013](./adr/013-single-session.md) | Sincronización offline-first, cliente tipado end-to-end (`typedApi`), observabilidad (OTel/Prometheus/Sentry), dispositivo primario y revocación de sesión. |
| **Arquitectura de Frontend** | [ADR 014](./adr/014-separacion-logica-ui.md) | Desacoplamiento de lógica y UI, Headless Controller Hooks (< 300 líneas) y componentes presentacionales. |
| **Esquema & Deploys** | [ADR 015](./adr/015-fuente-de-verdad-esquema.md) | `schema.prisma` como fuente de verdad, baseline de migraciones verificado y deploys sin pérdida de datos silenciosa (`db push` sin `--accept-data-loss`). |

---

## 🎨 Diseño & UI/UX

* [`docs/design-system.md`](./design-system.md): Estándar visual de `apps/web` (Tailwind v4 CSS-first, tokens semánticos en `:root` y `.dark`, componentes accesibles WCAG AA y directrices de diseño móvil).

---

## 📊 Diagramas de Flujo & Arquitectura Técnica

* [`docs/diagrams/`](./diagrams/README.md): Portal completo de diagramas de flujo técnicos en Mermaid.js (`flowchart TD`) para todos los módulos del sistema con matrices de referencia cruzada hacia el código fuente.
  * Incluye el flujo de integración de IA y herramientas MCP: [`09_mcp_server_flow.md`](./diagrams/09_mcp_server_flow.md).

---

## 🗺️ Planificación, Calidad & Evolución

* [`docs/roadmap.md`](./roadmap.md): Hoja de ruta funcional y evolutiva del sistema por fases técnicas y operativas (Fases 1 a 10).
* [`docs/plan-calidad-y-refactor.md`](./plan-calidad-y-refactor.md): **Plan maestro técnico unificado**:
  1. **Arquitectura Modular Agent-Friendly** (ADR 014 y modularización < 300 líneas).
  2. **Pirámide de Pruebas Antirregresión** (11 suites de integración DEV en `:5679` y suites Staging).
  3. **Higiene de Código & Linter** (reducción medible de deuda ESLint vía `npm run lint:report`).

---

## 📂 Auditorías y Certificaciones Históricas

* [`docs/auditorias/certificacion-rutas-e2e.md`](./auditorias/certificacion-rutas-e2e.md): Certificación y verificación E2E de las 19 rutas operativas del sistema *(100% Certificado en Producción)*.
* [`docs/auditorias/auditoria-1.md`](./auditorias/auditoria-1.md): Auditoría inicial de integridad de base de datos y concurrencia multicliente *(100% Implementada)*.
* [`docs/auditorias/verificacion-2026-09-29.md`](./auditorias/verificacion-2026-09-29.md): Verificación integral del monorepo — bugs corregidos en API/MCP/Web (integridad de datos, TZ, outbox, flakiness E2E) y backlog priorizado de hallazgos pendientes.

---

## 🤖 Guías para Asistentes y Desarrolladores

* [`AGENTS.md`](../AGENTS.md): Reglas inmutables, comandos rápidos y guardrails de desarrollo para asistentes de código y desarrolladores.
* [`apps/api/AGENTS.md`](../apps/api/AGENTS.md): Reglas específicas de backend, datos, dinero y paginación.
* [`apps/web/AGENTS.md`](../apps/web/AGENTS.md): Reglas específicas de frontend y Next.js 16.

### Agentes Personalizados

Definiciones en [`.github/agents/`](../.github/agents) (espejo en [`.agents/agents/`](../.agents/agents)), formato `.agent.md`. Complementan a las skills de protocolo ([`agente-autonomo`](../.agents/skills/agente-autonomo/SKILL.md), [`debug-flujo`](../.agents/skills/debug-flujo/SKILL.md)) acotando **qué superficie del repo** toca cada rol:

| Agente | Superficie | Modo | Gate propio |
| :-- | :-- | :-- | :-- |
| [`db-schema-guardian`](../.github/agents/db-schema-guardian.agent.md) | `apps/api/prisma`, soft delete, enums | Escritura | `test:api:integration` |
| [`api-contract-enforcer`](../.github/agents/api-contract-enforcer.agent.md) | Endpoints, paginación, DTOs, `packages/shared` | Escritura | `build:shared` + `test:api` |
| [`auditor-adr`](../.github/agents/auditor-adr.agent.md) | Diff contra ADRs 004-015 | **Solo lectura** | ninguno (informe) |
| [`web-ui-guardrails`](../.github/agents/web-ui-guardrails.agent.md) | `apps/web` (Next.js 16 + PWA) | Escritura | `test:web` + `lint` |
| [`e2e-flake-guard`](../.github/agents/e2e-flake-guard.agent.md) | `apps/web/tests` (Playwright) | Escritura | `test:e2e` con `--repeat-each=3` |
| [`release-ops`](../.github/agents/release-ops.agent.md) | Staging, prod, CI, `release-please` | Escritura | `check:quick` + `test:staging:quick` |
| [`mcp-server-dev`](../.github/agents/mcp-server-dev.agent.md) | `apps/mcp` | Escritura | `test:mcp` |

> Los agentes heredan las reglas de [`AGENTS.md`](../AGENTS.md). Ninguno puede escribir en el puerto **5678** (DB de producción).
