# ADR 010: Cliente API Tipado End-to-End (Contrato First)

## Estado
**Implementado** (2026-08-18).

## Fecha
- **Propuesta**: 2026-08-18.

## Contexto
`@parapente/shared` ya contiene los DTOs y esquemas Zod de los contratos (ADR 005: envelope de listados, query params, DTOs). Pero el web consume la API con **axios manual** (`apps/web/src/services/api.ts`) + `unwrapList()`: cada `api.get`/`api.post` reescribe los tipos a mano (o los infiere del `any`), permitiendo *drift* silencioso entre el contrato real del backend y lo que el cliente cree que recibe.

Los tipos "viajan" en tiempo de diseño pero no se hacen cumplir en cada llamada; un cambio de contrato en `shared` no rompe el build del web hasta que alguien toca la pantalla equivocada.

## Decisión
Establecer un **contrato de API tipado** consumido por el web:

- `@parapente/shared` exporta una definición declarativa de rutas: `api.routes.ts` con `{ method, path, query?, body?, response }` donde cada uno referencia un esquema Zod (reutilizando los ya existentes para envelope/filtros/DTOs).
- `apps/web/src/services/api.ts` se envuelve en una factory `createTypedApi(routes)` que genera por cada ruta un fetcher tipado (`GET /vuelos` → `listarVuelos(params) => Promise<ListaVuelos>`), resolviendo el path con `query`/`body`/`response` tipados.
- Hooks de TanStack Query (`useQuery`/`useMutation`/`useInfiniteQuery`) se construyen sobre esos fetchers tipados; `unwrapList` deja de ser necesario (el `response` ya es el envelope).
- La comprobación se vuelve **compile-time**: si el contrato cambia en `shared`, `tsc --noEmit` del web falla en el punto de uso.

### Alcance
- Se prioriza las colecciones del ADR 005 (`vuelos`, `reservas`, `pilotos`, `pasajeros`, `gastos`, `equipos`, `plantillas`, `auditoria`) y los endpoints singleton de alta frecuencia (`dashboard/stats`, `configuracion-bloques`, `meteorologia`, `eventos`).
- Los endpoints no cubiertos quedan en el axios crudo con un TODO de migración; no se bloquea el avance por cobertura total.

## Alternativas consideradas
- **Generar el cliente desde OpenAPI del backend**: robusto pero introduce un paso de generación y requiere mantener OpenAPI al día; los Zod de `shared` ya son la fuente de verdad.
- **zodios**: SDK maduro que genera cliente desde esquemas Zod; viable como base de la factory si la factory propia crece demasiado.
- **tRPC**: descartado — no encaja con el contrato REST del ADR 005.

## Consecuencias
- El drift de contrato se detecta en build, no en runtime.
- El web deja de adivinar tipos; `unwrapList` y los casts manuales desaparecen.
- La factory tipa también los errores (incluido el `409` del ADR 004/009) para que `isConflictError` no dependa de casts.

## Relaciones
- **ADR 005** (Rendimiento): el envelope y query params tipados en `shared` son la base del contrato.
- **ADR 004 / 009** (Sincronización): errores tipados (409) integrados en la capa de clientes.

## Referencias
- `packages/shared/src` — esquemas Zod existentes (envelope de listados, filtros).
- `apps/web/src/services/api.ts` — axios + `unwrapList` a reemplazar.