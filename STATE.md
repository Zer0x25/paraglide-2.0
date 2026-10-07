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

- **Fecha:** 2026-10-07
- **Objetivo:** Optimización y Desacople de CI/CD: Quality Gate Automatizado, Corrección de Registro GHCR y Flags de Deploy.
- **Autor / Ejecutor:** Agente Asistente de IA (Antigravity) en coordinación con el Desarrollador.
- **Entregables Realizados:**
  1. **Separación CI vs CD**: Creación de workflow independiente `.github/workflows/ci.yml` que valida monorepo (`build:shared`, `typecheck`, `lint` y tests unitarios de api, web y mcp) en cada push y PR en ~2 min sin Docker ni VM.
  2. **Fix GHCR Package Namespace**: Corrección de nombres de imagen a `ghcr.io/zer0x25/paraglide-2.0-api` y `ghcr.io/zer0x25/paraglide-2.0-web`, resolviendo el fallo 403 por apuntar al repo legacy `paraglide`.
  3. **Control por Flags & Triggers en CD (`deploy.yml`)**:
     - `workflow_dispatch`: flags `build_images` y `deploy_to_vm` configurables por UI.
     - `push a main`: solo compila o despliega si el mensaje de commit incluye `[deploy]` o `[build-image]`, evitando deploys no deseados en micro-commits.
     - `tags v*.*.*`: release formal compila y despliega automáticamente.
  4. **Gate Pre-Deploy**: Incorporación de `npm run check:quick` como prerrequisito antes del build de imágenes Docker.
  5. **Sincronización de Compose y Configs**: Actualización de imágenes en `docker-compose.yml`, `docker-compose.staging.yml`, `.env.example`, `README.md` y rutas tolerantes en `scripts/deploy-status.sh`.
  6. **Integración Release Please + CD**: Configuración de `workflow_call` en `deploy.yml` y encadenamiento en `release-please.yml` para que al mergear el Release PR se dispare el build y deploy automáticamente.
  7. **Habilitación de Permisos de Actions**: Configuración de `can_approve_pull_request_reviews=true` y `default_workflow_permissions=write` vía API de GitHub para permitir que GitHub Actions cree Pull Requests automáticamente.
- **Evidencia de Calidad:**
  - Sintaxis YAML validada con parser estricto (`ci.yml`, `deploy.yml`, `release-please.yml`).
  - Nombres de imágenes y variables de entorno homologados al estándar monorepo.
  - Pull Request de Release creado exitosamente por el bot: [PR #2](https://github.com/Zer0x25/paraglide-2.0/pull/2).
  - DoD cumplido: aislamiento de DBs respetado y formateo verificado.

---

## 3. Tareas en Curso (WIP) y Backlog Inmediato

### En Curso (WIP)
- [x] Optimizar pipeline de CI/CD: separar CI rápido de CD con flags y corregir GHCR.
- [x] Documentar marco de gobernanza en [`docs/gobernanza.md`](docs/gobernanza.md) y [`docs/README.md`](docs/README.md).
- [x] Establecer plantillas y especificación de referencia en [`specs/`](specs/README.md).
- [x] Formalizar Definition of Done (DoD) en [`AGENTS.md`](AGENTS.md).

### Siguiente Acción Prioritaria (Next Action)
- [ ] Ejecutar instalación de dependencias base (`npm install`) para habilitar el gate de pruebas rápidas en local (`npm run check:quick`).
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
