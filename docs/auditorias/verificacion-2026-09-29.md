# Verificación Integral 2026-09-29 — Bugs, Estabilidad y Optimización

> **Estado:** ✅ **Completada** (correcciones aplicadas y verificadas; backlog pendiente documentado abajo)
> **Ámbito:** Monorepo completo (`apps/api`, `apps/web`, `apps/mcp`, tests)
> **Motivación:** Verificación de la app construida con búsqueda sistemática de bugs, optimización de código y eliminación de flakiness en pruebas.

---

## 1. Gates de Verificación (resultado final)

| Gate | Resultado |
|---|---|
| `npm run build` (producción: shared + web + api + mcp) | ✅ Exitoso |
| `npm run check:quick` (typecheck 4 workspaces + 531 tests unitarios) | ✅ Exitoso (233 API + 283 web + 15 MCP) |
| `npm run test:e2e` (Playwright, suite completa) | ✅ **15/15** |
| `npm run lint` (ESLint `--max-warnings 0`) | ✅ Sin warnings |

---

## 2. Correcciones Aplicadas

### 2.1 API — Integridad de datos

| Problema | Archivo | Corrección |
|---|---|---|
| Editar una reserva y quitar un pasajero hacía **hard-delete** que destruía su firma de deslinde y sus vuelos por `onDelete: Cascade` | [`reservas.crud.ts`](../../apps/api/src/services/reservas/reservas.crud.ts) | Soft-delete (`updateMany` + `deletedAt`); el diff filtra `deletedAt: null` y los correlativos `numeroPasajero` (@unique) ya no colisionan con pasajeros borrados |
| `return listar(...)` sin `await` dentro de `try` hacía el `catch` inalcanzable → errores de DB como 500 en cascada | [`vuelos.crud.ts`](../../apps/api/src/services/vuelos/vuelos.crud.ts), [`reservas.query.ts`](../../apps/api/src/services/reservas/reservas.query.ts), [`pilotos.service.ts`](../../apps/api/src/services/pilotos.service.ts), [`equipos.service.ts`](../../apps/api/src/services/equipos.service.ts) | `return await listar(...)` dentro del `try` |
| Google Calendar **nunca borraba eventos** al cancelar/desagendar/eliminar: la consulta corría tras el soft-delete y no encontraba vuelos | [`google-calendar.service.ts`](../../apps/api/src/services/google-calendar.service.ts) | `deletedAt: {}` (bypass intencional de la extensión) para incluir los vuelos recién eliminados |
| Reservas atascadas para siempre fuera de `COMPLETADA` por vuelos en estado `CANCELADO` | [`vuelos.lifecycle.ts`](../../apps/api/src/services/vuelos/vuelos.lifecycle.ts) | El conteo de cierre excluye `CANCELADO` |
| `deleteReserva` re-estampaba `deletedAt` de pasajeros ya borrados lógicamente | [`reservas.ciclo-vida.ts`](../../apps/api/src/services/reservas/reservas.ciclo-vida.ts) | Filtro `deletedAt: null` en el `updateMany` |
| Comparación de `x-api-key` con `===` (timing attack) | [`auth.ts`](../../apps/api/src/plugins/auth.ts) | `crypto.timingSafeEqual` con guard de longitud |

### 2.2 MCP — Dinero y horas correctas

| Problema | Archivo | Corrección |
|---|---|---|
| Vuelos agendados/reagendados **3–4 h desfasados**: `2026-09-10 11:00` se marcaba como UTC | [`agendamiento.ts`](../../apps/mcp/src/tools/agendamiento.ts) | Normalización con `fechaHoraLocalToIso` (hora local America/Santiago) |
| `cancelar_reserva` cancelaba y devolvía dinero **sin control de concurrencia** | [`reservas.ts`](../../apps/mcp/src/tools/reservas.ts) | Consulta y envío de `version` previa (409 ante cambios concurrentes), como `desagendar_reserva` |
| Contratos ficticios: `tipoVuelo`/`incluyeFotos`/`codigoPromocion` se anunciaban y **se ignoraban en silencio** (no existen en `Tarifa`/`Promocion` ni en `CalcularValorPayloadSchema`) | [`tarifas.ts`](../../apps/mcp/src/tools/tarifas.ts), [`workflow.ts`](../../apps/mcp/src/tools/workflow.ts), [`api-client.ts`](../../apps/mcp/src/client/api-client.ts) | Contrato alineado con lo que la API acepta (`tarifaId`, `promocionId`, `cantidadPasajeros`) |
| `crear_y_agendar_reserva` inventaba `75.000 × n` como precio si fallaba la cotización (dinero ficticio guardado como real) | [`workflow.ts`](../../apps/mcp/src/tools/workflow.ts) | Abort con `isError` antes de crear la reserva |

### 2.3 Web — Concurrencia y offline (ADR 009)

| Problema | Archivo | Corrección |
|---|---|---|
| **409 espurio al guardar pagos**: se descartaba la respuesta de `actualizarEstadoPasajeros` (que incrementa `version`) y los pasos siguientes enviaban versión obsoleta | [`usePagosModalController.ts`](../../apps/web/src/components/pagos/usePagosModalController.ts) | `versionActual = updated.version ?? versionActual` + bookkeeping `pasoFallo` |
| **Pagos duplicados al reconectar**: un error encolado (outbox) se trataba como fatal y el reintento volvía a encolar lo ya encolado | [`usePagosModalController.ts`](../../apps/web/src/components/pagos/usePagosModalController.ts), [`useReservasModals.ts`](../../apps/web/src/app/reservas/hooks/useReservasModals.ts) | Rama `isQueuedError`/`queued`: `toast.info` + inyección optimista + cierre de modal, consistente con `confirmarEliminar` |
| Fechas UTC en `<input type="date">` de Equipos/Mantenimiento (tras las ~20:00 en Chile nacían con el día siguiente) | [`EquipoModal.tsx`](../../apps/web/src/components/EquipoModal.tsx), [`MantenimientoModal.tsx`](../../apps/web/src/components/MantenimientoModal.tsx) | `dateKeyLocal()` (5 sitios) |
| 10 clases `bg-gradient-to-*` (sintaxis Tailwind v3) en un proyecto Tailwind v4 | 6 componentes (`SyncPlatformOptions`, `PagoSummaryCard`, `MeteoHeroSemaforo`, `PantallaSidebarInfo`, `PantallaHeader`, `LiquidacionesSection`) | `bg-linear-to-*` |

### 2.4 Tests e Higiene

| Problema | Corrección |
|---|---|
| Flakiness E2E intermitente: los specs DOM usaban JWT fake pero dejaban llamadas `/api/` sin mockear → un 401 real borraba la cookie y redirigía a `/login` en mitad del test | **Catch-all neutro** en `mockAppShellApi` ([`api-mocks.ts`](../../apps/web/tests/helpers/api-mocks.ts)) que enruta `/api/` sin mock a una respuesta vacía (excluye `/api/auth/login` y `/api/public/`, necesario para los vouchers). Post-mortem en [`.agents/memories/postmortem-e2e-flake-login.md`](../../.agents/memories/postmortem-e2e-flake-login.md) |
| Warning `act(...)` en `reservas.test.tsx` (el test de desagendar terminaba sin esperar el cierre del modal) | `waitFor` sobre la mutación y el cierre del modal (regla "Cero Ruido en Tests") |
| Ruido de Vite: `vitest.config.ts` cargado como CJS y uso de `__dirname` | Renombrados a `vitest.config.mts` + `import.meta.dirname` |
| jsdom "Not implemented: navigation" al probar el interceptor 401 | Stub de `window.location` en [`apiInterceptor.test.ts`](../../apps/web/src/services/__tests__/apiInterceptor.test.ts) |
| `apps/web/test-output.txt` commiteado por error | Eliminado + `.gitignore` |
| Test E2E de WhatsApp pasajero desincronizado de la UI | Test actualizado a la UI intencional (ver §3) |

### 2.5 Segunda ronda — corrección del backlog 🔴/🟠/🟡 (§4)

| Problema | Archivo | Corrección |
|---|---|---|
| **Lost update** en `agendarGrupoVuelos`, `actualizarEstadoPasajerosReserva` y `desagendarReserva`: `checkVersion` sin lock → dos escrituras concurrentes podían ambas "ganar" sin 409 | [`vuelos.lifecycle.ts`](../../apps/api/src/services/vuelos/vuelos.lifecycle.ts), [`reservas.ciclo-vida.ts`](../../apps/api/src/services/reservas/reservas.ciclo-vida.ts) | Patrón atómico del codebase: `$transaction` + `SELECT … FOR UPDATE` + re-lectura + `checkVersion` bajo lock |
| **`abono` podía divergir de la suma de pagos** (denormalizado vs. `Pago` real); `updateReserva` calculaba el diff contra el valor desfasado; `montoDevuelto` podía quedar sembrado sin fila `Devolucion` que lo respalde | [`reservas.crud.ts`](../../apps/api/src/services/reservas/reservas.crud.ts), [`reservas.pagos.ts`](../../apps/api/src/services/reservas/reservas.pagos.ts), [`reservas.ciclo-vida.ts`](../../apps/api/src/services/reservas/reservas.ciclo-vida.ts) | Invariante `abono == suma(pagos activos)`: diff contra `pago.aggregate`; aumentos crean `Pago` compensatorio; reducciones se rechazan (exigen anular pago o devolución); `montoDevuelto` siempre respaldado por `Devolucion`; topes de devolución contra `sum(pagos)` |
| 22 huecos de **soft-delete** en `findUnique`/clientes `tx` (fuera del alcance de la extensión, ADR 006): vuelos, pasajeros, pilotos, equipos, gastos, calendario, bloques, devTools | servicios de `vuelos`, `pasajeros`, `pilotos`, `equipos`, `gastos`, `calendar`, [`configuracionBloques.ts`](../../apps/api/src/routes/configuracionBloques.ts), [`devTools.simulator.ts`](../../apps/api/src/services/devTools/devTools.simulator.ts) | `findUnique({ where: { id, deletedAt: null } })` (extended-where-unique de Prisma 6) + `updateMany` con filtro explícito donde aplica |
| **Ventanas de día/mes en TZ del servidor** (desfase tras las 21:00 en Chile) en reportes, pantalla, bloques, métricas y dashboard; patrón baneado `toISOString().split('T')[0]` | [`reportes.service.ts`](../../apps/api/src/services/reportes.service.ts), [`public.service.ts`](../../apps/api/src/services/public.service.ts), [`pantallaTokens.service.ts`](../../apps/api/src/services/pantallaTokens.service.ts), [`higiene.service.ts`](../../apps/api/src/services/higiene.service.ts), [`metricas.routes.ts`](../../apps/api/src/routes/metricas.routes.ts), [`dashboard.routes.ts`](../../apps/api/src/routes/dashboard.routes.ts) | Ventanas `[inicioLocal, finLocal)` con `fechaHoraLocalToIso` + claves de día/mes por aritmética civil; columnas date-only (`gasto.fecha`, `excepciones.fecha`) conservan la convención de medianoche UTC del día civil; `demandaMensual` agrupa con doble `AT TIME ZONE` verificado en la DB dev |
| **Respuestas fabricadas ante errores de DB**: manifiesto/liquidaciones con DTO en ceros, dashboard/métricas `200` con ceros, pantalla pública con tablero inventado | [`reportes.service.ts`](../../apps/api/src/services/reportes.service.ts), [`metricas.routes.ts`](../../apps/api/src/routes/metricas.routes.ts), [`dashboard.routes.ts`](../../apps/api/src/routes/dashboard.routes.ts), [`public.service.ts`](../../apps/api/src/services/public.service.ts) | Re-throw en documentos oficiales (500 vía Fastify) y `503` en dashboards; nunca entregar datos inventados |
| Endpoint de **firma de deslinde sin validación** ni rate limit; endpoints públicos con IDs secuenciales enumerables | [`public.controller.ts`](../../apps/api/src/controllers/public.controller.ts), [`public.routes.ts`](../../apps/api/src/routes/public.routes.ts), [`pasajeros.ts`](../../packages/shared/src/schemas/pasajeros.ts) | `FirmaDeslindePayloadSchema` (Zod) + tope de 2 MB en `firmaBase64` + rate limit por IP (`lectura 60/min`, `firma 10/min`); la migración a URLs con token se completó en la tercera ronda (§2.6) |
| **Doble pago de abono en el simulador de devTools** (`pago.create` duplicado sobre el `Pago` anidado de `createReserva`) | [`devTools.simulator.ts`](../../apps/api/src/services/devTools/devTools.simulator.ts) | Eliminado el `pago.create` duplicado; restauración de filas soft-deleted que sostienen `@unique` (evita P2002) |
| `JWT_SECRET` con default conocido en compose; clave MCP con fallback público en producción | [`docker-compose.yml`](../../docker-compose.yml), [`docker-compose.staging.yml`](../../docker-compose.staging.yml), [`config.ts`](../../apps/api/src/config.ts), [`apps/mcp/src/config.ts`](../../apps/mcp/src/config.ts) | `${JWT_SECRET:?…}` obligatorio en compose + rechazo de secretos débiles/triviales en producción (fail-fast); API key MCP exigida en producción (solo fallback en desarrollo) |
| `valorPactadoPorPasajero` con fallback `75000` inventado si la cotización valía 0 | [`workflow.ts`](../../apps/mcp/src/tools/workflow.ts), [`vuelos.lifecycle.ts`](../../apps/api/src/services/vuelos/vuelos.lifecycle.ts) | `valorTotal > 0 ? valorTotal / pasajeros.length : 0` en el tool MCP y en el lado API (sin dinero inventado en ningún camino) |
| `consultar_meteorologia` no mapeaba el contrato real de `GET /meteorologia/estado-actual` (`estadoPista`/`velocidadViento`/`rachaViento`/`observaciones`/`fechaHora`) → con datos reales devolvía `DESCONOCIDO` | [`disponibilidad.ts`](../../apps/mcp/src/tools/disponibilidad.ts) | Mapping al contrato real (`CondicionPista`) con aliases de compatibilidad; test con mock del contrato real |
| **Inserción optimista de reserva sin rollback** ante error no-409 (fila fantasma con id negativo hasta el próximo refetch) | [`useReservas.ts`](../../apps/web/src/hooks/useReservas.ts) | `onError` elimina la fila provisional salvo mutación encolada en outbox (ADR 009) |
| `useSyncCalendar` **fabricaba `dev_token_sample`** en caso de error (feed falso que enmascara el fallo) y usaba fetch crudo en `useEffect` | [`useSyncCalendar.ts`](../../apps/web/src/components/calendar-sync/useSyncCalendar.ts) | Error explícito (`toast.error` + `syncInfo = null`) + migración a TanStack Query |
| `withModule` **no re-renderizaba** ante el toggle de módulos por SSE | [`withModule.tsx`](../../apps/web/src/components/withModule.tsx) | Suscripción a `useEnabledModules()` (hook incondicional) |
| Stale closure en el debounce de `/auditoria`; `metodoPorDefecto` pisaba el método elegido; `useRouter()` dentro de `try/catch`; sin componente `Skeleton` en el design system | [`auditoria/page.tsx`](../../apps/web/src/app/auditoria/page.tsx), [`usePagosModalController.ts`](../../apps/web/src/components/pagos/usePagosModalController.ts), [`useWarmupData.ts`](../../apps/web/src/hooks/useWarmupData.ts), [`Skeleton.tsx`](../../apps/web/src/components/ui/Skeleton.tsx) | `filtersRef` para el callback diferido; reset solo al cambiar `reserva?.id`; hook incondicional (los tests ya mockean `next/navigation`); componente `Skeleton` + migración de 6 bloques `animate-pulse` ad-hoc ([`design-system.md`](../design-system.md)) |

### 2.6 Tercera ronda — migración de vistas públicas a `tokenPublico`/`shortId` (ADR 005)

Los endpoints públicos **solo resuelven identificadores no secuenciales**; `numeroReserva`, `numeroPasajero` e `id` numérico devuelven `404` (sin fallback). En desarrollo, por decisión del usuario, los enlaces existentes no necesitan preservarse.

| Problema | Archivo | Corrección |
|---|---|---|
| `getReservaPublica` y `generarVoucherPdf` resolvían por `numeroReserva` (enumerable) | [`public.service.ts`](../../apps/api/src/services/public.service.ts) | `OR` limitado a `tokenPublico`/`shortId` |
| `registrarFirmaDeslinde` resolvía el pasajero por `numeroPasajero` | [`public.service.ts`](../../apps/api/src/services/public.service.ts) | `OR` limitado a `tokenPublico`/`shortId` |
| `generateReservaIcs` resolvía por `numeroReserva` e `id` numérico (con fallback a `findUnique`) | [`calendar.service.ts`](../../apps/api/src/services/calendar.service.ts) | `OR` limitado a `tokenPublico`/`shortId`; eliminado el fallback numérico |
| Web generaba enlaces/QR públicos con fallback a `reserva.id` (voucher, deslinde, WhatsApp, modal, notificaciones) | [`useVoucherController.ts`](../../apps/web/src/app/voucher/hooks/useVoucherController.ts), [`useReservaWhatsApp.ts`](../../apps/web/src/app/reservas/hooks/useReservaWhatsApp.ts), [`VoucherModal.tsx`](../../apps/web/src/components/VoucherModal.tsx), [`deslinde/[id]/page.tsx`](../../apps/web/src/app/deslinde/[id]/page.tsx), [`notificaciones.service.ts`](../../apps/api/src/services/notificaciones.service.ts), [`notificaciones.routes.ts`](../../apps/api/src/routes/notificaciones.routes.ts) | Enlaces solo con `tokenPublico`/`shortId` (fallback final: el propio parámetro de URL ya validado por la API) |
| Tools MCP generaban enlaces públicos con fallback al `id` numérico | [`reservas.ts`](../../apps/mcp/src/tools/reservas.ts), [`workflow.ts`](../../apps/mcp/src/tools/workflow.ts) | `publicId = shortId \|\| tokenPublico`, sin `id` |
| Scripts de staging/prod construían URLs públicas con fallback a `id` | `scripts/test-calendar-prod.ts`, `test-mvp-stress.ts`, `test-datetime-tz-stress.ts`, `test-fase5-ciclo-vida.ts`, `test-fase7-integraciones.ts`, `suites/02-core-lifecycle.suite.ts`, `suites/03-public-client.suite.ts` | Fallback eliminado + error explícito si faltan tokens |
| Sin cobertura anti-enumeración | [`apps/api/tests/public.test.ts`](../../apps/api/tests/public.test.ts), [`routes/__tests__/public.test.ts`](../../apps/api/src/routes/__tests__/public.test.ts), [`routes/__tests__/calendar.test.ts`](../../apps/api/src/routes/__tests__/calendar.test.ts) | Tests negativos: `numeroReserva`, `numeroPasajero` e `id` numérico → `404`; asserts de que el `where.OR` solo contiene `tokenPublico`/`shortId` |

**Nota de compatibilidad**: un registro legacy sin `tokenPublico`/`shortId` ya no es accesible públicamente hasta que reciba tokens (la rellenación automática de [`public.service.ts`](../../apps/api/src/services/public.service.ts) solo aplica a filas alcanzadas por token). Los tokens se generan desde la creación en [`reservas.crud.ts`](../../apps/api/src/services/reservas/reservas.crud.ts) y [`pasajeros.service.ts`](../../apps/api/src/services/pasajeros.service.ts), por lo que en la práctica toda fila nueva es alcanzable.

---

### 2.7 Cuarta ronda — caducidad/rotación de tokens de calendario y tickets SSE (hallazgos 2a/2b)

Se implementaron las opciones aprobadas por el usuario: **(2a)** expiración de 1 año + botón "Regenerar enlace" que invalida los tokens anteriores, y **(2b)** ticket SSE de un solo uso (TTL 5 min) que sustituye al JWT en la query string.

| Problema | Archivo | Corrección |
|---|---|---|
| Feed token sin expiración ni revocación (HMAC con `createdAt` perpetuo; una vez filtrado, acceso de lectura permanente) | [`calendar.service.ts`](../../apps/api/src/services/calendar.service.ts) | Payload con `emitido`/`exp` (TTL 1 año) + estado de rotación [`FeedTokenRotacion`](../../apps/api/prisma/schema.prisma) por ámbito (`all` / `piloto:<id>`): `regenerateFeedToken` rota la emisión e invalida los tokens anteriores; una emisión vencida se rota sola al consultarse (el enlace muerto nunca se muestra) |
| UI sin forma de regenerar el enlace ni de ver su expiración | [`useSyncCalendar.ts`](../../apps/web/src/components/calendar-sync/useSyncCalendar.ts), [`SyncDirectLinkSection.tsx`](../../apps/web/src/components/calendar-sync/SyncDirectLinkSection.tsx), [`SyncCalendarModal.tsx`](../../apps/web/src/components/SyncCalendarModal.tsx) | Botón "Regenerar enlace" con confirmación en dos pasos (advierte que los anteriores dejan de funcionar) + línea "Válido hasta: …"; endpoint `POST /api/calendar/feed-token/regenerate` con validación de `scope`/`pilotoId` |
| JWT del SSE viajaba en la query string (`GET /api/eventos?token=`): filtrable en logs de proxy, historial y analytics | [`eventos.routes.ts`](../../apps/api/src/routes/eventos.routes.ts), [`sse-tickets.service.ts`](../../apps/api/src/services/sse-tickets.service.ts) | `POST /api/eventos/ticket` (autenticación normal por header) emite un ticket aleatorio de un solo uso (TTL 5 min); `GET /api/eventos?ticket=` lo consume una única vez al abrir la sesión SSE |
| Web abría `EventSource` con el JWT en la URL | [`useDatosStream.ts`](../../apps/web/src/hooks/useDatosStream.ts) | Canje del ticket vía `apiRaw` (header `Authorization`) + reconexión con backoff exponencial (3 s → 30 s) que canjea un ticket nuevo por reconexión; el ticket se consume solo al abrir el stream, por lo que la sesión vive lo que dure la conexión |
| Scripts de testing usaban `?token=` | `scripts/lib/client.ts`, `test-fase6-concurrencia-sse.ts`, `test-fase8-performance.ts` | Flujo de ticket idéntico al del navegador |
| Sin cobertura de ambos mecanismos | [`calendar.test.ts`](../../apps/api/src/routes/__tests__/calendar.test.ts), [`eventos.test.ts`](../../apps/api/src/routes/__tests__/eventos.test.ts) (nuevo), [`sse-tickets.service.test.ts`](../../apps/api/src/services/__tests__/sse-tickets.service.test.ts) (nuevo), [`SyncCalendarModal.test.tsx`](../../apps/web/src/components/__tests__/SyncCalendarModal.test.tsx) | Rotación invalida los previos (`ROTADO`), expiración exacta a 1 año (`EXPIRADO`), ticket de un solo uso y expirado, round-trip real de stream (ticket → stream → reuso → `401`) y confirmación en dos pasos del botón |

**Notas**:
- **Compatibilidad (2a/2b)**: los tokens de feed antiguos (formato sin `emitido`/`exp`) y las URLs `?token=` del SSE dejan de funcionar. Aceptado por el usuario en desarrollo (enlaces existentes no se preservan).
- **Tickets SSE en memoria**: válidos para el despliegue actual (API como instancia única en docker compose). Si se escala horizontalmente, el mapa debe moverse a un almacén compartido (Redis/DB).
- **Esquema**: el modelo `FeedTokenRotacion` se sincronizó con `prisma db push` sobre la DB dev (`:5679`), el mismo flujo que usa `staging:seed`.

---

### 2.8 Quinta ronda — punto 3: `abono` no editable en la edición + deuda técnica de migraciones

Se implementó el punto 3 pendiente del backlog (invariante `abono` **estructural**, no procedural) y se limpió la deuda técnica de las migraciones de Prisma ([ADR 015](../adr/015-fuente-de-verdad-esquema.md)).

| Problema | Archivo | Corrección |
|---|---|---|
| `updateReserva` aceptaba `abono` en el payload: a partir de un diff creaba un `Pago` compensatorio implícito o rechazaba reducciones (invariante procedural) | [`reservas.crud.ts`](../../apps/api/src/services/reservas/reservas.crud.ts), [`reservas.ts`](../../packages/shared/src/schemas/reservas.ts) | `abono` y `montoDevuelto` se omiten del `UpdateReservaPayloadSchema`; el servicio los descarta si llegan (defensa en profundidad), deriva `estadoPago` desde `pago.aggregate` y re-sincroniza `abono == suma(pagos activos)` en cada edición. El dinero solo cambia vía `addPago`/`deletePago`/devoluciones, con su historial contable |
| Un cliente desalineado podía "guardar" un abono que el servidor ignoraba en silencio | [`reservas.controller.ts`](../../apps/api/src/controllers/reservas.controller.ts) | `PATCH /api/reservas/:id` devuelve `400` explícito si el body trae `abono`/`montoDevuelto`, apuntando a los endpoints de pagos/devoluciones |
| La web enviaba `abono`/`estadoPago`/`montoDevuelto` del formulario al editar | [`useReservaForm.ts`](../../apps/web/src/app/reservas/hooks/useReservaForm.ts) | La edición no envía importes derivados: el servidor los re-deriva al guardar |
| Migración `20260429132305_init` obsoleta (3 tablas del esquema antiguo): un `migrate deploy` con ese historial construiría un esquema falso | `apps/api/prisma/migrations/` | Baseline limpio [`20260930000000_baseline_inicial`](../../apps/api/prisma/migrations/20260930000000_baseline_inicial/migration.sql) generado desde `schema.prisma` (28 tablas, enums nativos); verificado con `migrate deploy` sobre DB vacía y **diff cero** contra la DB dev |
| Deploy de producción usaba `db push --accept-data-loss` (pérdida de datos silenciosa en un deploy desatendido) | [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml) | Se elimina `--accept-data-loss`: un cambio destructivo ahora falla el deploy y exige revisión manual antes de aplicarse (ADR 015) |

**Notas**:
- **Cobertura nueva**: 3 tests de integración (`400` por `abono`/`montoDevuelto` en edición; invariante `abono == suma(pagos)` con re-derivación de `estadoPago` al cambiar `valorTotal`), 1 test unitario de API (el `abono` del cliente se ignora y se re-sincroniza desde pagos) y 1 test web (la edición no envía importes derivados).
- **Migraciones**: el flujo operativo sigue siendo `prisma db push` + `indexes-especiales.ts` (ADR 015); el baseline habilita reconstruir entornos con `migrate deploy` y la adopción futura vía `prisma migrate resolve --applied`. Los índices parciales/BRIN/GIN viven fuera del schema y los aporta el script, como hasta ahora.

---

## 3. Decisiones de Producto Tomadas

- **Botón de WhatsApp por pasajero**: fue eliminado a propósito en el commit `2ff2f2c` ("elimina WhatsApp pasajero duplicado"; el mensaje de confirmación al titular cubre al grupo). El test E2E esperaba el botón antiguo y fue actualizado a la UI vigente (botón WhatsApp del titular + botón del piloto). Si se quiere recuperar el recordatorio por pasajero, debe restaurarse la feature con su test, no al revés.

---

## 4. Backlog de Hallazgos Pendientes (auditados)

Encontrados en las auditorías paralelas de API/Web/MCP (≈52 hallazgos). Tras la segunda ronda (§2.5) el estado es:

### 🔴 Alta

| Área | Hallazgo | Estado |
|---|---|---|
| API | Endpoints públicos aceptan `numeroReserva`/`numeroPasajero` secuenciales → posible enumeración de PII | ✅ **Corregido (§2.6)**: los endpoints públicos solo resuelven `tokenPublico`/`shortId`; los identificadores secuenciales devuelven `404` |
| API | Ventanas de día/mes en TZ del servidor en reportes/pantalla/bloques | ✅ Corregido (§2.5) |
| API | `agendarGrupoVuelos` y `actualizarEstadoPasajeros`/`desagendar` hacen `checkVersion` sin re-verificación atómica | ✅ Corregido (§2.5) |
| API | `abono` puede divergir entre el modelo y la suma de pagos | ✅ Corregido (§2.5) y **endurecido (§2.8)**: `abono`/`montoDevuelto` no son editables en la edición — solo derivan de pagos/devoluciones |
| MCP | `valorPactadoPorPasajero` cae a un fallback `75000` inventado | ✅ Corregido (§2.5) |
| Web | Inserción optimista de reserva sin rollback ante error no-409 | ✅ Corregido (§2.5) |

### 🟠 Media

| Área | Hallazgo | Estado |
|---|---|---|
| API | Extensión soft-delete no cubre `findUnique` ni clientes `tx` | ✅ Corregido: 22 sitios con filtro explícito (§2.5) |
| API | Endpoint de firma de deslinde sin validación Zod ni rate limit | ✅ Corregido (§2.5) |
| API | `metricas`: desfase de día en ventanas + respuestas `200` con ceros ante error | ✅ Corregido (§2.5) |
| API/Infra | `JWT_SECRET` con valor por defecto en compose; API key MCP con fallback público | ✅ Corregido (§2.5) |
| API/Infra | Feed token de calendario sin expiración; JWT del SSE viaja en query string | ✅ **Corregido (§2.7)**: tokens de feed con expiración de 1 año y rotación por "Regenerar enlace"; el SSE usa tickets de un solo uso (TTL 5 min) canjeados por header, el JWT ya no viaja en la URL |
| Web | `useSyncCalendar` fabrica un token falso en caso de error | ✅ Corregido (§2.5) |
| Web | 6 puntos con fetch crudo en `useEffect` (regla: TanStack Query) | ✅ Corregido: `login`, `voucher`, `deslinde`, `usePantallaController` (polling + links) y `useSyncCalendar` migrados a `useQuery`/`useMutation` (hook compartido [`useReservaPublica`](../../apps/web/src/hooks/useReservaPublica.ts)) |
| Web | `withModule` no re-renderiza ante el toggle de módulos por SSE | ✅ Corregido (§2.5) |
| MCP | Tests mockean el sobre equivocado y no invocan los handlers reales | ✅ Corregido: reescritura con `Client` + `InMemoryTransport` invocando los handlers reales (sobre ADR 005, aserciones sobre el OUTPUT) |

### 🟡 Baja

| Área | Hallazgo | Estado |
|---|---|---|
| Web | Stale closure en el debounce de `/auditoria` | ✅ Corregido (§2.5) |
| Web | `metodoPorDefecto` pisa la selección del usuario en el modal de pagos | ✅ Corregido (§2.5) |
| Web | `useRouter()` invocado dentro de `try/catch` (regla de hooks) | ✅ Corregido (§2.5) |
| Web | Falta un componente `Skeleton` propio en el design system | ✅ Corregido (§2.5) |

---

## 5. Verificación Post-Correcciones

- `npm run check:quick` → ✅ (build de shared + typecheck monorepo + unit tests: API 233/233, Web 283/283, MCP 15/15 — sin warnings ni ruido en stderr)
- `npm run test:api:integration` → ✅ 11 suites / 40 tests contra la DB real de dev (`:5679`), incluidos los tests anti-enumeración de vistas públicas (§2.6) y del invariante `abono` (§2.8)
- `npm run test:e2e` → ✅ 15/15 (voucher, deslinde, reagendamiento, pilotos, calendario/analíticas, WhatsApp, contrato live, cliente público). **Requisito operativo**: la API dev (`:3001`) debe estar levantada (`npm run dev:api`) porque los specs públicos (`/api/public/`) y el contrato live usan la API real — si está caída, `e2e-live-contract` y `e2e-workflow` fallan por `ECONNREFUSED`, no por regresión
- `npm run build` → ✅
- `npm run lint` → ✅ (0 warnings)
- Documentación alineada: [`apps/mcp/README.md`](../../apps/mcp/README.md) (contratos reales de tools), [`AGENTS.md`](../../AGENTS.md), [`apps/api/AGENTS.md`](../../apps/api/AGENTS.md), [`apps/web/AGENTS.md`](../../apps/web/AGENTS.md), [`docs/design-system.md`](../design-system.md), [ADR 006](../adr/006-soft-delete-enums.md).
