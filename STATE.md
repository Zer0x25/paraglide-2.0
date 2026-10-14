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

- **Fecha:** 2026-10-13
- **Objetivo:** Auditoría Exhaustiva de Pre-producción y Remediación de Vulnerabilidades Críticas y Brechas Operativas / SRE (`fix(security,sre)`).
- **Autor / Ejecutor:** Agente Asistente de IA (Antigravity) en coordinación con el Desarrollador.
- **Entregables Realizados:**
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
     - Suite unitaria `authStore.test.ts` actualizada para reflejar los nuevos atributos de seguridad.
- **Evidencia de Calidad:**
  - Monorepo `typecheck` (`tsc --noEmit`) en `@parapente/shared`, `api`, `web` y `@parapente/mcp` finalizado con 0 errores.
  - Quality gate `npm run check:quick` ejecutado y aprobado con código 0 (50 archivos de test en web con 283 tests pasando, suite unitaria api y 15 tests unitarios en mcp).
  - Formateo incremental `npm run format` ejecutado y verificado sobre todos los archivos modificados.
  - Aislamiento inmutable de BD respetado (sin referencias a puerto 5678).

---

## 3. Tareas en Curso (WIP) y Backlog Inmediato

### En Curso (WIP)
- [x] Auditoría exhaustiva de pre-producción y remediación de vulnerabilidades críticas (`fix(security,sre)`).
- [x] Fusión limpia con `main` resolviendo conflictos en controladores, servidor y documentación.
- [x] Validación completa de CI local y verificación de tipos monorepo (`check:quick`).
- [x] **Ampliación y Verificación de Cobertura E2E contra Staging**:
  - Ejecución exitosa de suite maestra Staging (7/7 suites, 49/49 pasos).
  - Creación de suite E2E Live CRUD (`e2e-live-crud.spec.ts`): login, piloto, reserva y calendario contra Staging real.
  - Creación de suite E2E Módulos Premium & Pantalla TV (`modulos-premium.spec.ts`): TV FIDS, equipos, meteo, auditoría, config.
  - Creación de suite E2E Responsive Móvil 375px (`responsive-mobile.spec.ts`): cumplimiento de DoD, sin desbordamiento horizontal (`scrollWidth <= clientWidth`).

### Siguiente Acción Prioritaria (Next Action)
- [ ] **Revisión de Release PR**: Monitorear el PR automático de `release-please` generado en GitHub tras los commits `fix(...)` para preparar el release productivo (ej. v0.9.6).
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
