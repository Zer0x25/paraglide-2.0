# ADR 015: Fuente de Verdad del Esquema — `schema.prisma` + Baseline de Migraciones

## Estado
**Aceptado e implementado** (2026-09-30, verificado con `prisma migrate deploy` sobre DB vacía y diff cero contra la DB dev).

## Fecha
- **Propuesta**: 2026-09-30.

## Contexto

El repo nació con una migración inicial (`20260429132305_init`) que creaba solo 3 tablas
(`Piloto`, `Pasajero`, `Vuelo`) con el esquema antiguo (`Float` para pesos/dinero, `TEXT` para
estados). Desde entonces, **todos** los cambios de esquema (enums nativos, `Decimal(12,2)`,
soft delete, `version`, `tokenPublico`/`shortId`, `FeedTokenRotacion`, …) se sincronizaron con
`prisma db push` en todos los flujos (deploy de producción, `staging:seed`, setup local del
README). La carpeta `apps/api/prisma/migrations/` quedó **obsoleta y engañosa**: un
`prisma migrate deploy` con ese historial construiría un esquema falso que no corresponde a la
aplicación.

Además, el deploy de producción ejecutaba `prisma db push --accept-data-loss`: un cambio de
esquema destructivo (drop/rename de columnas) se aplicaría **silenciosamente** en un deploy
desatendido, sin revisión ni backup (los backups automatizados están previstos como último paso
antes de la puesta en producción real).

Objetos que viven **fuera** de `schema.prisma` y se crean con
[`apps/api/scripts/indexes-especiales.ts`](../../apps/api/scripts/indexes-especiales.ts)
(idempotente, se ejecuta tras cada sincronización de esquema): índices parciales
(`WHERE deletedAt IS NULL`), BRIN sobre `vuelos.fechaHora` y GIN con `pg_trgm` para búsquedas
`ILIKE`. Prisma no puede declararlos en el schema y tampoco los detecta al hacer diff.

## Decisión

1. **La fuente de verdad del esquema es `apps/api/prisma/schema.prisma`**. El flujo operativo de
   sincronización sigue siendo `prisma db push` + `indexes-especiales.ts` + seed, tanto en local
   como en staging y producción.
2. **`apps/api/prisma/migrations/` contiene un único baseline**
   (`20260930000000_baseline_inicial`) generado con
   `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`,
   sin ediciones manuales. Reproduce el esquema completo actual (28 tablas, enums nativos,
   índices declarables). **Verificado**: `prisma migrate deploy` sobre una DB vacía produce un
   esquema idéntico al de la DB dev (diff vacío); los objetos no gestionados por Prisma los
   aporta `indexes-especiales.ts` como siempre.
3. **El deploy a producción ya no usa `--accept-data-loss`**. Un cambio destructivo hace fallar
   el deploy a propósito: exige revisión humana y aplicación manual (idealmente con backup
   previo). Los entornos desechables (staging/seed) sí pueden seguir usándolo.
4. **Adopción futura de una DB existente** (cuando se quiera operar con `migrate deploy`):
   `npx prisma migrate resolve --applied 20260930000000_baseline_inicial` (solo si la DB ya
   tiene el esquema creado por `db push`) y a partir de ahí `migrate deploy`. El baseline se
   puede regenerar en cualquier momento con el mismo comando si el schema cambia antes de la
   adopción (basta reemplazar el contenido de la carpeta de la migración).

## Alternativas consideradas

- **Mantener la migración `20260429132305_init` obsoleta**: descartada — es un artefacto
  activamente engañoso (construye un esquema que no corresponde a la app).
- **Migrar ya a `prisma migrate deploy` en el pipeline de producción**: descartada por ahora —
  exige baselinar cada entorno existente, cambiar el pipeline de prod sin poder probarlo contra
  la DB real, y la disciplina de generar un archivo de migración en cada cambio de schema. Queda
  como la evolución natural; el baseline la habilita.
- **Borrar las migraciones y no tener baseline**: descartada — se pierde la capacidad de
  reconstruir un entorno desde cero con un historial versionado y de adoptar `migrate` a futuro.

## Consecuencias

- **Positivas**:
  - La carpeta de migraciones deja de mentir: el baseline es exactamente el schema actual.
  - Bootstrap reproducible de entornos nuevos: `prisma migrate deploy` + `indexes-especiales.ts`
    + seed (o directamente `db push`, que produce el mismo resultado).
  - El deploy de producción ya no puede perder datos de forma silenciosa.
  - Camino documentado para adoptar `migrate deploy` completo cuando se desee.
- **Negativas / riesgos**:
  - No hay historial de migraciones de los cambios intermedios (se reconstruye solo el estado
    actual); si en el futuro se adopta `migrate deploy`, la historia empieza desde el baseline.
  - `db push` sigue sin dejar rastro versionado: quien cambie el schema debe seguir el flujo
    documentado (`db push` + `indexes-especiales.ts` en todos los entornos).
  - Un cambio destructivo futuro hará fallar el deploy hasta que se revise y aplique a mano
    (comportamiento deseado, pero exige atención humana).
