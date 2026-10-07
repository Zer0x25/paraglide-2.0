# ADR 007: Tiempo Real — Bus de Eventos SSE y Revalidación Quirúrgica

## Estado
Aceptado

## Fecha
- **Aceptado**: Fase 4 (Concurrencia de nivel medio + sincronización) / Fase 5 — 2026.
- **Última revisión**: 2026-08-18 (documentado; unificación de numeración).

## Contexto
Varios clientes operan la misma DB al mismo tiempo (web, móvil, tablet, pantalla de sala). Además del control de conflictos (ADR 004), los cambios hechos por un dispositivo deben reflejarse en los demás casi en tiempo real, sin polling ni recargas globales.

## Decisión

### Bus de eventos SSE (pub/sub en memoria)
- Autenticación por **ticket de un solo uso** (vida corta, TTL 5 min): el cliente autenticado canjea su JWT por un ticket en `POST /api/eventos/ticket` (header `Authorization`) y abre `GET /api/eventos?ticket=...`, que consume el ticket una única vez. El JWT nunca viaja en la query string (quedaba en logs de proxy, historial y analytics); `EventSource` no admite headers, de ahí el canje. El ticket solo se consume al abrir la sesión: la conexión vive lo que dure, y cada reconexión canjea un ticket nuevo (`services/sse-tickets.service.ts`).
- `services/eventos.service.ts` mantiene un pub/sub en memoria y hace `broadcast(evento, payload)` tras mutaciones relevantes.
- Eventos: `datos-cambios` (mutaciones de pilotos, config-bloques, vuelos, reservas…) y `modulos-cambios` (cambio de `modules.config.json`).

### Revalidación en el cliente (web)
- Hook `useDatosStream` escucha el stream y mapea `{ entidad }` a un prefijo de `queryKey` de TanStack Query:
  - `vuelo` → `['vuelos']`, `configuracion-bloques` → `['configuracion-bloques']`, `piloto` → `['pilotos']`, etc.
  - Entidad desconocida → invalida todo.
- `modulos-cambios` actualiza el runtime de módulos (`modules/runtime.ts`) y el sidebar sin recargar (ver ADR 003).

### Concurrencia optimista + SSE
- El guardado obsoleto devuelve `409 Conflict` (ADR 004); tras un guardado exitoso se hace `broadcast('datos-cambios')` para que los demás clientes revaliden.

## Alternativas consideradas
- **WebSockets**: más potente pero requiere gestión de reconexión/heartbeat; SSE basta para push unidireccional server→cliente y es nativo del navegador.
- **Polling 30s**: descartado (latencia y carga innecesaria, no detecta conflictos).

## Consecuencias
- Los datos se mantienen frescos entre dispositivos sin recargas ni polling.
- Acoplamiento ligero: el servidor emite eventos; el cliente decide qué `queryKey` invalidar.

## Relaciones
- **ADR 003** (Modular): `modulos-cambios` actualiza el runtime de módulos.
- **ADR 004** (Sincronización): `datos-cambios` + `409 Conflict` para edición concurrente.
- **ADR 005** (Rendimiento): el fetching usa TanStack Query, cuyas `queryKey` son la unidad de invalidación.
