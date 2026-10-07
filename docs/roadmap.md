# Hoja de Ruta (Roadmap) — Parapente School

Este documento define la evolución técnica, operativa y funcional del sistema de gestión de reservas de la escuela de parapente.

---

## 🟢 Fase 1: Experiencia de Usuario (UI/UX), Notificaciones y Móvil (Completada)

- [x] **Notificaciones y Toasts**: Integración de `sonner` en `apps/web` para confirmaciones y alertas en tiempo real.
- [x] **Reemplazo de Alertas Nativas**: Sustitución de `alert()` y `window.confirm()` por Toasts estilizados y modales.
- [x] **Diseño Responsivo Móvil**:
  - Menú lateral deslizante (*Drawer*) con hamburguesa para pantallas móviles.
  - Vistas de tarjeta para Pilotos y Reservas en pantallas `< md`.
  - Vista mensual de calendario adaptada con filtros flexibles.
- [x] **Soporte PWA (Progressive Web App)**: App instalable en dispositivos Android e iOS.
- [x] **Modo Oscuro / Claro**: Paleta de colores Tailwind CSS con `ThemeProvider`.

> **Auditoría Fase 1 (2026-08-18)**: ✅ verificada en código. Migrado el último `confirm()` nativo que quedaba (borrado de plantillas → toast sonner con acción, `plantillas/page.tsx`). Mejoras aplicadas: script anti-FOUC de tema en `layout.tsx` (dark se aplica pre-hidratación), `theme-color` dinámico según tema (`ThemeProvider.tsx`), drawer móvil con cierre por `Escape` + bloqueo de scroll (`AppShell.tsx`), altura del calendario responsive vía `useMediaQuery` (`calendario/page.tsx`).

---

## 🟢 Fase 2: Arquitectura Monorepo y Calidad Core (Completada)

- [x] **Cliente API Unificado**: Instancia centralizada de Axios en `apps/web/src/services/api.ts` con manejo de errores e inyección de tokens.
- [x] **Manejo de Estado**: Zustand (`useAuthStore`) para la gestión centralizada de sesión y roles de usuario.
- [x] **Paquete Compartido (`packages/shared`)**: DTOs, interfaces de TypeScript y validaciones con Zod compartidas entre `api` y `web`.
- [x] **Seguridad Base Backend**: Fastify con `@fastify/helmet` y `@fastify/rate-limit`.

---

## 🟢 Fase 3: Operaciones y Analíticas (Completada)

- [x] **Dashboard de Analíticas (`/analiticas`)**:
  - Gráficos interactivos de demanda diaria y vuelos completados vs agendados (Recharts).
  - Cálculo automático de ingresos totales, pagos a pilotos y margen neto.
  - Módulo de registro de Gastos Operacionales por categoría.
- [x] **Gestión de Configuración de Bloques Horarios**: Definición de reglas por rango de fechas, indefinidas o días específicos (*overrides*). *(Actualmente se gestiona como modal `ConfigBloquesModal` dentro de `/calendario`, ver Fase 7.)*

---

## 🟢 Fase 4: Seguridad, Refactorización y Hardening Técnico (Completada — auditoría 2026-08-18)

- [x] **Variables de Entorno Centralizadas**:
  - Configuración de API, frontend, Docker y PostgreSQL documentada en `.env.example`.
  - URLs públicas del frontend relativas (`/api`) y URLs internas separadas para Docker.
- [x] **Hardening de Seguridad**:
  - Política de CORS dinámica en Fastify restringida al dominio de producción (`ALLOWED_ORIGINS`), evaluada por request vía callback `origin()` en `apps/api/src/app.ts` (dev permite todo; peticiones sin Origin pasan; prod exige match exacto). Lista cargada en `apps/api/src/config.ts` y documentada en `.env.example`.
- [x] **Limpieza de Dependencias y Optimización de Bundle**:
  - `moment` eliminado y estandarizado 100% en `date-fns` (calendario usa `dateFnsLocalizer`; `moment-timezone` solo queda como dependencia transitiva de `ical-generator` en la API, no es código propio).
  - Scripts globales de verificación agregados: `npm run typecheck` y `npm run lint` en la raíz (con `typecheck` por workspace).
- [x] **Prisma Middleware / Extension para Soft-Delete**:
  - Filtrado automático transparente de registros con `deletedAt != null` vía extensión de Prisma en `apps/api/src/plugins/prisma.ts` (inyecta `deletedAt: null` en `findMany`/`findFirst`/`count`/`aggregate`/`groupBy` de los modelos con `deletedAt`).

---

## 🔵 Fase 5: Funcionalidades Avanzadas de Operación (Próxima Fase)

- [x] **Firma Digital de Deslinde de Responsabilidad**:
  - Módulo en el frontend (`apps/web`) con Canvas táctil para recolectar la firma del pasajero antes de volar ([`FirmaDeslindeModal.tsx`](../apps/web/src/components/FirmaDeslindeModal.tsx)).
- [x] **Asignación Inteligente de Pilotos (Matching por Prioridad de Categoría)**:
  - Algoritmo de emparejamiento automático priorizando la categoría del piloto (Master > Senior > Standard), verificando compatibilidad de rango de peso del pasajero, disponibilidad del día (`ExcepcionFecha`) y balance de carga de vuelos. ([`pilotos.service.ts`](../apps/api/src/services/pilotos.service.ts)).
- [x] **Integración Meteorológica (Estado del Clima)**:
  - Conexión real con **Open-Meteo** (sin API key, `CENTRO_LAT/LON`, `openMeteo.service.ts` + sampler backend cada 15 min) visualizada **sobre el calendario** vía `CalendarioMeteoStrip` (semáforo pista + viento/ráfaga/dirección/temp/nubosidad/UV) y en `/meteorologia` + `WeatherWidget`.
- [x] **Notificaciones Automatizadas por WhatsApp / Email (esqueleto)**:
  - Scheduler backend cada 60 min (`notificacionesScheduler.service.ts`) + servicio `buscarVuelosProximos(24h/2h)` y endpoint `GET /api/notificaciones/pendientes` (preview). Stub loguea con plantillas `RECORDATORIO_24H`/`AVISO_CLIMA_CANCELACION`; envío real vía Resend/Twilio queda pendiente de env vars (sin deps aún).

---

## 🟣 Fase 6: Resiliencia, Testing y DevOps (Completada & En Producción)
 
- [x] **Suite de Pruebas Unitarias y de Integración Frontend**: Pruebas ultrarrápidas con Vitest y React Testing Library para todas las páginas del sistema (`/login`, `/`, `/reservas`, `/calendario`, `/pilotos`, `/equipos`, `/meteorologia`, `/analiticas`, `/reportes`, `/plantillas`, `/auditoria`, `/pantalla`, `/voucher/[id]`, `/deslinde/[id]`, `/agente`).
- [x] **Suite de Pruebas E2E Ampliada (Playwright)**:
  - Cobertura Playwright para el flujo completo: Autenticación → Reserva → Firma Digital de Deslinde → Navegación a Calendario y Analíticas ([`e2e-workflow.spec.ts`](../apps/web/tests/e2e-workflow.spec.ts)).
  - **Auditoría 2026-08-18**: suite ampliada a 9 tests DOM-only en 5 specs — pilotos (lista/búsqueda/modal + estado vacío), calendario/analíticas (KPIs + desglose gastos) y envío manual WhatsApp (popups `api.whatsapp.com` con teléfono y mensaje verificados) ([`pilotos.spec.ts`](../apps/web/tests/pilotos.spec.ts), [`calendario-analiticas.spec.ts`](../apps/web/tests/calendario-analiticas.spec.ts), [`reservas-whatsapp.spec.ts`](../apps/web/tests/reservas-whatsapp.spec.ts)). Sin screenshots/videos/traces (`playwright.config.ts`). Mocks compartidos en [`tests/helpers/api-mocks.ts`](../apps/web/tests/helpers/api-mocks.ts) (login, `dashboard/stats`, `agent/status`, meteorología, modules, bloques) — evitan que llamadas sin mockear con el token falso provoquen el 401 y el nuke de sesión del interceptor.
  - **Auditoría 2026-09-29**: suite completa en **15/15 E2E verdes**. Se añadió un **catch-all neutro** en `mockAppShellApi` que enruta toda llamada `/api/` sin mock hacia una respuesta vacía (excluye `/api/auth/login` y `/api/public/`), eliminando el flake intermitente donde un 401 real del backend redirigía a `/login` en mitad del test según el paralelismo. Detalle en [`docs/auditorias/verificacion-2026-09-29.md`](./auditorias/verificacion-2026-09-29.md).
- [x] **Suite E2E de Verificación en Producción (`npm run test:prod`)**:
  - Suite automatizada en [`scripts/test-prod-suite.ts`](../scripts/test-prod-suite.ts) con 11 etapas completas ejecutadas directamente contra el entorno real desplegado (`https://parapente.zer0x.org`): Health Check, Login, Dashboard operativo, Pilotos, Calendario, Analíticas anti-flash con Skeleton loaders, Listado de Reservas, Navegación offline completa entre pestañas (`/`, `/pilotos`, `/calendario`, `/configuracion`, `/reservas`), Creación offline de reservas en IndexedDB `parapente-outbox`, Replay automático de outbox y Rutas públicas (`/pantalla`).
- [x] **Arquitectura Offline-First Completa (ADR 009)**:
  - Caché de navegación Workbox con `ignoreVary: true` para páginas y RSC de Next.js 16.
  - Sincronización de controlador en `useWarmupData` (`controller` + `controllerchange`) para asegurar intercepción total de rutas operativas.
  - Persistencia de queries operativas en IndexedDB (`parapente-cache`, 7 días).
  - Supresión de alertas de error en mutaciones encoladas (`isQueuedError`) con actualización optimista de caché en `useReservas`.
- [x] **Pipeline CI/CD Automatizado (GitHub Actions)**:
  - Validación unificada en GitHub Actions (`npm run test` + `npm run build`) previo al auto-despliegue local con Docker Compose en servidor self-hosted.
  - **Auditoría 2026-08-18**: jobs `test-api`, `test-web` y `build` en paralelo; `deploy` requiere los tres ([`deploy.yml`](../.github/workflows/deploy.yml)).
- [ ] **Respaldos Automatizados de Base de Datos**:
  - Servicio de backup `pg_dump` programado con rotación de archivos y almacenamiento secundario en homelab/S3. **(En standby: se implementará al final del proyecto)**.

---

## 🟢 Fase 7: Arquitectura Modular Básica vs Premium (Completada)

- [x] **Separación Core / Módulos Premium**:
  - El **core** (Básica) queda definido por Inicio (Dashboard), Pilotos, Reservas, Calendario de Vuelos, Analíticas y Auditoría & Logs, y funciona sin módulos adicionales.
  - Los **módulos premium** (Copiloto IA, Equipos, Reportes, Meteorología, Pantalla TV, Plantillas) son opcionales y se activan/desactivan **en caliente y versionados en repo** (`apps/api/modules.config.json` + endpoints `GET/PUT /api/admin/modules`, propagados por SSE `modulos-cambios`). Ya no dependen de `NEXT_PUBLIC_ENABLE_MODULE_*` ni de rebuild.
- [x] **Registro de Módulos**: Definición centralizada en `apps/web/src/modules/registry.ts` (ruta, ícono, etiqueta, sección admin y estado).
- [x] **Sidebar Dinámico**: `AppShell.tsx` renderiza solo los módulos habilitados según el plan y el rol.
- [x] **Guard de Rutas**: `withModule` + `ModuleNotAvailable` muestran "Módulo no disponible" al acceder por URL a un módulo deshabilitado.
- [x] **Configuración de Bloques integrada en Calendario**: La antigua página `/configuracion` se convirtió en el modal `ConfigBloquesModal` dentro de `/calendario`.

---

## 🟢 Fase 8: Disponibilidad de Pilotos y Sincronización Multicliente (Completada)

- [x] **Tabla de Pilotos mejorada**: scroll vertical on-demand con encabezado fijo, orden por prioridad (#1 arriba), columna Categoría/Prioridad/RUT, teléfono con enlace a WhatsApp, búsqueda en vivo responsiva.
- [x] **Modal de Piloto**: categorías limpias (MASTER/SENIOR/JUNIOR), selector Con/Sin Licencia con N° de licencia y vencimiento, pago por vuelo con formato regional de miles y gated por estado activo, pesos en KG enteros (validación Zod).
- [x] **Estados de licencia**: Licencia Vigente / Vencida / Sin Licencia; solo licencias vigentes son elegibles para asignación.
- [x] **Disponibilidad por bloques**: selección por día completa/parcial (días en amarillo), arrastre para pintar, selector de bloques por long-press (3s), semana desde lunes, guardado con borrador local (Cancelar/Guardar).
- [x] **Sincronización en tiempo real (SSE)**: push de cambios entre dispositivos vía `GET /api/eventos` + hook `useDatosStream`.
- [x] **Concurrencia optimista multicliente**: campo `version` en Piloto y endpoint atómico `PUT /pilotos/:id/disponibilidad` con `409 Conflict` ante guardados obsoletos (ver `docs/adr/004-sincronizacion-multicliente.md`). Base reutilizable para calendario y reservas.

---

# Plan por fases (derivado de Auditoría 1)

> Fuente: `docs/auditorias/auditoria-1.md`. Regla base (ADR 004): toda mutación multicliente va por un endpoint atómico/absoluto dentro de una transacción, con `version` comparada → `409 Conflict`, y broadcast SSE.

## 🔴 Fase 1: Concurrencia optimista en el núcleo operativo (Reserva, Vuelo, Pago) *(En progreso — backend completo)*

- [x] Campo `version` en `Reserva`, `Vuelo` y `Pago`.
- [x] `version` bump en todas las mutaciones (crear, editar, estado, pagos, borrado).
- [x] Endpoints de edición/estado/pago con validación de versión → `409` en guardados obsoletos (helper `concurrencia.service.ts`).
- [x] Web: enviar `version` en edición de reserva, vuelo y pagos; manejar `409` — hecho en: edición de reserva, alta/anulación de pago (PagosModal), edición y cambio de estado de vuelo en calendario. **Agendamiento de grupo** (`AgendamientoRapidoModal` → `POST /vuelos/agendamiento-grupo`) ahora envía `version` de la reserva y maneja 409. El **drag & drop** del calendario fue removido (no aportaba valor): se eliminó `DnDCalendar`, `handleEventDrop`, `undoStack`/`handleUndo` y el botón flotante de Deshacer.
- [x] Broadcast SSE en cambios de reserva/vuelo/pago.

## 🟠 Fase 2: Integridad del esquema *(Completada)*

- [x] **Pesos `Float` → `Int`** en DB (Piloto.peso/pesoMinimo/pesoMaximoPasajero, Pasajero.peso/pesoVerificado) — migrado sin pérdida con cast.
- [x] **Enums nativos Postgres** alineados con Zod: `EstadoPago`, `EstadoVuelo`, `MetodoPago`, `TipoEquipo`, `EstadoEquipo`, `EstadoPista`, `CanalMensaje`, `CategoriaPiloto` (MASTER/SENIOR/JUNIOR/STANDARD). Migrados sin pérdida (script `apps/api/scripts/migrar-enums.ts`).
- [x] **Dinero `Float` → `Decimal(12,2)`** (`tarifaPorVuelo`, `valorTotal`, `abono`, `valorPactado`, `pagoPiloto`, `monto`, `costo`). La API serializa `Decimal` como `number` en JSON (serializer global en `apps/api/src/app.ts`); la aritmética usa `toNum()` (`apps/api/src/services/money.util.ts`). Migrado sin pérdida con cast.

## 🟡 Fase 3: Soft delete y auditoría consistente *(Completada)*

- [x] `deletedAt` en `Gasto` y `ConfiguracionBloque` (+ `HorarioBloque`); borrados ahora son soft y preservan historia.
- [x] `updatedAt` en `ExcepcionFecha`, `PilotoDisponibilidadBloque`, `HorarioBloque`.
- [x] **Filtrado de soft delete centralizado** con una extensión de Prisma (`apps/api/src/plugins/prisma.ts`) que inyecta `deletedAt: null` en `findMany`/`findFirst`/`count`/`aggregate`/`groupBy` de los modelos con `deletedAt` (las escrituras no se tocan). Nota: no hay escape hatch para leer borrados; si se necesita, se agrega un flag en la extensión.

## 🟢 Fase 4: Concurrencia de nivel medio + sincronización *(Completada)*

- [x] `version` en `CondicionPista`, `Gasto`, `ConfiguracionBloque`, `Equipo` y `MantenimientoEquipo`.
- [x] `409` en updates de `ConfiguracionBloque` y `Equipo`; check de versión en delete de `Gasto`; bump en todas las mutaciones.
- [x] SSE broadcast en meteorología, gastos y equipos (infraestructura de `eventos.service`); clientes con `useDatosStream` en meteorología y equipos. Nota: meteorología es append-only (crear registros), por eso su concurrencia real es el SSE, no 409.
- [x] Web envía `version` y maneja `409` en edición de configuración de bloques y de equipos.

## 🔵 Fase 5: Rendimiento y consistencia de datos *(Completada)*

- [x] **Índices**: reservas por `nombreTitular`/`email`/`telefono`, vuelos por `pasajeroId`, pilotos por `prioridad`.
- [x] **Paginación**: opcional `skip`/`take` en pilotos, reservas y vuelos; `page`/`limit` con total en auditoría (con controles Anterior/Siguiente).
- [x] **Carga pesada de `/pilotos` aliviada**: `getAll` ya no incluye `excepciones` ni `disponibilidadBloques`; se cargan bajo demanda con `GET /pilotos/:id/disponibilidad` al abrir el modal.
- [x] **Política de fechas/horarios documentada** (UTC en la DB, conversión en la UI; bloques como `HH:mm` sin zona).

## 🟢 Fase 6: Rendimiento y Manejo de Datos (Completada — ADR 005)

> Plan arquitectura: [`docs/adr/005-rendimiento-datos.md`](./adr/005-rendimiento-datos.md)

- [x] **Contrato de listados**: envelope `{ data, pagination }` + `page/pageSize` (máx 500) + filtros SQL en todos los endpoints (`vuelos` con `desde`/`hasta`/`estado`, `reservas` con `q`/`estado`/rango, `pilotos` con `q`/`activo`, `pasajeros` con `q`, `gastos`/`equipos`/`plantillas`/`auditoria` alineados). Helper `listar()` que fuerza `take`. ✅ Implementado 2026-08-18.
- [x] **Fetching estandarizado (web)**: TanStack Query (migrado desde SWR 2026-08-18) con claves estables + unwrap del envelope; calendario **scoped por mes** (`?desde=&hasta=`) con refetch al navegar; revalidación SSE quirúrgica por prefix.
- [x] **Visualización**: virtualización (`@tanstack/react-virtual`) en listas largas; proyección de campos para el calendario si el payload lo requiere.
- [x] **DB — Pilar 4 (aprovechar Postgres/Prisma)**:
  - [x] **4.1 Agregación pushdown**: `/metricas/financiero` y `/dashboard/stats` deben agregar con `groupBy`/`aggregate`/`$queryRaw` (GROUP BY, window functions) en Postgres — hoy traen filas enteras del mes y agregan con `forEach` en JS (`metricas.routes.ts`, `dashboard.routes.ts`). Postgres agrega en C y transfiere solo el resultado. ✅ Implementado 2026-08-18: `metricas.routes.ts` convertido a 5 queries agregadas (`groupBy` por estado/piloto/categoria, `aggregate` de sums, `$queryRaw` con `date_trunc('day')`); `dashboard.routes.ts` ya era pushdown (counts + `take: 5`). Verificado en vivo: julio y agosto 2026 coinciden exactamente con el SQL directo.
  - [x] **4.2 Índices compuestos** para las queries reales: vuelos `(fechaHora, estado)` (query del calendario: rango + estado en un scan), gastos `(fecha, categoria)` (métricas), reservas `(fechaReserva, estadoPago)`, pilotos `(activo, prioridad)`. ✅ Implementado 2026-08-18 (db push): `Vuelo_fechaHora_estado_idx` (reemplaza al simple `fechaHora`), `Gasto_fecha_categoria_idx`, `Reserva_estadoPago_fechaReserva_idx` (igualdad primero), `Piloto_activo_prioridad_idx`. Con tablas pequeñas el planner elige seq scan (0.03ms); con datos reales usará el compuesto.
  - [x] **4.3 Índices especializados**: BRIN en `vuelos.fechaHora` (historia que crece sin límite; scans por rango de meses con ~1% del tamaño de un B-tree); extensión **pg_trgm** (GIN) para los `ILIKE '%…%'` de búsqueda (`reservas.nombreTitular`, `pasajeros.nombre`, `pilotos.nombre`) — hoy son sequential scans; **índices parciales** `WHERE deletedAt IS NULL` en tablas soft-delete (el cliente inyecta ese filtro siempre). ✅ Implementado 2026-08-18: script idempotente `apps/api/scripts/indexes-especiales.ts` (BRIN `Vuelo_fechaHora_brin`, parcial `Vuelo_fechaHora_estado_activos`, GIN trgm en Reserva/Pasajero/Piloto); el deploy lo corre tras `prisma db push`; verificado con EXPLAIN: el planner usa `Reserva_nombreTitular_trgm` para `ILIKE '%maría%'` (0.24ms).
  - [x] **4.4 Proyección (select)**: calendario/devuelve solo los campos que pinta la UI (menos transferencia y mejor uso de covering indexes). ✅ Implementado 2026-08-18: `campos=vista-calendario` (tipado en `VueloListQuerySchema`) → `/api/vuelos` devuelve `id/fechaHora/estado/valorPactado/pilotoId/pasajeroId` + `{id, nombre}` de piloto/pasajero en vez de los objetos completos; el calendario lo usa; el resto de consumidores mantiene el `include` completo.
  - [x] **4.5 Pool + tuning**: pool de conexiones Prisma (`?connection_limit=10` en la connection string — el datasource no acepta la propiedad con `provider = "postgresql"`, CI 2026-08-18 falló en `prisma generate`) con `max_connections` de Postgres; tuning en docker-compose (`shared_buffers`, `work_mem`, `effective_cache_size`, autovacuum agresivo); `$transaction([...])` para lecturas paralelas. ✅ Implementado 2026-08-18: `?connection_limit=10` en DATABASE_URL (compose, .env.example, .env); `command` de tuning en `docker-compose.yml` **y** `docker-compose.dev-db.yml` (shared_buffers 128MB, effective_cache_size 512MB, work_mem 8MB, maintenance_work_mem 64MB, max_connections 100, autovacuum 0.05/2000) — verificado con `SHOW` en la DB dev; datos intactos tras recrear el contenedor. `$transaction([...])` no aplica a lecturas: serializa queries en una tx (peor con pool) — el patrón correcto es `Promise.all` + pool.
  - [x] **4.6 Verificación**: `EXPLAIN ANALYZE` antes/después de la query del calendario y de métricas (con la simulación de 12 meses de datos); `pg_stat_statements` si se activa. ✅ Implementado 2026-08-18: `pg_stat_statements` activo en ambos compose (`shared_preload_libraries`); prueba formal con tabla sonda de **200k vuelos en 12 meses**: query del calendario (rango de mes + estado) pasa de **25.5ms seq scan / 2496 buffers → 2.7ms bitmap index scan / 751 buffers (~9.3x, 3x menos buffers)** con el compuesto `(fechaHora, estado)`; barrido completo de 12 meses = 35ms/200k filas (escenario del crash original — imposible ahora: el calendario es scoped por mes). Queries reales de la app (calendario, métricas, búsqueda) en **submilisegundo** según `pg_stat_statements`.
- [x] **Pilar 5 — Contrato v2 + listas infinitas bajo demanda (TanStack Query)**: ✅ Completo 2026-08-18.
  - [x] **Contrato v2**: `cursor` keyset (id desc) en auditoría con `pagination.nextCursor`/`nextPage` en el envelope; `AuditoriaListQuerySchema` tipado; auditoría deja el `limit` legacy por `pageSize`. ✅ Implementado 2026-08-18, verificado en vivo (sin saltos ni solapes). Detalle: el servidor emite `nextCursor` **también en la página offset** (página 1), así `useInfiniteQuery` migra a keyset desde la página 2 (estable bajo escrituras concurrentes).
  - [x] **Migración SWR → TanStack Query**: dependencia `@tanstack/react-query`, `QueryClientProvider` en el layout (`QueryProvider`, staleTime 15s, sin refetchOnWindowFocus — el SSE empuja cambios), hooks reescritos manteniendo shapes de consumidores (CRUD con `setQueryData`/`invalidateQueries`), `useMeteorologia` también migrado (refetchInterval 60s), calendario con `useQuery` por recurso y clave por mes, `swr` eliminado, tests adaptados con wrapper `src/test/render.tsx` (16 archivos). ✅ Commit `b206c7d`.
  - [x] **SSE quirúrgico**: `useDatosStream` → `invalidateQueries` con prefix por dominio (mapa entidad → prefix: `vuelo`→`['vuelos']`, `configuracion-bloques`→`['configuracion-bloques']`, ...); entidad desconocida → invalidación total; callback opcional conservado. Páginas sin closures de refetch (pilotos lee configuraciones desde caché). ✅ Commit `1a88fef`, verificado con evento real `{entidad:"vuelo"}`.
  - [x] **Listas infinitas**: `useInfiniteQuery` — **auditoría** con keyset `cursor` + botón "Cargar más" (reemplaza la paginación por páginas); **reservas** con filtros server-side (tabs `PROXIMAS/PASADAS` → `desde/hasta`, búsqueda → `q` con debounce 400ms, pago → `estado`; el `q` del API ahora cubre también `rutDniTitular` y nombres/RUT de pasajeros) + "Cargar más reservas". Pilotos/pasajeros/gastos/equipos/plantillas quedan en query plana (filtran en cliente; escala manejable) — ver ADR-005. ✅ Commits `67f3b7b` + `4b49dfa`.
  - [x] **Virtualización** (`@tanstack/react-virtual`): feed de auditoría con windowing (scroll propio, `measureElement`, overscan 6). ✅ Commit `4b49dfa`. Fix CI: mock `ResizeObserver` en tests como clase constructible con `borderBoxSize` (jsdom no mide layout).
