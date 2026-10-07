# Architecture Decision Records (ADRs)

Decisiones de arquitectura aceptadas del proyecto Parapente School. Ordenadas por
numeración estable (secuencia de decisión, no de fecha de archivo).

| # | ADR | Estado | Resumen |
|---|-----|--------|---------|
| 001 | [Stack y Arquitectura](./001-stack-y-arquitectura.md) | Aceptado | Next.js 16 / Fastify 5 / PostgreSQL 18.4 / Prisma 6 / TanStack Query 5; modelo de datos y convenciones |
| 002 | [Arquitectura Monorepo](./002-monorepo-y-arquitectura.md) | Aceptado | npm workspaces: `apps/web`, `apps/api`, `packages/shared` |
| 003 | [Modular Básica vs Premium](./003-modular-basica-premium.md) | Aceptado | Activación runtime de módulos premium vía `modules.config.json` + SSE |
| 004 | [Sincronización Multicliente](./004-sincronizacion-multicliente.md) | Aceptado | Concurrencia optimista (`version` + endpoint atómico + `409`) y SSE |
| 005 | [Rendimiento y Datos](./005-rendimiento-datos.md) | Aceptado e implementado | Contrato de listados, TanStack Query (reemplaza SWR), keyset cursor, pushdown |
| 006 | [Soft Delete y Enums](./006-soft-delete-enums.md) | Aceptado | Borrado lógico con `deletedAt` y enums nativos alineados con Zod |
| 007 | [Tiempo Real (SSE)](./007-tiempo-real-sse.md) | Aceptado | Bus de eventos SSE y revalidación quirúrgica de TanStack Query |
| 008 | [Dinero Decimal](./008-dinero-decimal.md) | Aceptado | `Decimal(12,2)` + `toNum()`; sin aritmética directa sobre `Decimal` |
| 009 | [Offline-first y Conflictos](./009-offline-first-conflictos.md) | Aceptado e implementado | Persistencia TanStack Query en IDB + outbox en IDB + Workbox `ignoreVary` + replay dedupe |
| 010 | [Cliente API Tipado](./010-cliente-api-tipado.md) | Aceptado e implementado | Contrato first: fetchers tipados (`typedApi`) desde los Zod de `shared` |
| 011 | [Observabilidad](./011-observabilidad.md) | Aceptado e implementado | OTel + Prometheus (`/metrics`) + Sentry; métricas de 409 y del bus SSE |
| 012 | [Write-Fencing Primary](./012-write-fencing-primary.md) | **Propuesto** | Dispositivo primario local: no-primary queda read-only offline (bloqueo cliente, sin backend) |
| 013 | [Single-Session](./013-single-session.md) | Aceptado e implementado | 1 sesión viva por usuario: nuevo login revoca las anteriores vía claim `sv` y `sessionVersion` |
| 014 | [Separación Lógica y UI](./014-separacion-logica-ui.md) | Aceptado | Patrón Headless Controller Hooks + Componentes Presentacionales; regla < 300 líneas y desacoplo de dominio |
| 015 | [Fuente de Verdad del Esquema](./015-fuente-de-verdad-esquema.md) | Aceptado e implementado | `schema.prisma` + baseline de migraciones limpio; deploy sin `--accept-data-loss` |

## Propuestos y En Progreso

- **ADR 009**: Aceptado e implementado al 100% (persistencia IDB, outbox, dedupe server-side, navegación offline Workbox con `ignoreVary` y suite E2E de producción `npm run test:prod`).
- **ADR 013**: Aceptado e implementado (campo `sessionVersion` en User, emisión de claim `sv` en JWT y validación en plugin auth Fastify).
- **ADR 014**: Aceptado (separación de lógica de UI, modularización de controladores en sub-hooks atómicos y simetría en backend).
- **ADR 015**: Aceptado e implementado (baseline `20260930000000_baseline_inicial` verificado con diff cero contra la DB dev; deploy de prod sin `--accept-data-loss`).
- **ADR 012**: Propuesta de arquitectura para resiliencia offline complementaria (dispositivo primario sin backend). Pasa a "Aceptado" al implementarse.

## Relaciones entre ADRs

- **ADR 005 supersede la decisión de SWR** del ecosistema web: a partir del Pilar 5 el
  fetching estandarizado usa TanStack Query (ver también ADR 004 y ADR 007).
- **ADR 004 es la base de concurrencia** reutilizada por Reservas, Vuelos, Pagos y
  mantenimiento (ver [`../auditorias/auditoria-1.md`](../auditorias/auditoria-1.md)).
- **ADR 007 (SSE)** es el mecanismo de push que alimenta la revalidación de ADR 005 y el
  runtime de módulos de ADR 003.
- **ADR 006 (soft delete)** y **ADR 008 (dinero)** son decisiones transversales de
  integridad referenciadas desde ADR 001 y ADR 005.
- **ADR 012 (dispositivo primario)** es una capa de prevención cliente-only sobre ADR 009:
  durante caídas, los dispositivos no-primary se bloquean en el cliente (toast, sin
  encolar) antes de escribir, reduciendo conflictos por doble-escritura a ~0 sin
  backend nuevo. No usa el `X-Client-Id` del server; solo un `deviceId` estable local
  y el estado `online` de `useOnlineStatus`.
- **ADR 013 (single-session)** es la frontera de seguridad en el server que complementa
  al ADR 012: limita a 1 el número de JWT válidos por usuario (nuevo login revoca los
  anteriores vía `sessionVersion`), reduciendo la superficie offline a un solo escritor
  potencial por usuario. ADR 012 actúa durante la caída (UI); ADR 013 actúa antes
  (al loguearse, requiere red). Se refuerzan mutuamente.

## Convención de numeración

Los números son estables: al añadir un ADR nuevo se usa el siguiente entero libre,
independientemente de la fecha. No se reutilizan números ni se renumeran ADRs existentes
salvo reestructuración explícita (p. ej. la fusión de los antiguos ADR 001 "Stack" y
"Resumen de Arquitectura" en el actual ADR 001, 2026-08-18).
