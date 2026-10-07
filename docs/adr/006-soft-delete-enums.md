# ADR 006: Soft Delete y Enums Nativos Postgres

## Estado
Aceptado

## Fecha
- **Aceptado**: Fase 3 (Soft delete y auditoría consistente) — 2026.
- **Última revisión**: 2026-09-29 (alcance real de la extensión y borrados en cascada).

## Contexto
Se requiere borrado lógico (no físico) para entidades operativas (Gasto, ConfiguracionBloque, HorarioBloque, …) y enumerables tipados de forma estricta tanto en la DB como en el cliente. Los `enum` deben estar alineados con los esquemas Zod de `@parapente/shared` para no desincronizar validaciones.

## Decisión

### Soft delete (Fase 3)
- Los modelos con `deletedAt` llevan borrado lógico. El cliente Prisma (`apps/api/src/plugins/prisma.ts`) se extiende para inyectar automáticamente `deletedAt: null` en `findMany`, `findFirst`, `count`, `aggregate` y `groupBy`.
- **Alcance de la extensión**: no cubre `findUnique`/`findUniqueOrThrow` ni los clientes de transacción (`$transaction(async (tx) => …)`). En esos contextos el filtro `deletedAt: null` debe ir explícito en el `where`.
- **Bypass intencional**: la inyección solo ocurre cuando `where.deletedAt === undefined`. Pasar `deletedAt: {}` o un valor explícito permite leer filas eliminadas a propósito (p. ej. para sincronizar con Google Calendar los vuelos recién eliminados, o para calcular correlativos `numeroPasajero` que no pueden repetirse).
- **Borrados en cascada**: cuando una relación define `onDelete: Cascade` (p. ej. `Pasajero → DeslindeFirma`/`Vuelo`), el borrado de filas hijas se hace con soft-delete (`updateMany` + `deletedAt`), nunca con `deleteMany` físico, para preservar datos legales como las firmas de deslinde.
- No se bypasea este filtro con queries crudas salvo que se quiera leer filas eliminadas explícitamente (p. ej. auditoría/restauración).
- Index parcial `WHERE deletedAt IS NULL` para no degradar las consultas (ver ADR 005).

### Enums nativos alineados con Zod (Fase 2 / integridad)
- Se usan enums nativos de Postgres (`EstadoPago`, `EstadoVuelo`, `MetodoPago`, `TipoEquipo`, `EstadoEquipo`, `EstadoPista`, `CanalMensaje`, `CategoriaPiloto`) definidos en `schema.prisma` y reflejados como Zod en `@parapente/shared`.
- Para migrar un enum con datos existentes se hace con `CAST` (ver `apps/api/scripts/migrar-enums.ts`), no con drop/recreate ciego de columnas.

## Consecuencias
- El borrado lógico es transparente para la mayoría del código (el filtro se inyecta).
- Cualquier consulta que necesite incluir eliminados debe hacerlo explícitamente.
- Los enums quedan como única fuente de verdad tipada; cambiar un valor exige migración + actualización del Zod correspondiente.

## Relaciones
- **ADR 001** (Stack): modelo de datos y `packages/shared`.
- **ADR 005** (Rendimiento): índices parciales sobre `deletedAt`.
