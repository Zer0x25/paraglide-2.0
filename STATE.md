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
- **Objetivo:** Auditoría Exhaustiva de Pre-producción (Production-Readiness Review) y Endurecimiento Crítico (Resiliencia, Seguridad, UX Concurrente y SRE).
- **Autor / Ejecutor:** Agente Asistente de IA (Antigravity) en coordinación con el Desarrollador.
- **Entregables Realizados:**
  1. **Auditoría Holística de Pre-producción**: Evaluación de 5 dimensiones críticas (Arquitectura/Concurrencia, Seguridad/Resiliencia, Day-2 SRE, Producto/UX, y Cumplimiento de Invariantes).
  2. **Fix Fastify `trustProxy` (Commit `2682659`)**: Habilitación de `trustProxy: true` para que Fastify extraiga la IP real del cliente detrás del reverse proxy Caddy y Next.js rewrite, restaurando precisión de rate-limiting y auditoría.
  3. **Graceful Shutdown & OTEL Gating (Commit `e60002c`)**: Cierre ordenado de conexiones HTTP de Fastify y pool de Prisma ante `SIGTERM`/`SIGINT`. Condicionamiento del exportador de trazas en consola a `OTEL_CONSOLE_EXPORTER=true`.
  4. **Eliminación de Mock Meteorológico Ficticio (Commit `7b2f0ba`)**: Supresión del fallback benigno hardcodeado (`estadoPista: 'ABIERTA'`) cuando la BD falla, propagando el error real para no habilitar vuelos sin telemetría confirmada.
  5. **Verificación de DB en Healthcheck Público (Commit `a77714a`)**: Adición de ping activo `SELECT 1` a Postgres en `/health`. Si la BD no responde, el endpoint retorna HTTP 503 permitiendo al orquestador intervenir.
  6. **Debounce de Invalidaciones SSE en Web (Commit `1de5187`)**: Ventana de debounce de 300ms en `useDatosStream` para agrupar ráfagas de eventos `datos-cambios` y evitar tormentas de re-fetching que colapsen el pool de Prisma (`connection_limit=10`).
  7. **Prevención de Doble Submit en Reservas (Commit `743717c`)**: Guard de reentrada síncrono, deshabilitación de botones y spinner en `ReservaFormModal`, con prueba unitaria antirregresión añadida en `useReservasController.antirregresion.test.tsx`.
  8. **Guardrail Hook Pre-Tool para Base de Datos (Commit `c427793`)**: Hook automatizado que intercepta llamadas de terminal y deniega en tiempo de ejecución referencias a la base o puerto de producción (`5678`).
- **Evidencia de Calidad:**
  - `npm run check:quick`: 0 fallos (build shared, typecheck 4 workspaces, 31 suites api, 50 suites web, 1 suite mcp).
  - Formato incremental Prettier aplicado sobre todos los archivos de código modificados.
  - Pushed a `origin/main` (commit `c427793`).

---

## 3. Tareas en Curso (WIP) y Backlog Inmediato

### En Curso (WIP)
- [x] Auditoría exhaustiva de pre-producción y aplicación de 6 parches críticos de resiliencia y seguridad.
- [x] Push de parches atómicos a `origin/main`.
- [x] Validación completa de CI local y verificación de tipos monorepo (`check:quick`).

### Siguiente Acción Prioritaria (Next Action)
- [ ] **Despliegue y Validación en Staging**: Levantar o actualizar el stack de staging (`npm run staging:up`) y correr la suite de estrés/integración de staging (`npm run test:staging:quick`).
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
