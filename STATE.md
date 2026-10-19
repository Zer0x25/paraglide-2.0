# STATE — Estado del Sistema, Seguimiento y Aprendizaje

Este documento mantiene el estado de ejecución, trazabilidad de sesiones, evidencia de calidad y bitácora de aprendizaje continuo del proyecto **Paraglide**.

---

## 1. Estado Global del Monorepo

| Dimensión | Valor / Estado | Notas |
|---|---|---|
| **Fase Activa del Roadmap** | Fase 5 & Gobernanza Lean | Ver [`docs/roadmap.md`](docs/roadmap.md) y [`PRD.md`](PRD.md). |
| **Arquitectura de Gobernanza** | Activa (Lean 3-Tier + 7 Pilares) | Tier 1 Architectural, Tier 2 Standard, Tier 3 Fast-Track. |
| **Bases de Datos** | Dev `:5679` / Staging `:5680` | Producción `:5678` aislado y protegido. |
| **Módulos Core** | 7 Módulos Operativos | `/`, `/pilotos`, `/reservas`, `/calendario`, `/marcacion`, `/analiticas`, `/auditoria`. |
| **Módulos Premium** | Runtime Toggleable | Controlados vía `modules.config.json` y SSE. |

---

## 1.1 Avance reciente: Marcación de pista y revisión de PRs

- **Fecha:** 2026-10-17
- **Implementación:** Nueva vista `/marcacion` para la agenda diaria, filtros por estado, búsqueda, panel de jornada y ficha del pasajero. La marcación se guarda por reserva en lote usando el endpoint existente, `version` optimista y outbox offline. Acceso limitado a `ADMIN` y `RECEPCION`.
- **Correcciones:** Los cambios locales ahora mantienen el historial de `.jules/palette.md`, hacen que los nombres accesibles incluyan el texto visible y reemplazan las búsquedas repetidas por índices de identidad/RUT e ID. También quedó un test de componentes para los paneles y guardado de marcación; se estabilizó un fixture de vuelo cuya fecha ya había pasado y el query de deslinde convierte una respuesta vacía en `null`.
- **PRs revisados:** #67 y #69 se mergearon con CI verde. Las correcciones de #66 y #68 están en esta rama local, pero sus PR siguen abiertos en GitHub con sus cabezas antiguas; no se empujaron cambios a esas ramas. #65 incluye los merges y apunta a `main` actualizado, pero su CI sigue en `action_required` sin jobs ejecutados.
- **Evidencia local:** `npm run format`, `git diff --check` y `npm run check:quick` completaron sin errores. El gate pasó build de shared, typecheck en todos los workspaces, API (46 archivos/408 tests), web (56 archivos/307 tests) y MCP (1 archivo/16 tests). No se ejecutaron E2E ni despliegue.

---

## 1.2 CI por PR y RC hacia staging (2026-10-18)

- **Flujo:** CI solo en PR, dispatch y validación reutilizable; una instalación de dependencias por job, suites por módulos, cancelación de ejecuciones anteriores y check `CI Quality Gate ✅` que falla directamente ante errores. Markdown, incluido el anidado, no dispara suites.
- **RC:** Release Please prepara prereleases `vX.Y.Z-rc.N`. El merge de su PR publica la candidata y llama al workflow RC explícitamente; el PR del bot recibe CI por dispatch sin PAT adicional. Se verifica tag, versión y pertenencia a `main` antes de validar y construir API/Web para amd64.
- **Staging:** imágenes por digest guardadas en `rc-manifest.json`, reutilizadas en reintentos. Esquema, índices y usuario se preparan antes del arranque; proyecto/red/DB propios y puertos loopback `3200`, `3201`, `5680`. Credenciales aleatorias persistentes fuera del checkout. Solo una ejecución con todas las pruebas aprobadas adjunta `staging-verification.json`.
- **E2E:** los tests reales usan credenciales del entorno. La suite premium reutiliza una sesión por worker para respetar ADR 013 y el límite de login; su comprobación de acceso público utiliza un contexto explícitamente anónimo. Se estabilizan selectores semánticos y el identificador del fixture de piloto para repetir pruebas sin colisiones.
- **Evidencia local:** Node 22; `npm run check:quick` aprobado (API 408, Web 307, MCP 16: 731 tests), `npm run test:ci` (6 tests), typecheck Web y lint de los cambios, Actionlint 1.7.7, schema oficial de Release Please, Compose y filtros de rutas comprobados. Despliegue aislado en el entorno cloud con imágenes ya publicadas del mismo código de aplicación (`ab62ac8`): 7/7 suites HTTP y 22/22 E2E (43.9 s), sin reintentos en la ejecución final. Open-Meteo se accedió mediante el proxy y CA del entorno en un override temporal no versionado.
- **Límite y siguiente paso:** no se publicó una RC real ni se desplegó producción. El flujo productivo automático anterior se elimina; Stable y su promoción se definirán después. La integración respondió 403 al consultar la protección administrativa de `main`; la regla requerida y prerrequisitos del runner quedan documentados en `docs/ci-cd.md`.

## 1.3 Publicación y validación de la RC v0.11.1-rc.1 (2026-10-19)

- **Release:** PR #72 se mergeó y publicó `v0.11.1-rc.1` como prerelease. El commit candidato es `af7be0928ce226359017b9d079baeba27cac6226`; sus imágenes API y Web quedaron fijadas por digest en `rc-manifest.json`.
- **Staging:** el workflow [#39191956947](https://github.com/Zer0x25/paraglide-2.0/actions/runs/39191956947) terminó en verde. Validó el manifiesto, omitió el CI y la reconstrucción ya completados, desplegó los digests exactos y confirmó el commit desde la API. Las pruebas pasaron: 7/7 suites HTTP (49 comprobaciones) y 22/22 E2E en Chromium. La prerelease contiene `staging-verification.json`; el artefacto de resultados se conserva en el workflow.
- **Ajustes del runner:** el runner self-hosted no tiene `gh`, dependencias nativas de Chromium ni `sudo` sin contraseña. El PR #73 reemplaza las llamadas de staging a `gh` por la API de GitHub y ejecuta las pruebas en la imagen Playwright `v1.62.1-noble`. La primera descarga de esa imagen tomó cerca de cuatro minutos; queda en caché para siguientes ejecuciones.
- **Corrección del flujo de reintento:** la primera ejecución con manifiesto existente omitió staging por una dependencia transitiva omitida; se corrigió con una condición explícita en el job. El run final confirmó que staging sí se ejecuta y publica evidencia aunque se salten la validación completa y las imágenes.
- **Estado y siguiente paso:** PR #73 sigue abierto con CI verde para fusionar el arreglo permanente. La RC permanece prerelease validada en staging; no se promovió a Stable ni se desplegó producción. Definir la promoción Stable queda como siguiente conversación.

---

## 1.4 Eliminar repetición de CI entre PR, release y RC (2026-10-19)

- **Diagnóstico:** el ciclo PR #73 → release PR #74 ejecutó cuatro Quality Gates completos: CI #154, #155, #156 y el job reutilizable de Release Please #55. #155 y #156 comprobaron el mismo head; el último gate repitió las suites antes de construir la RC.
- **Cambio:** se elimina el dispatch automático del CI de Release Please. El check obligatorio conserva su nombre; el PR de release verifica versiones y cambios permitidos y reutiliza evidencia de un PR exitoso con el mismo contenido. La RC consulta esa misma evidencia antes de decidir si necesita suites completas. La huella conserva código, dependencias, integridades, scripts y workflows; normaliza únicamente versiones de release y omite documentación. La evidencia declarada se contrasta con el origen del run y con una huella recalculada desde el commit probado. Una fuente ajena, fallida, cancelada, expirada o no verificable no evita CI.
- **Validación:** `check:quick` aprobado (API 408, Web 307, MCP 16), pruebas del pipeline, Actionlint y formato. La selección de metadatos también se comprobó contra el diff real del PR #74; las versiones internas de workspaces del lockfile se conservan sin normalizar, como hace el generador actual. El [CI #157](https://github.com/Zer0x25/paraglide-2.0/actions/runs/39197507963) del [PR #75](https://github.com/Zer0x25/paraglide-2.0/pull/75) pasó y publicó evidencia; el [probe #158](https://github.com/Zer0x25/paraglide-2.0/actions/runs/39197812439) reutilizó esa evidencia ante una versión distinta en 12 s, sin instalar dependencias ni ejecutar suites. También se evita repetir el CI de un PR por un commit posterior solo documental, exigiendo que sus versiones permanezcan iguales. Los runs finales se registran en la descripción del PR.
- **Staging actual:** la RC `v0.11.1-rc.2` construyó sus imágenes en el run #39195501805, pero falló en checkout del runner self-hosted antes de desplegar o ejecutar pruebas. No tiene aprobación técnica de staging. Stable sigue pendiente.

---

## 2. Última Sesión de Trabajo: Corrección de Fallo de Build Docker en API (Prisma Engines ECONNRESET) y Release v0.10.4

- **Fecha:** 2026-10-14
- **Objetivo:** Resolver el fallo de construcción de la imagen Docker de API en GitHub Actions (`npm ci` -> `@prisma/engines` postinstall ECONNRESET en Release Please / Deploy) y completar el ciclo de release y despliegue.
- **Autor / Ejecutor:** Agente Asistente de IA (Antigravity).
- **Entregables Realizados:**
  1. **Aislamiento de scripts en Dockerfile API (`apps/api/Dockerfile`)**:
     - Agregado `--ignore-scripts` a `npm ci` en etapas `prod-deps` y `build` para eliminar descargas ciegas y concurrentes desde `binaries.prisma.sh` durante la instalación de paquetes.
     - Inyección de `ENV PRISMA_SKIP_POSTINSTALL_GENERATE=true` en ambas etapas.
     - Implementación de bucle de reintentos (`for i in 1 2 3; do npx prisma generate ... && break || sleep 3; done`) para conferir resiliencia a la descarga oficial de binarios contra el schema real.
  2. **Verificación Integral & Gates**:
     - Build de la imagen Docker de API verificado localmente con Docker BuildKit (`--no-cache-filter=prod-deps,build`).
     - Verificación de arranque del contenedor con Node 22.
     - Gate de calidad `npm run check:quick` pasando al 100% (406 tests API, 305 tests Web, 16 tests MCP, build shared y typecheck de monorepo).
  3. **Registro y Aprendizaje**:
     - Documentado post-mortem en `.agents/memories/postmortem-prisma-engines-docker-build.md`.
  4. **Release y Despliegue en GitHub Actions**:
     - PR #63 (`fix(api): ...`) aprobado y fusionado en `main`.
     - PR #64 (`chore(main): release 0.10.4`) generado por Release Please y fusionado en `main`.
     - Flujo `Release Please` ejecutado exitosamente con tag `v0.10.4`.
     - Flujo `Deploy to Homelab` (`deploy-on-release`) completado al 100% en verde:
       - Build & Push API Image (GHCR): ✓ (4m26s sin fallos de Prisma)
       - Build & Push Web Image (GHCR): ✓ (3m19s)
       - Deploy to VM (Self-Hosted): ✓ (1m28s)
       - Prune Old GHCR Images: ✓ (15s)

---

## 2.1. Sesión Anterior: Remediación de Hallazgos Medios (M-01 a M-03 - PR #59)

- **Fecha:** 2026-10-14
- **Objetivo:** Resolución de Hallazgos Medios M-01 a M-03 (Disponibilidad Pilotos, Warmup/QueryProvider Offline, Soft Delete y Sanitización) + Suites de Anti-regresión (PR #59).
- **Autor / Ejecutor:** Agente Asistente de IA (Antigravity) en coordinación con el Desarrollador.
- **Entregables Realizados:**
  1. **M-01: Caché Serializable, Bloques Horarios y Resiliencia en Google Calendar**:
     - Desacople de `dateKey` del queryKey en `usePilotosDisponibilidadEfectiva` (clave basada en IDs de pilotos ordenados), evitando $N$ peticiones por cada cambio de día en calendario.
     - Retorno de `Record<number, ...>` plano en lugar de `Map` para garantizar persistencia offline en `PersistQueryClientProvider`.
     - Implementación de `pilotosDisponiblesEnBloque` en `agendas.util.ts` e integración en `AgendaBloqueHorario.tsx`.
     - Caché en memoria de 5 min para `getSchoolName()` eliminando N+1 hacia `Empresa` y timeout de 10s en llamadas HTTP a Google Calendar API.
  2. **M-02: Warmup por Rol, Persistencia Offline y Shape Optimista**:
     - Filtro condicional por rol en `useWarmupData.ts` (omite pasajeros/reservas/tarifas para `PILOTO`, y deslindes para `RECEPCION`, eliminando ráfagas 403).
     - Persistencia de `['vuelos', 'calendario', ...]` en IndexedDB via `shouldPersistQuery` en `QueryProvider.tsx` (buster `v4-calendario-offline`).
     - Población de `nombre` y `estado: 'PENDIENTE'` en pasajero optimista en `useReservas.ts`.
  3. **M-03: Soft Delete Completo, Sanitización de Variables y Validación Zod**:
     - Inclusión de `'Tarifa'`, `'Promocion'` y `'Faq'` en `SOFT_DELETE_MODELS` de `prisma.ts`.
     - Reemplazo seguro mediante función de sustitución en `PlantillasService.render` para evitar corrupción por caracteres `$`.
     - Validación Zod con `CreatePlantillaMensajePayloadSchema.partial().parse` en `PlantillasController.update`.
  4. **Suites de Anti-regresión Dedicadas**:
     - `usePilotosDisponibilidadEfectiva.antirregresion.test.tsx` (3 tests).
     - `QueryProvider.antirregresion.test.tsx` (4 tests).
     - `useReservas.optimistic-pasajero.antirregresion.test.tsx` (1 test).
     - `prisma.soft-delete.antirregresion.test.ts` (2 tests).
     - `plantillas.controller.antirregresion.test.ts` (2 tests).
     - Tests en `google-calendar.service.test.ts` (timeouts y caché de escuela).
     - Tests en `agendas.util.test.ts` (`pilotosDisponiblesEnBloque`).
- **Evidencia de Calidad:**
  - Build de `@parapente/shared` exitoso.
  - Monorepo `typecheck` (`tsc --noEmit`) en los 4 workspaces con 0 errores de tipos.
  - Quality gate `npm run check:quick` pasando al 100%: Web (53 suites, 298 tests), API y MCP (15 tests).
  - Verificación `npm run lint` en Web con 0 errores y 0 advertencias (`--max-warnings 0`).
  - Formateo incremental `npm run format` aplicado.
  - Integración limpia con `main` tras merge de PR #60 y #61.

---

## 2.1. Sesión Anterior (2026-10-14): Remediación de Puntos Críticos (C-01 a C-08 - PR #60)
- **Objetivo:** Plan de Remediación Inmediata de Puntos Críticos (C-01 a C-08) y Desfase Horario de Bloques (A-01) con Suite de Antirregresión (PR #60).
- **Autor / Ejecutor:** Agente Asistente de IA (Antigravity) en coordinación con el Desarrollador.
- **Entregables Realizados:**
  1. **C-01 (Seguridad Operacional de Pista y Clima en Pantalla)**:
     - `meteorologia.service.ts`: respeto estricto del último estado manual de pista si es `CERRADA` o `PRECAUCION`, o derivación automática por viento (>=35 km/h cerrada, >=25 km/h precaución) y rachas (>=45 km/h cerrada, >=35 km/h precaución).
     - `public.service.ts`: eliminación del objeto meteorológico falso por fallback en `/api/public/pantalla`; se retorna `clima ?? null`.
  2. **C-02 (Eliminación de Respuestas Falsas HTTP 200 [] ante Caídas de BD)**:
     - Eliminación del retorno silencioso de arreglos vacíos `[]` en `reservas.query.ts`, `vuelos.crud.ts`, `pilotos.service.ts`, `equipos.service.ts` y `configuracionBloques.ts`; ahora lanzan `throw err` para que Fastify responda con HTTP 500 y no oculte caídas de base de datos.
     - Suites unitarias `pilotos.service.test.ts` y `reservas.query.test.ts` actualizadas para validar que se relanza el error.
  3. **C-03 (Control de Acceso RBAC en Vuelos, Reservas, Meteorología y Catálogos)**:
     - Mutaciones en `vuelos.ts`, `meteorologia.routes.ts` y lectura/escritura de reservas en `reservas.ts` protegidas con preHandler `adminOrRecepcion`.
     - `vuelos.controller.ts`: validación en `updateEstado` de que usuarios con rol `PILOTO` solo puedan alterar el estado de sus propios vuelos asignados (HTTP 403 en caso contrario).
     - Lectura de catálogos (`tarifas.ts`, `promociones.ts`, `reglasOperativas.ts` y `pantalla.routes.ts`) habilitada para `RECEPCION` además de `ADMIN`.
     - `POST /pantalla/link/regenerate` reservado exclusivamente para `ADMIN`.
  4. **C-04 (Ruta PATCH /api/pasajeros/:id y Limpieza de Vuelos Huérfanos al Modificar Reserva)**:
     - `pasajeros.ts`: corregida la ruta de `fastify.patch('/')` a `fastify.patch('/:id')`.
     - `reservas.crud.ts`: cancelación (`estado: CANCELADO`) y soft-delete de vuelos activos asociados a pasajeros removidos durante la edición de reservas.
  5. **C-05 (Vigencia y Revocación de Tokens DIARIO en PantallaTokensService)**:
     - `pantallaTokens.service.ts`: corrección de la verificación de vigencia y revocación usando la marca de tiempo actual `ahora = new Date()` en vez de `finDeHoy()`.
  6. **C-06 (Prevención de Bucle Infinito de Login y Limpieza de Estado en authStore.ts)**:
     - `authStore.ts`: `logout` ahora remueve `last_user_id` y purga `parapente-query-cache` de IndexedDB; `initialize` elimina cookies huérfanas si no existe usuario en `localStorage`, impidiendo bucles de redirección infinitos.
     - `authStore.test.ts` actualizado con pruebas unitarias y tipado estricto sin `any`.
  7. **C-07 (Protección contra Colisiones P2002 en Soft-Delete de PlantillaMensaje y User)**:
     - `plantillas.service.ts`: uso de `findUnique` en `initSeeds` para evitar violar el constraint `@unique(tipo)` ante plantillas previamente eliminadas con soft-delete.
     - `users.routes.ts`: en el soft-delete de usuarios, se anonimiza el email (`anon_${id}_${Date.now()}@deleted.local`), se resetea `pilotoId` y `googleId` a `null` y se incrementa `sessionVersion`.
  8. **C-08 y A-01 (Fail-Fast en Índices Especiales y Corrección de Timezone en Bloques)**:
     - `indexes-especiales.ts`: fail-fast relanzando el error (`throw err`) ante cualquier fallo en DDL/índices especiales en lugar de silenciarlo.
     - `bloques.ts`: `resolverConfiguracion` ahora utiliza la función canónica `dateKeyLocal()` (`America/Santiago`) en lugar de `new Date().toISOString().slice(0, 10)` (UTC), eliminando el desfase nocturno de franjas horarias.
  9. **Suite Completa de Antirregresión**:
     - `apps/api/src/services/__tests__/antiregression-remediaciones.test.ts`: 16 pruebas unitarias específicas para blindar C-01, C-02, C-03, C-04, C-05, C-07, C-08 y A-01.
     - Pruebas adicionales en `configuracion.test.ts`, `pantalla.test.ts`, `users.test.ts`, `reservas.query.test.ts` y `authStore.test.ts`.
- **Evidencia de Calidad:**
  - `build:shared` generado sin incidencias (CJS, ESM, DTS).
  - `typecheck` monorepo (`tsc --noEmit`) en `@parapente/shared`, `api`, `web` y `@parapente/mcp` finalizado con 0 errores.
  - Quality gate `npm run check:quick` ejecutado y aprobado con código 0.
  - Formateo incremental `npm run format:check` verificado con Prettier sin inconsistencias de estilo.


---

## 2.1. Sesión Anterior (2026-10-14): Remediación de Hallazgos de Severidad Alta (A-01 a A-09 - PR #61)
- **Objetivo:** Remediación Integral de los 9 Hallazgos de Severidad Alta (A-01 a A-09) de Pre-producción, Suite de Antirregresión y Creación de PR #61 a `main`.
- **Autor / Ejecutor:** Agente Asistente de IA (Antigravity) en coordinación con el Desarrollador.
- **Entregables Realizados:**
  1. **A-01: Zona Horaria Canónica en Bloques del Calendario**: Sustitución de `new Date().toISOString().slice(0, 10)` por `dateKeyLocal()` en `resolverConfiguracion` y uso de `horaLocalHHMM(start)` en `useCalendarioBlocks.ts`.
  2. **A-02: Validación Integral de Agendamiento, Bloques de Piloto y Atomicidad**: Validación de bloques horarios (`PilotoDisponibilidadBloque`) y horas ocupadas en `sugerirPiloto` y `autoAssignVuelos`; validación de piloto activo y rango de peso en `validateWeightAndConflict`; atomicidad transaccional con `FOR UPDATE` y soft-delete de vuelos previos del pasajero en `createVuelo`.
  3. **A-03: Encolado Completo de Operaciones Múltiples en PagosModal (Offline Outbox)**: Reemplazo del aborto prematuro por `ejecutarPaso` secuencial con incremento optimista de versión (`versionActual + 1`) ante `isQueuedError`, garantizando persistencia íntegra de pagos, devoluciones y estados de pasajeros sin pérdidas.
  4. **A-04: Deducción Real de Versión en Reintento 409 del Outbox y Exclusión de Lecturas POST**: Implementación de `resolveVersionLookupUrl` para obtener versión fresca de la entidad propietaria en reintentos 409 y delegación directa a `typedApi` (sin headers de outbox) para endpoints de sólo lectura (`asignacionAutomatica`, `calcularValor`, `sugerir`, `renderizar`).
  5. **A-05: Persistencia de Configuración de Módulos Premium**: Montaje del volumen `./apps/api/modules.config.json` en `docker-compose.yml` para el servicio API, preservando cambios en caliente a través de despliegues y recreaciones de contenedores.
  6. **A-06: Trazabilidad Legal en Deslindes**: Consulta de `deslindeVersion` activa para fijar `versionLegal` real y actualización de `createdAt` en la firma/re-firma tanto en el endpoint interno como público.
  7. **A-07: Auto-Resolución de Token en /pantalla y Anti-Doble Submit en Calendario**: Espera de sesión y auto-hidratación del token del día para administradores en `/pantalla`, actualización de QR al tablero en vivo, y guard síncrono (`submittingRef`) con estado reactivo `isSubmitting` en `useCalendarioModal.ts`.
  8. **A-08: Cierre Ordenado de Schedulers, Limpieza de Métricas y Headers de Trazabilidad**: Limpieza de timers/intervals de schedulers (higiene, meteo, notificaciones, calendar, cierre contable) al recibir SIGTERM/SIGINT, limpieza del registry de `prom-client` en `onClose`, y propagación de `x-request-id` y `traceparent` en respuestas API.
  9. **A-09: Alineación de Contratos MCP y Prevención de Duplicados en Workflow**: Mapeo canónico de DTOs en `consultas.ts` (`ReglaOperativa`, `Promocion`) y `reservas.ts` (`deslindeFirmado`), y captura controlada con mensaje instructivo en `crear_y_agendar_reserva` si `agendarGrupo` falla tras crear la reserva.

---

## 2.2. Sesión Histórica (2026-10-14 - Madrugada): Triage y Cierre de Backlog PRs
- **Objetivo:** Triage Integral y Resolución de los 48 PRs Abiertos en GitHub, Consolidación de Suites de Pruebas y Cierre Definitivo de PRs (#16 y #52) (`test(api)`, `fix(api)`, `perf(api)`).
- **Entregables Realizados:**
  1. **Triage y Mergeo de 10 PRs de Alto Valor**: `#9`, `#18`, `#19`, `#20`, `#24`, `#28`, `#29`, `#34`, `#40`, `#44`.
  2. **Cierre Masivo Justificado de 29 PRs Incompletos o Redundantes**: Descartados y cerrados con explicación técnica individual y ramas remotas eliminadas.
  3. **Consolidación de la Suite de Ciclo de Vida de Reservas**: Unificación de 6 PRs fragmentados (`#22`, `#33`, `#36`, `#39`, `#41`, `#43`) en `apps/api/src/services/__tests__/reservas.ciclo-vida.test.ts`.
  4. **Publicación de Versiones Automáticas (Release Please)**: Sincronización de releases `v0.10.1` (#57) y `v0.10.2` (#58).
  5. **Aplicación Quirúrgica y Cierre de PR #16 y PR #52**: Longitud mínima de 32 caracteres para `JWT_SECRET` (#16) y paralelización de `pilotosTopRaw` en métricas (#52).
  6. **Hito de Limpieza de Backlog**: 0 PRs abiertos restantes en el repositorio previo a la apertura de PR #61.

---

## 2.3. Sesión Histórica (2026-10-13): Auditoría y Endurecimiento Operativo

---

## 3. Tareas en Curso (WIP) y Backlog Inmediato

### En Curso (WIP)
- [x] Remediación y verificación de los 9 hallazgos de severidad ALTA (A-01 a A-09) fusionada en `main` (#61).
- [x] Plan de remediación inmediata de vulnerabilidades críticas C-01 a C-08 y desfase horario de bloques A-01 (`fix(security,sre)`).
- [x] Suite de pruebas automatizadas de antirregresión integrada en monorepo.
- [x] Quality Gate `npm run check:quick` verificado al 100% (591 tests pasando).
- [x] Pull Request abierto hacia `main`: [#60 (fix(security,sre): remediate critical vulnerabilities C-01 to C-08 and add anti-regression suite)](https://github.com/Zer0x25/paraglide-2.0/pull/60).

### Siguiente Acción Prioritaria (Next Action)
- [ ] **Revisión y Mergeo de PR #60**: Esperar checks de CI y fusionar hacia `main`.
- [ ] **Revisión de Release PR**: Monitorear el PR automático de `release-please` generado en GitHub tras la fusión para el próximo release.
- [ ] **Hardening Operacional Pendiente**:
  - Script cron de backup automatizado para Postgres en Docker (`pg_dump` con rotación).
  - Configuración de alertas en Caddy / healthchecks hacia canal de monitoreo o webhook.
  - Headers de seguridad HTTP recomendados en reverse proxy (CSP, HSTS).

---

## 4. Bitácora de Aprendizaje y Memoria Operativa

1. **Seguridad de Base de Datos y Aislamiento**:
   - *Lección*: Nunca asumir que `localhost:5432` es el puerto de desarrollo. En este proyecto, el puerto `5678` es Producción viva. Dev es estrictamente `:5679` y Staging `:5680`. Cualquier script automatizado debe validar este puerto antes de emitir conexiones.
2. **Formateo Incremental de Código vs Markdown**:
   - *Lección*: `scripts/format.mjs` excluye deliberadamente los archivos `.md`. Reformatear Markdown con Prettier destruye el alineamiento de tablas y genera ruido innecesario en diffs de Git. El formateo con Prettier aplica exclusivamente a código y JSON modificado.
3. **Flakiness en Tests E2E de Playwright**:
   - *Lección*: Cuando se ejecutan pruebas con JWT simulados, cualquier llamada a `/api/` no interceptada retorna un 401 que redirige a `/login`, causando falsos positivos. Se debe usar siempre el helper `mockAppShellApi` (`tests/helpers/api-mocks.ts`).
4. **Manejo de Dinero con Precisión Decimal**:
   - *Lección*: Operadores nativos de JavaScript (`+`, `-`, `*`) introducen errores de coma flotante inadmisibles en contabilidad. Usar invariablemente `toNum()` de `money.util.ts` (`Decimal(12,2)`).
5. **Side Effects y Transacciones**:
   - *Lección*: La emisión de eventos SSE (`broadcastDatos`) nunca debe ocurrir dentro de un bloque `$transaction`. Debe emitirse exclusivamente después del commit exitoso para evitar notificaciones sobre datos revertidos.
6. **Permisos de GitHub Container Registry (GHCR) tras Renombrar Repositorios**:
   - *Lección*: Al bifurcar o migrar un proyecto a un nuevo repositorio (ej. de `paraglide` a `paraglide-2.0`), el `${{ secrets.GITHUB_TOKEN }}` del nuevo repo no tiene permisos de sobreescritura sobre imágenes publicadas bajo el paquete anterior. Los nombres de las imágenes deben namespacizarse al nuevo repo (`paraglide-2.0-api`, `paraglide-2.0-web`) para que GHCR cree paquetes automáticamente vinculados al repo actual.
7. **Desacople Arquitectónico CI vs CD**:
   - *Lección*: CI (validación de código) debe ser rápido, sin Docker y correr en cada push/PR. CD (imágenes y deploy a servidor) debe ser condicional (bajo demanda, manual o tags de release) para no saturar runners, registries ni reiniciar servicios en vivo en cada micro-commit.
8. **Preservación del Contexto de Evento en Workflows Reutilizables (`workflow_call`)**:
   - *Lección*: En GitHub Actions, al invocar un workflow reutilizable con `uses: ./.github/workflows/deploy.yml`, `${{ github.event_name }}` hereda el evento inicial (`push`), no `'workflow_call'`. Evaluar inputs declarados (`[ -n "${{ inputs.build_images }}" ]`) es el mecanismo infalible para detectar llamadas reutilizables y dispatches manuales.
9. **Supresión Inteligente de CI en Merges de PR**:
   - *Lección*: Tras aprobar un PR que ya superó el CI, el commit de merge a `main` no necesita volver a ejecutar todas las suites. Detectar merges (`Merge pull request #`) y commits de release (`chore(main): release`) permite omitir ejecuciones redundantes y resolver el Quality Gate en 2 segundos.
10. **Re-asociación de Runners Self-Hosted al Migrar Repositorios**:
    - *Lección*: Si se clona o bifurca el repo en GitHub, los daemons de runners self-hosted (`actions-runner.service`) siguen escuchando al repositorio anterior hasta que se re-registren explícitamente con `./config.sh` apuntando a la nueva URL.
11. **ADR 013 y Concurrencia de Sesiones en Tests E2E de Playwright**:
    - *Lección*: Cuando se ejecutan pruebas E2E contra un backend vivo (Staging o Dev) autenticadas con el mismo usuario administrativo, el paralelismo con múltiples workers invalida sesiones concurrentes (`SESSION_REVOKED` de ADR 013). Para tests con login administrativo real, estructurar los flujos en suites seriales atómicas (`test.describe.serial`) y limitar la concurrencia (`workers: 1`) para evitar revocaciones inesperadas de sesión.
12. **Antirregresión y Zonas Horarias en Pruebas Unitarias**:
    - *Lección*: Cuando se prueban cálculos horarios dependientes de zona horaria local (`America/Santiago`), fijar la fecha del sistema (`vi.setSystemTime`) con offsets UTC puede simular horas nocturnas (ej. 23:30 local = 02:30 UTC siguiente) donde la fecha civil UTC avanza al día siguiente. La lógica de negocio y las pruebas deben siempre normalizar con `dateKeyLocal()` / `horaLocalHHMM()` para evitar desajustes entre el reloj del servidor y la jornada operativa de Chile.
13. **Tipado Estricto en Tests y ESLint con `--max-warnings 0`**:
    - *Lección*: En `apps/web`, el linter de CI ejecuta ESLint con `--max-warnings 0` sobre todo el workspace incluyendo `__tests__`. Casteos relajados como `as any` disparan fallos en `@typescript-eslint/no-explicit-any` en CI aunque el test pase en Vitest. En tests de frontend se deben utilizar contratos tipados explícitos (`as unknown as TargetType` o `Parameters<typeof hook>[0]`) para asegurar paridad estricta entre Vitest local y el Quality Gate de GitHub Actions.
