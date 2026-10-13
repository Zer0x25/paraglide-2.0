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
- **Objetivo:** Remediación de vulnerabilidades críticas pre-producción y brechas operativas / SRE (parche `fix(security,sre)`).
- **Autor / Ejecutor:** Agente Asistente de IA (Antigravity) en coordinación con el Desarrollador.
- **Entregables Realizados:**
  1. **Aislamiento y rotación de tokens de calendario**:
     - Acceso condicional en `CalendarController.getSyncInfo`: si el usuario tiene rol `PILOTO`, solo se le expone su propio feed de vuelos y se oculta el feed universal.
     - En `regenerateFeedToken`, validación de que un piloto solo puede rotar su propio token y únicamente administradores pueden rotar el universal.
  2. **Validaciones de entrada estrictas en API**:
     - `gastos.controller.ts`: validación de montos numéricos finitos > 0, fechas válidas y longitudes de texto.
     - `public.controller.ts`: validación de rango de peso límite en deslinde público (0 a 200 kg).
     - `plantillas.service.ts`: sanitización de variables HTML en renderizado de plantillas.
     - `vuelos.lifecycle.ts`: verificación de disponibilidad de piloto y estado de equipos antes de agendar.
  3. **Control de acceso y autorización RBAC**:
     - Adición de `RouteShorthandOptions` con preHandlers de autorización (`onlyAdmin` y `adminOrRecepcion`) en rutas de `equipos`, `pasajeros`, `pilotos`, `plantillas`, `reportes`, `reservas`, `metricas` y `gastos`.
     - `pilotos.controller.ts`: función de aserción `assertCanEditPilotoDisponibilidad` que impide a pilotos alterar disponibilidad ajena.
  4. **Seguridad y ciclo de vida SSE**:
     - Introducción de tickets efímeros de un solo uso (`emitirSseTicket` / `consumirSseTicket`) en `eventos.routes.ts` para eliminar tokens JWT de query strings.
     - Cierre ordenado de conexiones SSE activas (`closeAllSseConnections`) integrado en el shutdown graceful del servidor en `server.ts`.
  5. **Observabilidad y SRE**:
     - Supresión de tracing OTEL en healthchecks (`/api/public/health`) y recursos estáticos (`/favicon.ico`, `/assets/`, `/sw.js`, etc.) en `observability.plugin.ts` para evitar saturación de logs.
     - Configuración de rotación de logs `json-file` (`max-size: 10m`, `max-file: 3`) en `docker-compose.yml`.
  6. **Autenticación y Cookies Seguras**:
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
- [x] Aplicar y verificar remediaciones de seguridad pre-producción y brechas operativas (`fix(security,sre)`).
- [x] Optimizar pipeline de CI/CD: separar CI rápido de CD con flags y corregir GHCR.
- [x] Documentar marco de gobernanza en [`docs/gobernanza.md`](docs/gobernanza.md) y [`docs/README.md`](docs/README.md).
- [x] Establecer plantillas y especificación de referencia en [`specs/`](specs/README.md).
- [x] Formalizar Definition of Done (DoD) en [`AGENTS.md`](AGENTS.md).

### Siguiente Acción Prioritaria (Next Action)
- [ ] Realizar commit atómico convencional `fix(security,sre): remediate pre-production critical vulnerabilities and operational gaps` con los cambios verificados.
- [ ] Redactar las siguientes especificaciones SDD+BDD para los módulos de Deslinde Digital y Asignación de Pilotos en pista (`specs/SPEC-002-DESLINDE.md`).

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
