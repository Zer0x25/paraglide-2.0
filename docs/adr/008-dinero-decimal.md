# ADR 008: Manejo de Dinero con Decimal

## Estado
Aceptado

## Fecha
- **Aceptado**: Fase 4 (Integridad del esquema / hardening) — 2026.
- **Última revisión**: 2026-08-18 (documentado; unificación de numeración).

## Contexto
El dinero (`Pago`, importes de `Vuelo`/`Reserva`) debe ser exacto: los `float`/JS `number` introducen errores de redondeo en sumas y comparaciones. Se necesita una representación y una API de cálculo coherentes entre Prisma/Postgres y el cliente.

## Decisión
- **Tipo en DB**: `Decimal(12,2)` en `schema.prisma`.
- **Serialización**: el API serializa el `Decimal` como `number` (serializer global en `apps/api/src/app.ts`) para que el cliente reciba un número plano.
- **Aritmética en backend**: nunca usar `+` / `>=` / `<=` directamente sobre un `Decimal`. Usar `toNum()` desde `apps/api/src/services/money.util.ts` antes de cualquier operación, o las operaciones nativas de `Decimal.js`.
- El cliente trata los importes como `number` para mostrar; la autoridad de cálculo y comparación vive en el backend.

## Consecuencias
- Sin errores de precisión en pagos, saldos ni reportes financieros.
- Cualquier nueva operación monetaria debe pasar por `money.util.ts`; una comparación directa `montoA >= montoB` sobre `Decimal` queda prohibida.

## Relaciones
- **ADR 001** (Stack): modelo de datos y `packages/shared` (los DTO de dinero viajan como `number`).
- **ADR 005** (Rendimiento): las métricas financieras usan `groupBy`/`aggregate`/`$queryRaw` sobre las columnas `Decimal`.
