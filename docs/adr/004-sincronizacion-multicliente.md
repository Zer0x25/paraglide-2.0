# ADR 004: Concurrencia Optimista Multicliente (Sincronización de Disponibilidad)

## Estado
Aceptado

## Fecha
- **Aceptado**: Fase 8 (Disponibilidad de Pilotos y Sincronización Multicliente) — 2026.
- **Última revisión**: 2026-08-18 (corrección de SWR → TanStack Query y unificación de numeración).

## Contexto
El sistema se opera desde varios dispositivos a la vez (móvil, tablet, PC del administrador, pantalla de sala). Varias personas pueden editar los **mismos datos** al mismo tiempo — por ejemplo, dos operadores modificando la disponibilidad de un mismo piloto, o más adelante el calendario y las reservas.

El problema: si dos clientes cargan el mismo dato, lo editan y guardan, ¿cuál sobrevive? Con guardado ciego ("último que escribe gana") los cambios de una persona pueden pisar silenciosamente los de la otra, e incluso generar estados incoherentes (por ejemplo, un *toggle* de excepción aplicado dos veces vuelve al estado original).

Opciones evaluadas:

- **Bloqueo pesimista (pessimistic locking)**: bloquear el registro mientras alguien lo edita. Requiere sesión/lock en DB, tiempo de expiración y manejo de esperas; engorroso para una UI web y frágil con conexiones que se cortan.
- **Polling periódico (30s)**: simple pero con latencia y carga innecesaria; no detecta conflictos, solo actualiza datos.
- **Concurrencia optimista (optimistic concurrency / optimistic locking)**: el cliente carga una **versión** del dato junto con él; al guardar envía esa versión y el servidor rechaza con `409 Conflict` si la versión ya no coincide. Es la práctica moderna recomendada: sin locks, sin esperas, y el conflicto se resuelve recargando y reintentando.

Se adoptó **concurrencia optimista + notificaciones push (SSE)**.

## Terminología
- **Multicliente / multi-dispositivo**: varios clientes (navegadores/equipos) conectados a la misma base de datos.
- **Concurrencia optimista**: técnica que asume que los conflictos son raros; se detectan al guardar comparando una versión, en vez de prevenirlos con locks.
- **Versionado**: cada registro afectado lleva un contador `version` que se incrementa en cada mutación.

## Decisión

### Modelo de datos
- Campo `version Int @default(0)` en el modelo `Piloto` (Prisma). Cualquier mutación que afecte la disponibilidad lo incrementa: `update`, `toggleDisponibilidad`, `resetDisponibilidad`, `setBloquesDisponibilidad` y el endpoint atómico `saveDisponibilidad`.
- La disponibilidad por bloques se guarda en `PilotoDisponibilidadBloque` (`pilotoId`, `fecha`, `horaInicio`, `horaFin`, único por `[pilotoId, fecha, horaInicio]`).

### Endpoint atómico de guardado
`PUT /api/pilotos/:id/disponibilidad`

```json
{
  "version": 3,
  "fechas": [
    { "fecha": "2026-09-05", "disponible": false, "bloques": [] },
    { "fecha": "2026-09-06", "disponible": true, "bloques": [{ "horaInicio": "10:00", "horaFin": "13:00" }] }
  ]
}
```

Se aplica en una **única transacción**:
1. Lee el piloto y compara `version` con la enviada.
2. Si no coincide → responde `409 Conflict` (no se aplica nada).
3. Si coincide → fija cada día de forma **absoluta e idempotente** (crea/elimina la excepción según `disponible` y reemplaza los bloques), e incrementa `version`.

A diferencia del antiguo `POST .../disponibilidad/toggle` (que "volteaba" el estado y era propenso a carreras), el nuevo endpoint **establece el estado deseado**: dos guardados consecutivos con el mismo valor producen el mismo resultado.

### Flujo del cliente (web)
1. Al abrir el modal de disponibilidad se captura la `version` del piloto cargada.
2. El operador edita en un borrador local (draft); nada se persiste hasta pulsar **Guardar**.
3. Guardar envía `{ version, fechas }` en una sola llamada.
4. Si el servidor responde `409`, se muestra "Los datos de disponibilidad cambiaron en otro dispositivo" y se recarga; el usuario puede reintentar sobre datos frescos.
5. Si no hay conflicto, se cierra el modal y se refrescan los datos.

### Sincronización en vivo (SSE)
Además del control de conflictos, los cambios se propagan a los otros clientes casi en tiempo real:

- Endpoint `GET /api/eventos?ticket=...` (Server-Sent Events; el ticket de un solo uso se canjea por header en `POST /api/eventos/ticket` porque `EventSource` no puede mandar headers — ver [ADR 007](007-tiempo-real-sse.md)).
- Un pub/sub en memoria (`services/eventos.service.ts`) hace `broadcast('datos-cambios')` tras cada mutación de pilotos o de configuración de bloques.
- El hook `useDatosStream` (web) escucha el stream y dispara la invalidación quirúrgica de TanStack Query (`queryKey` `['vuelos']`, `['pilotos']`, `['configuracion-bloques']`, etc.).

## Consecuencias
- **El guardado más reciente sobre datos frescos gana**; un guardado sobre datos obsoletos se rechaza explícitamente (409) en lugar de pisar en silencio.
- Se elimina la carrera del *toggle*: el estado del día se establece de forma absoluta.
- Sin locks ni esperas: la UX sigue siendo instantánea y el conflicto es la excepción.
- Restricción: el 409 es estricto a nivel de piloto — si alguien cambia *cualquier* fecha del piloto, un guardado de otra fecha también obtiene 409 y debe reintentar. Es conservador y seguro; puede refinarse a granularidad fina por fecha si se necesita.
- El patrón (versión + endpoint atómico + SSE) ya está aplicado más allá de la disponibilidad: **Reserva, Vuelo, Pago** (Fase 1), **CondicionPista, Gasto, ConfiguracionBloque, Equipo, MantenimientoEquipo** (Fase 4), y el **agendamiento de grupo** (`POST /vuelos/agendamiento-grupo` valida la `version` de la reserva → 409). El drag & drop del calendario fue removido por decisión de producto (no aportaba valor), por lo que ya no hay flujos de edición de vuelo sin control de concurrencia.

## Referencias
- `apps/api/src/services/pilotos.service.ts` — `saveDisponibilidad`, `bumpVersion`.
- `apps/api/src/controllers/pilotos.controller.ts` — `saveDisponibilidad` (409) y broadcasts.
- `apps/api/src/services/eventos.service.ts` — pub/sub.
- `apps/api/src/routes/eventos.routes.ts` — endpoint SSE.
- `apps/web/src/hooks/useDatosStream.ts` — cliente SSE.
- `apps/web/src/app/pilotos/page.tsx` — modal de disponibilidad con draft + versión.