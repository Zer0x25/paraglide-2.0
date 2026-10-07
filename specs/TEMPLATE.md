# SPEC-[ID]: [Título de la Especificación]

**Estado:** [Borrador | En Revisión | Aprobado | Implementado]  
**Autor:** [Nombre / Agente]  
**Fecha:** [YYYY-MM-DD]  
**Tier:** [Tier 1: Architectural | Tier 2: Standard]  
**Referencia PRD:** [`PRD.md`](../PRD.md) — [RF-XX / Sección]  
**Referencia ADR:** [`docs/adr/`](../docs/adr/README.md) — [ADR-XXX]  

---

## 1. Contexto y Objetivos

- **Problema / Oportunidad**: [Breve descripción de la necesidad operativa de la escuela]
- **Objetivo**: [Qué resuelve esta especificación]
- **No-Objetivos (Out of Scope)**: [Qué queda deliberadamente excluido]

---

## 2. Contratos y Límites (SDD)

> 💡 *Living Contract:* Define la fuente de verdad en `@parapente/shared`. No copies código TypeScript masivo aquí; referencia los esquemas y contratos canónicos.

- **Esquema Zod Canónico**: `packages/shared/src/schemas/[nombre].schema.ts` (`[Nombre]InputSchema`)
- **Endpoint**: `[METODO] /api/[ruta]` (Auth: `[Pública | Bearer Rol]`)
- **Campos Críticos y Restricciones**:
  - `version Int`: Control optimista obligatorio (retornar `HTTP 409 Conflict` ante choque).
  - Dinero: Precisión decimal con `toNum()` de `money.util.ts` (`Decimal(12,2)`).
  - Persistencia: Soft-delete con `deletedAt: null`.

---

## 3. Escenarios de Negocio (BDD)

```gherkin
Escenario 1: [Nombre del caso de éxito principal]
  Dado [estado inicial del sistema]
  Cuando [acción que ejecuta el usuario o cliente]
  Entonces [resultado observable y código HTTP]
  Y [efecto secundario esperado (ej. evento SSE tras commit)]

Escenario 2: [Conflicto de concurrencia o límite de negocio]
  Dado [estado previo con versión X]
  Cuando [intento de mutación con versión obsoleta]
  Entonces [la API rechaza con HTTP 409 Conflict]
  Y [no se altera ningún dato en la base de datos]
```

---

## 4. Estrategia de Pruebas (TDD)

- [ ] **Unitario Backend** (`apps/api/src/.../__tests__`): Mock de Prisma validando lógica y errores 400/409.
- [ ] **Integración Backend** (`npm run test:api:integration` en `:5679`): Persistencia real y transacciones.
- [ ] **Frontend** (`apps/web/src/.../__tests__`): Consumo con `unwrapList`/TanStack Query y manejo de errores.

---

## 5. Cierre
Cumplir la Definition of Done (DoD) unificada en [`AGENTS.md`](../AGENTS.md) y ejecutar `npm run check:quick`.
