# PROMPT MAESTRO — Invocación de Agentes y Asistentes

Este documento es la plantilla estándar de invocación para agentes de IA y asistentes de desarrollo en **Paraglide**. Establece el contexto del sistema, las referencias normativas, las restricciones inmutables y el nivel de autonomía concedido.

---

## 1. Plantilla de Invocación Rápida (Copiar y Pegar)

```markdown
Hola Agente. Vas a trabajar en el monorepo de **Paraglide** (Escuela de Parapente).

### Contexto y Referencias
- **PRD de Referencia**: `PRD.md` (Sección: [Indicar sección o Requisito])
- **Spec Asociada**: `specs/[ID-NOMBRE-SPEC].md`
- **Decisiones Arquitectónicas**: `docs/adr/` (revisar ADRs pertinentes)
- **Reglas Inmutables & DoD**: `AGENTS.md`
- **Estado Actual del Proyecto**: `STATE.md`

### Objetivo de la Sesión
[Describir claramente el objetivo o feature a implementar/corregir]

### Nivel de Autonomía Autorizada: [Elegir: L1 | L2 | L3 | L4]
- **L1 (Supervisado / Solo Plan)**: Diagnóstico y plan detallado en artifact. Esperar aprobación antes de escribir código.
- **L2 (Guiado con Checkpoints)**: Implementación por fases con validación humana en cambios de schema o contratos.
- **L3 (Autónomo Estándar)**: Ciclo completo: Diagnóstico ➔ TDD ➔ Implementación ➔ Formato incremental ➔ `npm run check:quick` ➔ Reporte.
- **L4 (Full Autonomous / Auto-reparación)**: L3 + resolución autónoma de errores hasta 3 iteraciones + actualización de `STATE.md`.

### Guardrails Mandatorios
1. 🚨 **PROHIBIDO tocar el puerto 5678** (Producción). Usa Dev en `:5679` o Staging en `:5680`.
2. Manejo de dinero estrictamente con `toNum()` de `money.util.ts` (`Decimal(12,2)`).
3. Concurrencia obligatoria con `version Int` (retornar HTTP 409 Conflict ante choque).
4. Respetar soft delete con `deletedAt: null`.
5. Ejecutar `npm run format` de forma incremental antes de reportar.
```

---

## 2. Niveles de Autonomía Autorizada

| Nivel | Nombre | Alcance Permitido para el Agente | Gate de Transición |
|---|---|---|---|
| **L1** | **Supervisado** | Solo lectura, diagnóstico, análisis de diffs y generación de planes técnicos. No escribe código ni ejecuta comandos destructivos. | Aprobación humana explícita del plan. |
| **L2** | **Guiado** | Escribe pruebas y código en pequeños incrementos. Se detiene ante cambios en `schema.prisma`, DTOs de `packages/shared` o migraciones. | Confirmación humana en puntos de control. |
| **L3** | **Autónomo Estándar** | Implementa de principio a fin respetando TDD y SDD. Ejecuta `npm run format` y el gate `npm run check:quick`. Si falla, reporta el error sin hacer modificaciones especulativas. | Éxito en `npm run check:quick` (exit code 0). |
| **L4** | **Full Autonomous** | Implementación de extremo a extremo, auto-corrección de fallos en bucle de hasta 3 iteraciones ante errores de TypeScript/Vitest, actualización de `STATE.md` y preparación del commit semántico. | Checklist completa del DoD en `AGENTS.md`. |

---

## 3. Protocolo de Ejecución del Agente

Cuando se inicia una sesión con este prompt, el agente debe seguir obligatoriamente este orden:

```
[1. Leer PRD & Spec] ➔ [2. TDD: Escribir Tests] ➔ [3. Implementar Código] ➔ [4. Single-Shot Gate] ➔ [5. Formateo] ➔ [6. Actualizar STATE.md]
```

1. **Lectura de Requisitos**:
   - Consultar la sección correspondiente en [`PRD.md`](PRD.md) y la especificación en [`specs/`](specs/README.md).
   - Verificar si existen decisiones arquitectónicas previas en [`docs/adr/`](docs/adr/README.md).
2. **Desarrollo Guiado por Pruebas (TDD)**:
   - Crear o modificar primero los tests (`*.test.ts`) codificando los escenarios BDD (Dado / Cuando / Entonces).
3. **Implementación Limpia**:
   - Modificar el código productivo necesario para satisfacer las pruebas.
   - Si se modificó `packages/shared`, compilar con `npm run build:shared`.
   - Si se modificó `schema.prisma`, regenerar cliente con `npx prisma generate`.
4. **Validación del Gate**:
   - Ejecutar el gate atómico: `npm run check:quick`.
   - Corregir de forma autónoma cualquier error de compilación o test roto.
5. **Formateo Incremental**:
   - Ejecutar `npm run format` (no formatea `.md`, solo archivos modificados reconocidos por Git).
6. **Cierre y Actualización de Estado**:
   - Cumplir el DoD en [`AGENTS.md`](AGENTS.md).
   - Actualizar [`STATE.md`](STATE.md) registrando el resumen del trabajo, la evidencia de tests y el siguiente paso.
