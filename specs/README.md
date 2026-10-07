# Directorio de Especificaciones — SDD + BDD

Este directorio alberga las especificaciones formales de diseño y comportamiento del sistema **Paraglide**.

---

## 1. Filosofía: SDD + BDD

Cada iniciativa, funcionalidad o endpoint crítico se especifica antes de codificarse mediante dos dimensiones complementarias:

### SDD (Spec-Driven Development — Especificación de Contratos)
Define la estructura técnica, interfaces y contratos de datos:
- **Esquemas Zod & DTOs**: Declarados en `packages/shared/src`.
- **Rutas y Métodos HTTP**: Fastify 5 en `apps/api`.
- **Sobre de Respuesta (ADR 005)**: Paginación y envelope estándar `{ data: T[], pagination }`.
- **Límites de Dominio y Validaciones**: Restricciones de rangos, estados permitidos, tipos monetarios (`Decimal(12,2)`).
- **Códigos de Estado HTTP**: 200/201 (Éxito), 400 (Validación), 404 (No Encontrado), 409 (Conflicto de Concurrencia).

### BDD (Behavior-Driven Development — Escenarios de Comportamiento)
Define el comportamiento esperado desde el punto de vista del usuario o consumidor de la API, expresado en lenguaje estructurado Gherkin:
- **Dado (Given)**: Estado inicial o precondición del sistema.
- **Cuando (When)**: Acción, evento o mutación disparada.
- **Entonces (Then)**: Resultado observable esperado, efectos secundarios y códigos de retorno.

---

## 2. Estructura de una Spec

Utiliza siempre la plantilla oficial [`specs/TEMPLATE.md`](./TEMPLATE.md). Las secciones estándar son:

1. **Metadatos**: ID, Nombre, Versión, PRD de referencia, ADRs relacionados.
2. **Contexto & Objetivo**: Valor de negocio del cambio.
3. **SDD — Contratos de Datos & API**: Definición exacta de interfaces y payloads.
4. **SDD — Restricciones y Reglas de Negocio**: Invariables del dominio.
5. **BDD — Escenarios de Comportamiento**: Casos Dado / Cuando / Entonces.
6. **Estrategia TDD**: Mapeo de escenarios a suites de pruebas (unitarias, integración, E2E).
7. **Checklist de Calidad (DoD)**: Verificación contra los criterios de cierre del proyecto.

---

## 3. Índice de Especificaciones

| ID | Nombre | Estado | Referencia PRD / ADR |
|---|---|---|---|
| [`SPEC-001`](./SPEC-001-RESERVAS-CONCURRENCIA.md) | Gestión Concurrente de Reservas y Sincronización SSE | Aprobado / Implementado | PRD RF-01, RF-04, RF-05 / ADR 004, ADR 007 |
