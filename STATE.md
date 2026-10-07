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
- **Objetivo:** Auditoría de Gobernanza, Detección de Sobreingeniería e Implementación Lean.
- **Autor / Ejecutor:** Agente Asistente de IA (Antigravity) en coordinación con el Desarrollador.
- **Entregables Realizados:**
  1. **Governance Tiering**: Introducción de 3 niveles de rigor en [`docs/gobernanza.md`](docs/gobernanza.md) y [`AGENTS.md`](AGENTS.md) (Tier 1 Architectural, Tier 2 Standard, Tier 3 Fast-Track), eliminando burocracia para cambios pequeños.
  2. **Invocación Ágil**: Rediseño de [`PROMPT-MAESTRO.md`](PROMPT-MAESTRO.md) a 3 líneas (`Objetivo`, `Tier`, `Autonomía`), preservando la plantilla formal para Tier 1.
  3. **Living Spec Template**: Compactación de [`specs/TEMPLATE.md`](specs/TEMPLATE.md) (de 103 a ~48 líneas) eliminando código Zod duplicado y apuntando a fuentes canónicas.
  4. **Corrección de Hook de Seguridad**: Fix de la ruta relativa en `.agents/hooks.json` a `./scripts/guard-dev-db.sh`.
  5. **Desincronización Espejo Resuelta**: Conversión de `.agents/agents/` en symlinks hacia `.github/agents/`.
  6. **Resiliencia Operativa en Scripts**: Guarda en `scripts/format.mjs` para evitar fallos si `node_modules` aún no está instalado.
- **Evidencia de Calidad:**
  - Sintaxis JSON verificada en `.agents/hooks.json`.
  - Hook y scripts probados en local.
  - Formato incremental y reglas inmutables de seguridad preservadas al 100%.

---

## 3. Tareas en Curso (WIP) y Backlog Inmediato

### En Curso (WIP)
- [x] Documentar marco de gobernanza en [`docs/gobernanza.md`](docs/gobernanza.md) y [`docs/README.md`](docs/README.md).
- [x] Establecer plantillas y especificación de referencia en [`specs/`](specs/README.md).
- [x] Formalizar Definition of Done (DoD) en [`AGENTS.md`](AGENTS.md).

### Siguiente Acción Prioritaria (Next Action)
- [ ] Ejecutar instalación de dependencias base (`npm install`) para habilitar el gate de pruebas rápidas (`npm run check:quick`).
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
