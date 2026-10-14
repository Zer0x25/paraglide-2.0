# STATE — Estado del Sistema, Seguimiento y Aprendizaje

Este documento mantiene el estado de ejecución, trazabilidad de sesiones, evidencia de calidad y bitácora de aprendizaje continuo del proyecto **Paraglide**.

---

## 1. Estado Global del Monorepo

| Dimensión | Valor / Estado | Notas |
|---|---|---|
| **Fase Activa del Roadmap** | Fase 5 & Gobernanza Lean | Ver [`docs/roadmap.md`](docs/roadmap.md) y [`PRD.md`](PRD.md). |
| **Arquitectura de Gobernanza** | Activa (Lean 3-Tier + 7 Pilares) | Tier 1 Architectural, Tier 2 Standard, Tier 3 Fast-Track. |
| **Bases de Datos** | Dev `:5679` / Staging `:5680` | Producción `:5678` aislado y protegido. |
| **Módulos Core** | 6 Módulos Operativos | `/`, `/pilotos`, `/reservas`, `/calendario`, `/analiticas`, `/auditoria`. |
| **Módulos Premium** | Runtime Toggleable | Controlados vía `modules.config.json` y SSE. |

---

## 2. Última Sesión de Trabajo

- **Fecha:** 2026-10-14
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
- **Evidencia de Calidad:**
  - **Suites de Antirregresión Dedicadas (A-01 a A-09)**:
    - **A-01**: `apps/api/src/routes/__tests__/configuracionBloques.test.ts` (resolución canónica a las 23:30 Santiago sin marcar día actual como pasado).
    - **A-02**: `apps/api/src/services/__tests__/pilotos.service.test.ts` (`sugerirPiloto` con `disponibilidadBloques` y choque horario) y `apps/api/src/services/__tests__/vuelos.service.test.ts` (`createVuelo` limpiando vuelos previos activos en transacción atómica).
    - **A-03**: `apps/web/src/components/pagos/__tests__/usePagosModalController.test.ts` (encolado offline secuencial de pagos, devoluciones y estado con bump de versión optimista e información vía `toast.info`).
    - **A-04**: `apps/web/src/services/outbox/__tests__/outbox.service.test.ts` (resolución de versión raíz para `/reservas/:id/pagos` y `/vuelos/agendamiento-grupo`) y `apps/web/src/services/__tests__/apiOutbox.test.ts` (bypass directo sin `X-Outbox` para endpoints POST de lectura).
    - **A-05**: `apps/api/src/services/__tests__/modules.service.test.ts` (validación de IDs, persistencia a disco y emisión SSE `broadcastModulos`).
    - **A-06**: `apps/api/src/services/__tests__/public.service.test.ts` y `apps/api/src/services/__tests__/pasajeros.service.test.ts` (asociación de `versionLegal` activa desde `deslindeVersion` en firmas públicas e internas).
    - **A-07**: `apps/web/src/app/pantalla/pantalla.test.tsx` (auto-hidratación de token diario desde `/pantalla/link`) y `apps/web/src/app/calendario/hooks/__tests__/useCalendarioModal.test.ts` (bloqueo síncrono de doble submit con `submittingRef`).
    - **A-08**: `apps/api/src/services/__tests__/schedulers.shutdown.test.ts` (parada limpia de 5 schedulers y propagación de `x-request-id` y `traceparent` en Fastify).
    - **A-09**: `apps/mcp/src/__tests__/tools.test.ts` (instrucciones guiadas anti-duplicados y manejo de 409 en MCP).
  - `npm run check:quick`: Código de salida `0` limpio (build `@parapente/shared`, typecheck estricto en 4 workspaces, 34 suites en API con 283 tests pasando, 52 suites en Web con 291 tests pasando, 1 suite en MCP con 16 tests pasando — **590 tests unitarios en total**).
  - Formato incremental Prettier aplicado vía `npm run format`.
  - Commits atómicos con convención Conventional Commits aplicados en rama `fix/high-severity-findings`.
  - PR #61 creado hacia `main`, verificado y resuelto ante conflictos de sincronización con `origin/main`.

---

## 2.1. Sesión Anterior (2026-10-14 - Madrugada)
- **Objetivo:** Triage Integral y Resolución de los 48 PRs Abiertos en GitHub, Consolidación de Suites de Pruebas y Cierre Definitivo de PRs (#16 y #52) (`test(api)`, `fix(api)`, `perf(api)`).
- **Entregables Realizados:**
  1. **Triage y Mergeo de 10 PRs de Alto Valor**: `#9`, `#18`, `#19`, `#20`, `#24`, `#28`, `#29`, `#34`, `#40`, `#44`.
  2. **Cierre Masivo Justificado de 29 PRs Incompletos o Redundantes**: Descartados y cerrados con explicación técnica individual y ramas remotas eliminadas.
  3. **Consolidación de la Suite de Ciclo de Vida de Reservas**: Unificación de 6 PRs fragmentados (`#22`, `#33`, `#36`, `#39`, `#41`, `#43`) en `apps/api/src/services/__tests__/reservas.ciclo-vida.test.ts`.
  4. **Publicación de Versiones Automáticas (Release Please)**: Sincronización de releases `v0.10.1` (#57) y `v0.10.2` (#58).
  5. **Aplicación Quirúrgica y Cierre de PR #16 y PR #52**: Longitud mínima de 32 caracteres para `JWT_SECRET` (#16) y paralelización de `pilotosTopRaw` en métricas (#52).
  6. **Hito de Limpieza de Backlog**: 0 PRs abiertos restantes en el repositorio previo a la apertura de PR #61.

---

## 2.2. Sesión Histórica (2026-10-13)
  1. **Auditoría Holística y Endurecimiento de Resiliencia**:
     - `trustProxy: true` habilitado en Fastify para restaurar precisión de IP real del cliente detrás del proxy Caddy.
     - Supresión del mock benigno en meteorología (`7b2f0ba`) y ping activo `SELECT 1` a Postgres en `/health` retornando 503 ante fallas (`a77714a`).
     - Debounce de 300ms en `useDatosStream` para ráfagas SSE (`1de5187`) y prevención de doble submit con guard síncrono en reservas (`743717c`).
     - Guardrail hook Pre-Tool para aislamiento inmutable de la base de producción (`5678`) (`c427793`).
  2. **Aislamiento y rotación de tokens de calendario**:
     - Acceso condicional en `CalendarController.getSyncInfo`: usuarios con rol `PILOTO` solo acceden a su propio feed ICS; feed universal oculto y protegido para administradores.
     - En `regenerateFeedToken`, validación de que un piloto solo puede rotar su propio token y únicamente administradores pueden rotar el universal.
     - Endpoint `/reconcile` protegido exclusivamente para `ADMIN`.
  3. **Validaciones de entrada estrictas en API y mitigación de inyecciones**:
     - `gastos.controller.ts`: validación de montos numéricos finitos > 0, fechas válidas y longitudes de texto.
     - `public.controller.ts`: validación de rango de peso límite en deslinde público (0 a 200 kg).
     - `plantillas.service.ts`: sanitización de variables HTML en renderizado de plantillas.
     - `vuelos.lifecycle.ts`: verificación de disponibilidad de piloto y estado de equipos antes de agendar.
  4. **Control de acceso y autorización RBAC**:
     - Adición de `RouteShorthandOptions` con preHandlers de autorización (`onlyAdmin` y `adminOrRecepcion`) en rutas de `equipos`, `pasajeros`, `pilotos`, `plantillas`, `reportes`, `reservas`, `metricas` y `gastos`.
     - `pilotos.controller.ts`: función de aserción `assertCanEditPilotoDisponibilidad` que impide a pilotos alterar disponibilidad ajena.
  5. **Seguridad y ciclo de vida SSE con Graceful Shutdown**:
     - Introducción de tickets efímeros de un solo uso (`emitirSseTicket` / `consumirSseTicket`) en `eventos.routes.ts` para eliminar tokens JWT de query strings.
     - Cierre ordenado de conexiones SSE activas (`closeAllSseConnections`) integrado en el shutdown graceful del servidor en `server.ts` con timeout forzado de 8s.
  6. **Observabilidad y SRE**:
     - Supresión de tracing OTEL en healthchecks (`/api/public/health`) y recursos estáticos (`/favicon.ico`, `/assets/`, `/sw.js`, etc.) en `observability.plugin.ts` para evitar saturación de logs.
     - Configuración de rotación de logs `json-file` (`max-size: 10m`, `max-file: 3`) en `docker-compose.yml`.
  7. **Autenticación y Cookies Seguras**:
     - `auth.service.ts`: bloqueo de auto-aprovisionamiento con Google SSO si el email no existe previamente en la base de datos.
     - `authStore.ts`: flags seguras en cookies (`SameSite=lax`, `path=/`, `secure` condicional a HTTPS) y limpieza simétrica en logout.

---

## 3. Tareas en Curso (WIP) y Backlog Inmediato

### En Curso (WIP)
- [x] Remediación y verificación de los 9 hallazgos de severidad ALTA (A-01 a A-09).
- [x] Implementación de suite completa de pruebas unitarias de antirregresión para los 9 hallazgos.
- [x] Gate obligatorio `npm run check:quick` verificado con salida 0 (590 tests pasando).
- [x] PR #61 abierto hacia `main`, rebase/merge con `origin/main` limpio y sin conflictos.

### Siguiente Acción Prioritaria (Next Action)
- [ ] **Merge de PR #61 a `main`**: Fusión y cierre de PR #61.
- [ ] **Despliegue y Validación en Staging**: Levantar o actualizar el stack de staging (`npm run staging:up`) y correr la suite de estrés/integración de staging (`npm run test:staging:quick`).
- [ ] **Revisión de Release PR**: Monitorear el PR automático de `release-please` generado en GitHub tras los commits `fix(...)` para preparar el release productivo (ej. v0.10.3).
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
