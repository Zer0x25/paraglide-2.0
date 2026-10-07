# ADR 005: Estrategia de Datos y Rendimiento — Contrato de Listados, Fetching y Visualización

## Estado
Aceptado e implementado (2026-08-18) — Contrato v2 + Pilar 5 completos: SWR sacrificado por TanStack Query.

## Fecha
- **Aceptado e implementado**: 2026-08-18 (Pilar 5: TanStack Query reemplaza SWR; keyset cursor; pushdown).

## Contexto
Las páginas de operación (calendario, reservas, pilotos) cargan **todos** los registros de la base sin filtros ni límites: `GET /vuelos`, `GET /reservas`, `GET /pilotos`, `GET /pasajeros` devuelven la tabla completa en cada carga (el calendario dispara 5 consultas sin límite en paralelo y filtra todo en el cliente). Con meses de datos operativos esto provoca:

- Queries de escaneo completo (full scan) sin usar los índices existentes (`fechaHora`, `fechaReserva`).
- Payloads JSON enormes que saturan memoria del API y del navegador (se ha observado caída de la DB/API al cargar el calendario con 12 meses de datos).
- Latencia creciente con el volumen; sin límites duros el sistema degrada linealmente.

Se requiere una estrategia **de arquitectura** (no parches): un contrato de datos uniforme, fetching estandarizado y visualización por rango/windowing, con normas que impidan volver al anti-patrón.

## Decisión

### 1. Contrato de API para listados (todos los endpoints de colección) — v2

`GET /{recurso}` responde SIEMPRE un envelope:

```json
{
  "data": [ ... ],
  "pagination": { "page": 1, "pageSize": 100, "total": 1234, "totalPages": 13, "hasMore": true, "nextPage": 2, "nextCursor": null }
}
```

- **Parámetros estándar** (validados con Zod en `@parapente/shared`):
  - `page` (1-based, default 1), `pageSize` (default 100, **máximo forzado 500**).
  - `sort` opcional `campo.desc|asc` con whitelist por recurso.
  - **Contrato v2 — keyset `cursor`**: para listas temporales no acotadas (auditoría), `cursor=<id de la última fila>` reemplaza al offset (sin `skip` O(n) ni `totalPages` costoso). El envelope devuelve `pagination.nextCursor` (null si no hay más) y `nextPage` (offset + 1, para `useInfiniteQuery` basado en páginas). **Semántica real (implementada)**: el servidor emite `nextCursor` **también en la primera página offset** (es el id de la última fila), de modo que el cliente migra a keyset desde la página 2 — estable bajo escrituras concurrentes, sin duplicados.
  - Filtros propios por recurso, siempre servidos por SQL (`where` de Prisma, usando índices):
    - `vuelos`: `desde`, `hasta` (rango sobre `fechaHora`, índice compuesto `(fechaHora, estado)`), `estado`, `campos=vista-calendario` (proyección).
    - `reservas`: `q` (nombreTitular/rutDniTitular/email/telefono/numeroReserva + pasajeros.nombre/rutDni, `contains` case-insensitive — índice GIN pg_trgm), `estado` (estadoPago), `desde`, `hasta` (fechaReserva).
    - `pilotos`: `q` (nombre), `activo`.
    - `pasajeros`: `q` (nombre).
    - `equipos`: `tipo`, `estado`.
    - `gastos`: `desde`, `hasta`.
    - `auditoria`: `entidad`, `accion`, `busqueda`, **`cursor` (keyset por id desc)** — única lista no acotada hoy.
- **Norma dura**: ningún `findMany` sin `take` (el helper `listar` lo fuerza); ningún filtrado/ordenación de listados en el cliente.
- Las mutaciones (`POST/PUT/PATCH/DELETE`) no cambian. Los endpoints singleton (dashboard/stats, metricas, configuracion-bloques, disponibilidad) no cambian.

### 2. Fetching estandarizado en el web (TanStack Query — reemplaza a SWR)

Decisión 2026-08-18: **SWR se sacrifica por TanStack Query** (ver Alternativas). El proyecto ya no es un MVP; TanStack aporta:

- **`useInfiniteQuery` first-class** (cursor u offset): listas infinitas bajo demanda con `fetchNextPage`/`hasNextPage` — el patrón de UI moderno (scroll infinito) en vez de botones de página.
- **Invalidación quirúrgica estructurada**: `queryKey` como array serializable con **prefix matching** — el SSE de `useDatosStream` hace `invalidateQueries({ queryKey: ['vuelos', 'calendario'] })` y solo se recarga lo afectado (antes: `mutate` de strings manual).
- **`useMutation`** con ciclo de vida completo y optimistic rollback para las mutaciones frecuentes.
- **Devtools** (TANStack Query DevTools) y mejor inferencia de tipos; SSR/RSC maduro si hace falta prefetch.
- **Unwrap único**: `unwrapList()` acepta array (compat tests) o envelope y devuelve `data`.
- **Norma**: prohibido `useEffect` + `setState` + `api.get` crudo para listados; hooks con `queryKey` estable (`['vuelos', { desde, hasta }]`).

### 3. Visualización — Pilar 5: listas infinitas bajo demanda ✅

- **Calendario scoped por mes**: `GET /vuelos?desde=&hasta=` con el rango del mes visible; refetch al navegar (nunca carga el histórico completo). ✅
- **Listas infinitas** (`useInfiniteQuery` + `pageSize`): **auditoría** con keyset `cursor` y botón "Cargar más" (reemplaza la paginación por páginas); **reservas** con filtros server-side (tabs `PROXIMAS/PASADAS` → `desde/hasta`, búsqueda → `q` con debounce, pago → `estado`) y "Cargar más". ✅
- **Virtualización** (`@tanstack/react-virtual`): feed de auditoría con windowing (solo se montan filas visibles). ✅
- **Alcance deliberado**: pilotos/pasajeros/gastos/equipos/plantillas siguen en query plana (`pageSize` 500): filtran en cliente (buscar/ordenar en la página) y su escala es manejable. Convertirlos a infinito exige mover esos filtros al servidor primero (ver Norma 7). El `q` de reservas se extendió para cubrir la paridad de búsqueda del cliente (incluye pasajeros).
- **Proyección**: el calendario pide solo los campos de la grilla (`campos=vista-calendario`). ✅
- **Analíticas**: cómputo agregado server-side (pushdown). ✅

### 4. DB y resiliencia ✅

- Índice compuesto `(fechaHora, estado)` + `(fecha, categoria)` + `(estadoPago, fechaReserva)` + `(activo, prioridad)`. ✅
- BRIN en `vuelos.fechaHora`, GIN pg_trgm en búsquedas, parcial `WHERE deletedAt IS NULL` (script `indexes-especiales.ts`). ✅
- Pushdown de agregaciones en metricas/dashboard (`groupBy`/`aggregate`/`$queryRaw`). ✅
- Tuning Postgres en Docker (`shared_buffers`, `work_mem`, autovacuum) + pool Prisma `?connection_limit=10` en la connection string. ✅
- Particionado por rango para `Vuelo` solo si supera ~100k filas (futuro, no ahora).

## Normas de estandarización (enforced en AGENTS.md)

1. Todo listado nuevo: filtros + sort + paginación en el API con `listar()`; jamás `findMany` sin `take`.
2. Toda query de listados en el web: hook TanStack Query con `queryKey` estable; prohibido fetch crudo en `useEffect`.
3. Nunca traer ni filtrar en cliente conjuntos > 500 filas.
4. Toda vista de datos temporales: siempre scoped por rango de fechas.
5. Parámetros de query y envelope tipados en `@parapente/shared` (Zod).
6. Listas no acotadas (auditoría): keyset `cursor`, no offset.
7. Filtros en el cliente SOLO para atributos derivados de datos anidados no servibles (ej. agendamiento/deslinde de reservas); todo filtro mapeable a SQL viaja al servidor antes de pensar en listas infinitas.

## Alternativas consideradas

- **GraphQL**: sobre-ingeniería para este dominio; REST con filtros cubre el 100% de las consultas.
- **Cursor pagination en todo**: mejor para tablas volátiles muy grandes, pero `page/pageSize` es suficiente para las listas acotadas; keyset solo donde crece sin límite (auditoría).
- **SWR en vez de TanStack Query**: inicialmente se estandarizó sobre SWR (caché + dedupe + revalidación SSE); **revisado 2026-08-18**: sus listas infinitas son de segunda clase (solo páginas, sin cursores), la invalidación quirúrgica es manual por strings y no tiene mutations tipadas. Al no ser ya un MVP, se migra a TanStack Query (mismo precio conceptual, más primitivas modernas). **Migración completada 2026-08-18** (commits `b206c7d`→`4b49dfa`): `swr` eliminado del package.json; los tests pasan con wrapper `src/test/render.tsx`.
- **Envelope opcional (solo con params)**: descartado — dos formas de respuesta crean legacy y confusión.
