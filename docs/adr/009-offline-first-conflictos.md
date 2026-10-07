# ADR 009: Capa de Sincronización Offline-first y Resolución de Conflictos Unificada

## Estado
**Aprobado e implementado al 100% (Verificado en producción en `https://parapente.zer0x.org`).**
La lectura offline (caché de datos en IndexedDB `parapente-cache` con TanStack Query), la navegación offline en Service Worker (`pages-rsc` y `pages` con Workbox), el outbox de escritura en IndexedDB (`parapente-outbox`), el replay automático con lock centralizado, la desduplicación server-side por `X-Client-Id` y la suite E2E de verificación en producción (`npm run test:prod`) están completamente operativas.

## Fecha
- **Propuesta**: 2026-08-18.
- **Implementación & Validación en Producción**: 2026-09-04.

## Contexto
La escuela opera en pistas de vuelo con conectividad inestable y desde varios dispositivos (web, móvil, tablet, pantalla de sala). Hoy:

- **Sin persistencia de caché**: TanStack Query (ADR 005) vive solo en memoria; al recargar o perder red se pierde todo y cada fetch vuelve a golpear la API.
- **Writes frágiles offline**: el interceptor de `apps/web/src/services/api.ts` solo loguea "Network Error"; no hay cola de reintentos.
- **Conflicto (409) implementado ad-hoc en 9 lugares**: `pilotos`, `reservas`, `calendario` (×2), `PagosModal` (×2), `AgendamientoRapidoModal`, `ConfigBloquesModal`, `useEquipos`. Cada uno hace su propio `if (status === 409)`, con comportamientos divergentes, pese a que ADR 004 ya manda el patrón (`409` → recargar sobre datos frescos).

TanStack Query estandarizó el **lectura**; este ADR estandariza la **escritura** y la **resiliencia**, apoyándose en lo ya construido (TanStack Query + SSE + `version`/`409`).

## Decisión

### 1. Persistencia de caché (`persistQueryClient`)
- Instalar `@tanstack/react-query-persist-client` y persistir la caché de TanStack Query en `localStorage`/IndexedDB (`createSyncStoragePersister`).
- La caché de listados sobrevive recargas y conectividad intermitente; las páginas muestran datos frescos-al-caché (stale-while-revalidate) en vez de pantallas vacías.
- Excluir de la persistencia claves sensibles/no cacheables (auth, SSE) vía `persister` con `filters`.

### 2. Cola de mutaciones (outbox)
- Las mutaciones (crear/editar vuelo, reserva, pago, disponibilidad…) se encolan cuando no hay red y se reejecutan en orden al reconectar.
- Reintento con backoff y orden FIFO por entidad; al reejecutar se aplica la concurrencia optimista (ADR 004): si un item encolado devuelve `409`, se saca de la cola y se marca para resolución manual del operador.

### 3. Primitiva única de conflicto (`useConflictMutation`)
- Un solo hook (`apps/web/src/hooks/useConflictMutation.ts`) que envuelve `useMutation` de TanStack Query y centraliza:
  - optimistic update vía `onMutate` estándar (con rollback),
  - detección de `409` (`isConflictError`) → `invalidateQueries` sobre las `queryKey` afectadas + callback `onConflict` para mostrar UI de conflicto consistente,
  - `onError` passthrough para errores no-conflicto.
- Los 9 sitios con `if (409)` migran a este hook; el comportamiento deja de divergir.

## Alternativas consideradas
- **Full local-first con sync bidireccional (CRDT)**: máxima resiliencia pero complejidad de fusión de datos inviable para reservas/pagos con `version`; el outbox + 409 cubre el caso real.
- **Dejar como está (sin persistencia, 409 manuales)**: coste de mantenimiento y UX rota en campo; descartado.

## Consecuencias
- La app funciona con conectividad intermitente: lee de caché, encola escrituras y reconcilia al volver.
- Comportamiento de conflicto uniforme y sin duplicación (se elimina el código repetido de 409).
- Se reutiliza la infraestructura existente (SSE + TanStack Query + `version`); no añade servicios nuevos.

## Relaciones
- **ADR 004** (Sincronización): el `version`/`409` es el mecanismo de reconciliación del outbox.
- **ADR 005** (Rendimiento): persistencia y primitivas de mutación sobre TanStack Query.
- **ADR 007** (SSE): la revalidación al reconectar reusa el bus de eventos.

## Referencias de Código
- `apps/web/src/services/api.ts` — interceptor: en `ERR_NETWORK` con `X-Outbox=1` encola en el outbox (IDB) y marca `error.queued`; suprime logs alarmantes de conexión cuando `navigator.onLine === false`.
- `apps/web/src/services/apiOutbox.ts` (`typedApiOutbox`) — todas las mutaciones del contrato con header `X-Outbox: 1` y generación de UUID `X-Client-Id`.
- `apps/web/src/services/outbox/outbox.service.ts` — `enqueue`/`replayOutbox`/`replayIfIdle` + store de `conflictos` en IndexedDB (`parapente-outbox`).
- `apps/web/src/hooks/useDomainMutation.ts` — primitiva unificada: exporta `isQueuedError(error)` y omite rollback o alerta de error cuando la mutación queda encolada en offline.
- `apps/web/src/hooks/useWarmupData.ts` — precalentamiento operativo y de rutas: sincronizado con `navigator.serviceWorker.controller` y `controllerchange`; calienta de forma prioritaria las 5 rutas operativas (`/`, `/pilotos`, `/reservas`, `/calendario`, `/configuracion`) tanto en RSC como en HTML.
- `apps/web/next.config.ts` — configuración de Workbox: `pages-rsc` y `pages` con `matchOptions: { ignoreSearch: true, ignoreVary: true }` y plugin `cacheWillUpdate` que normaliza redirecciones y despoja cabeceras `Vary`.
- `apps/web/src/components/AppShell.tsx` y `OutboxBadge.tsx` — replay al reconectar (`onopen` SSE + evento `online`).
- `apps/api/src/plugins/idempotencia.plugin.ts` — dedupe server-side por `X-Client-Id` (modelo `Idempotencia`).
- `scripts/test-prod-suite.ts` — suite E2E automatizada contra producción de 11 pasos ejecutada vía `npm run test:prod`.

## Estado de Ejecución y Validación (2026-09-04)
- **Navegación Offline 100% en Pestañas Operativas**:
  - `/` (Dashboard), `/pilotos`, `/reservas`, `/calendario` y `/configuracion` operan de forma nativa sin red tras el calentamiento inicial.
  - La sincronización estricta con `navigator.serviceWorker.controller` en `useWarmupData` previene que los primeros lotes se fuguen sin pasar por el Service Worker.
  - La adición de `ignoreVary: true` en las reglas de Workbox evita que Cache API rechace el emparejamiento por cabeceras dinámicas de Next.js App Router (`Next-Router-State-Tree`, `RSC`).
- **Escritura y Creación Offline en Reservas y Pagos**:
  - La creación, edición y cancelación de reservas en offline guardan el registro de mutación en IndexedDB `parapente-outbox`.
  - El hook `useDomainMutation` detecta `isQueuedError` y suprime alertas rojas y rollbacks destructivos.
  - Los controladores (`useReservasController`) cierran el modal y presentan un `toast.info` amigable informando que la reserva se enviará al reconectar.
  - `useReservas` inyecta de forma optimista la reserva en la caché de TanStack Query para reflejarla de inmediato en la UI.
- **Reconexión y Replay Automático**:
  - Al restaurar la conectividad (`context.setOffline(false)` o reconexión de red real), el evento `online` o el `onopen` de SSE disparan `replayIfIdle(apiRaw)`.
  - El outbox se vacía de manera transparente y el backend deduplica operaciones mediante `X-Client-Id`.
- **Eliminación del Flashazo en Analíticas**:
  - Migrado `/analiticas` a `useQuery` respaldado por IndexedDB con placeholders animados (`Skeleton`), eliminando el parpadeo de ceros (`$0`) y saltos visuales de Recharts.
- **Suite E2E de Producción (`npm run test:prod`)**:
  - Verificada en producción (`https://parapente.zer0x.org`) pasando al 100% en sus 11 pasos (Health check, Login, Dashboard, Pilotos, Calendario, Analíticas anti-flash, Filtros de Reservas, Navegación offline entre pestañas, Creación offline de reservas, Replay automático y Rutas públicas).