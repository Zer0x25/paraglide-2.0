# STATE — Estado del Sistema, Seguimiento y Aprendizaje

Este documento mantiene el estado de ejecución, trazabilidad de sesiones, evidencia de calidad y bitácora de aprendizaje continuo del proyecto **Paraglide**.

---

## 1. Estado Global del Monorepo

| Dimensión | Valor / Estado | Notas |
|---|---|---|
| **Fase Activa del Roadmap** | Fase 5 & Gobernanza 2.0 | Ver [`docs/roadmap.md`](docs/roadmap.md) y [`PRD.md`](PRD.md). |
| **Arquitectura de Gobernanza** | Activa (7 Pilares) | PRD ➔ ADR ➔ Prompt Maestro ➔ SDD+BDD ➔ TDD ➔ DoD ➔ STATE. |
| **Bases de Datos** | Dev `:5679` / Staging `:5680` | Producción `:5678` aislado y protegido. |
| **Módulos Core** | 6 Módulos Operativos | `/`, `/pilotos`, `/reservas`, `/calendario`, `/analiticas`, `/auditoria`. |
| **Módulos Premium** | Runtime Toggleable | Controlados vía `modules.config.json` y SSE. |

---

## 2. Última Sesión de Trabajo

- **Fecha:** 2026-10-07
- **Objetivo:** Integración del Marco Integral de Gobernanza del Monorepo.
- **Autor / Ejecutor:** Agente Asistente de IA (Antigravity) en coordinación con el Desarrollador.
- **Entregables Realizados:**
  1. [`PRD.md`](PRD.md): Documento de requisitos de producto de la escuela de parapente (visión, personas, RFs, RNFs).
  2. [`PROMPT-MAESTRO.md`](PROMPT-MAESTRO.md): Invocación estandarizada para agentes, niveles de autonomía L1-L4 y guardrails inmutables.
  3. [`specs/`](specs/README.md): Creación del framework de especificaciones con metodología SDD (contratos) + BDD (Gherkin Dado/Cuando/Entonces), [`specs/TEMPLATE.md`](specs/TEMPLATE.md) y [`specs/SPEC-001-RESERVAS-CONCURRENCIA.md`](specs/SPEC-001-RESERVAS-CONCURRENCIA.md).
  4. [`docs/gobernanza.md`](docs/gobernanza.md): Manual operativo de los 7 pilares de gobernanza.
  5. Actualización de [`AGENTS.md`](AGENTS.md) con la matriz de gobernanza y la Definición de Terminado (DoD) formalizada.
  6. [`STATE.md`](STATE.md): Inicialización del sistema de seguimiento y aprendizaje.
- **Evidencia de Calidad:**
  - Estructura de gobernanza alineada con ADRs 001 a 015.
  - Guardrails de base de datos verificados (Dev `:5679`, Staging `:5680`, Prod `:5678`).

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
