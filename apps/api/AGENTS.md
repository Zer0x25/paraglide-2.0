# AGENTS.md — apps/api

Fastify 5 + Prisma + PostgreSQL (puerto dev 5679).

## Guardrails de Backend

| Dominio | Regla Obligatoria | Prohibido / Evitar |
| :--- | :--- | :--- |
| **Dinero** | `toNum()` de `services/money.util.ts` (`Decimal(12,2)`) | Operadores JS nativos (`+`, `-`, `>=`) sobre `Decimal` |
| **Listados** | Helper `listar()` (`services/pagination.util.ts`), con `return await listar(...)` dentro de `try` | `prisma.findMany()` sin `take`; `return listar(...)` sin `await` en un `try/catch` (deja el `catch` inalcanzable → 500 en cascada) |
| **Soft Delete** | Extension Prisma auto-filtra `deletedAt: null` (alcance y matizes abajo) | Bypass con consultas raw sin filtro `deletedAt`; asumir cobertura en `findUnique` o en clientes de `$transaction` (no la aplican) |
| **Borrados en cascada** | Borrado lógico de filas hijas (`updateMany` + `deletedAt`) antes que `deleteMany` | `delete`/`deleteMany` físico sobre `Pasajero` (el `onDelete: Cascade` destruye `DeslindeFirma` y `Vuelo`) |
| **Secretos** | Comparar API keys/secretos con `crypto.timingSafeEqual` (guard de longitud) | Comparación `===` de secretos en `plugins/auth.ts` |
| **Agregaciones** | Pushdown a DB (`groupBy`, `aggregate`, `$queryRaw`) | Sumas/cálculos masivos en memoria con `forEach` |
| **Concurrencia** | Campo `version Int` + endpoint atómico en transacción (`409`) | Mutaciones basadas en toggles ciegos |
| **Enums** | Enums nativos PG sincronizados con Zod `@parapente/shared` | Strings arbitrarios o desalineados con Zod |

## Contrato de Endpoints de Colección (ADR 005)
- Respuesta estandarizada: `{ data, pagination: { page, pageSize, total, totalPages, hasMore, nextPage, nextCursor } }`.
- Límite estricto: `pageSize <= 500`.
- Keyset cursor (`nextCursor`) para feeds continuos (ej. Auditoría). Offset para vistas tabulares filtradas.

## Alcance de la Extensión Soft Delete (ADR 006)
- Se aplica a `findMany`, `findFirst`, `count`, `aggregate` y `groupBy`. **No** cubre `findUnique`/`findUniqueOrThrow` ni los clientes de transacción (`tx`): allí el filtro `deletedAt: null` va explícito en el `where`.
- La inyección solo ocurre cuando `where.deletedAt === undefined`; pasar `deletedAt: {}` o un valor explícito la bypasea a propósito (p. ej. para sincronizar con Google Calendar los vuelos recién eliminados).

## Referencias Clave
- ADRs de Datos: `docs/adr/005-rendimiento-datos.md`, `docs/adr/006-soft-delete-enums.md`, `docs/adr/008-dinero-decimal.md`.
- Concurrencia y Tiempo Real: `docs/adr/004-sincronizacion-multicliente.md`, `docs/adr/007-tiempo-real-sse.md`.
