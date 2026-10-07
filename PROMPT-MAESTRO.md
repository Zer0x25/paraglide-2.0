# PROMPT MAESTRO — Invocación de Agentes y Asistentes

Este documento es la guía de invocación para agentes de IA y asistentes de desarrollo en **Paraglide**. Establece cómo invocar al agente según el **Tier** de la tarea y el **Nivel de Autonomía** autorizado.

---

## 1. Invocación Ágil (Recomendada para el 90% de tareas)

> ⚡ *Principio Lean:* Los guardrails inmutables (puertos, dinero, concurrencia, soft delete) ya residen en [`AGENTS.md`](AGENTS.md) y son inyectados automáticamente al agente. No necesitas duplicarlos en cada prompt.

Para iniciar una tarea cotidiana, solo especifica estas 3 líneas:

```markdown
Objetivo: [Describir qué implementar, corregir o refactorizar]
Tier: [Tier 1: Architectural | Tier 2: Standard | Tier 3: Fast-Track]
Autonomía: [L2: Guiado | L3: Autónomo Estándar | L4: Full Autonomous]
Referencia: [specs/SPEC-XXX.md o PRD.md si aplica, o "N/A"]
```

---

## 2. Invocación Formal (Para Tareas Críticas / Tier 1)

Usa esta plantilla completa para cambios estructurales de base de datos o migraciones de arquitectura:

```markdown
Hola Agente. Vas a trabajar en el monorepo de **Paraglide** (Escuela de Parapente).

### Contexto y Clasificación
- **Tier**: Tier 1 (Architectural)
- **PRD de Referencia**: `PRD.md` (Sección: [Indicar sección])
- **Spec Asociada**: `specs/[ID-NOMBRE-SPEC].md`
- **Decisiones Arquitectónicas**: `docs/adr/` (revisar ADRs pertinentes)
- **Nivel de Autonomía**: [L2 | L3 | L4]

### Objetivo de la Sesión
[Describir claramente el objetivo estructural]

### Guardrails Mandatorios (Canónicos en AGENTS.md)
1. 🚨 **PROHIBIDO tocar el puerto 5678** (Producción). Usa Dev en `:5679` o Staging en `:5680`.
2. Manejo de dinero estrictamente con `toNum()` de `money.util.ts` (`Decimal(12,2)`).
3. Concurrencia obligatoria con `version Int` (retornar HTTP 409 Conflict ante choque).
4. Respetar soft delete con `deletedAt: null`.
5. Ejecutar `npm run format` de forma incremental antes de reportar.
```

---

## 3. Niveles de Autonomía Autorizada

| Nivel | Nombre | Alcance Permitido para el Agente | Gate de Transición |
|---|---|---|---|
| **L1** | **Supervisado** | Solo lectura, diagnóstico, análisis de diffs y generación de planes técnicos. No escribe código ni ejecuta comandos destructivos. | Aprobación humana explícita del plan. |
| **L2** | **Guiado** | Escribe pruebas y código en pequeños incrementos. Se detiene ante cambios en `schema.prisma`, DTOs de `packages/shared` o migraciones. | Confirmación humana en puntos de control. |
| **L3** | **Autónomo Estándar** | Implementa de principio a fin respetando TDD y SDD. Ejecuta `npm run format` y el gate `npm run check:quick`. Si falla, auto-corrige hasta 3 veces. | Éxito en `npm run check:quick` (código 0). |
| **L4** | **Full Autonomous** | Implementación completa, auto-reparación, actualización de `STATE.md` (o memoria) y preparación del commit convencional para `release-please`. | Checklist completa del DoD en `AGENTS.md`. |

---

## 4. Flujo de Ejecución por Tier

- **Tier 3 (Fast-Track)**:
  `[Diagnóstico debug-flujo] ➔ [Test de regresión + Fix] ➔ [check:quick] ➔ [Commit]`
- **Tier 2 (Standard)**:
  `[DTOs shared] ➔ [BDD en tests] ➔ [Implementación] ➔ [check:quick] ➔ [Format]`
- **Tier 1 (Architectural)**:
  `[PRD / Spec living] ➔ [TDD completo] ➔ [Implementación] ➔ [check:quick] ➔ [STATE.md]`
