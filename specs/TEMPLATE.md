# SPEC-[ID]: [Título de la Especificación]

**Estado:** [Borrador | En Revisión | Aprobado | Implementado]  
**Autor:** [Nombre / Agente]  
**Fecha:** [YYYY-MM-DD]  
**Referencia PRD:** [`PRD.md`](../PRD.md) — [Sección o Requisito RF-XX]  
**Referencia ADR:** [`docs/adr/`](../docs/adr/README.md) — [ADR XXX]  

---

## 1. Contexto y Objetivos

- **Problema / Oportunidad**: [Descripción breve de la necesidad operativa]
- **Objetivo**: [Qué se va a resolver con esta implementación]
- **No-Objetivos (Out of Scope)**: [Qué queda deliberadamente fuera de esta entrega]

---

## 2. SDD: Contratos de Datos y API

### 2.1 Esquemas Zod (`packages/shared/src`)
```typescript
import { z } from 'zod';

export const [Nombre]InputSchema = z.object({
  // Campos, tipos y validaciones
});

export type [Nombre]Input = z.infer<typeof [Nombre]InputSchema>;
```

### 2.2 Endpoints y Rutas (`apps/api`)
- **Método y Ruta**: `POST /api/...` o `PUT /api/.../:id`
- **Autenticación**: [Pública | Requiere Bearer Token / Role]
- **Headers Requeridos**: `Content-Type: application/json`, `If-Match` (si aplica)
- **Request Body**:
  ```json
  {
    "ejemplo": "valor"
  }
  ```
- **Respuestas Esperadas**:
  - `200 OK` / `201 Created`: `{ "data": { ... } }`
  - `400 Bad Request`: `{ "error": "VALIDATION_ERROR", "details": [...] }`
  - `409 Conflict`: `{ "error": "CONFLICT", "message": "Versión obsoleta" }`

---

## 3. SDD: Límites de Dominio y Restricciones

1. **Dinero y Precisión**: Todo cálculo monetario debe convertirse vía `toNum()` de `money.util.ts`.
2. **Concurrencia Optimista**: Las modificaciones incrementan `version Int`. Fallos de versión deben abortar la transacción.
3. **Persistencia y Soft-Delete**: Filtro mandatorio `deletedAt: null`.
4. **Efectos Secundarios (Side Effects)**: SSE (`broadcastDatos`) o notificaciones solo después del commit de `$transaction`.

---

## 4. BDD: Escenarios de Comportamiento (Dado / Cuando / Entonces)

### Escenario 1: Camino Feliz (Happy Path)
- **Dado** que un operador con rol recepción está autenticado
- **Y** existe una reserva con estado `PENDIENTE` y `version = 1`
- **Cuando** envía una solicitud para confirmar la reserva con `version = 1`
- **Entonces** la API responde con HTTP `200 OK`
- **Y** el estado de la reserva cambia a `CONFIRMADA`
- **Y** la versión de la entidad se incrementa a `2`
- **Y** se emite un evento SSE `reservas-cambios` con los datos actualizados.

### Escenario 2: Conflicto de Concurrencia Optimista
- **Dado** que dos operadores (A y B) tienen abierta la misma reserva en `version = 1`
- **Cuando** el operador A confirma la reserva e incrementa la versión a `2`
- **Y** el operador B intenta cambiar el piloto asignado enviando `version = 1`
- **Entonces** la API responde con HTTP `409 Conflict`
- **Y** no se altera ningún dato en la base de datos
- **Y** el frontend del operador B muestra una notificación de recarga requerida.

### Escenario 3: Validación de Entradas Inválidas
- **Dado** una solicitud con formato de fecha inválido o monto negativo
- **Cuando** el endpoint procesa la carga útil
- **Entonces** la API responde con HTTP `400 Bad Request` indicando el detalle del error sin ejecutar mutaciones.

---

## 5. Estrategia TDD

- [ ] **Test Unitario Backend**: `apps/api/src/.../__tests__/[nombre].test.ts`
  - Mock de Prisma validando el manejo de `version` y respuestas 200/409.
- [ ] **Test de Integración Backend**: `apps/api/test/integration/...`
  - Ejecución contra Postgres Dev (`:5679`) con transacciones reales y soft-delete.
- [ ] **Test Frontend**: `apps/web/src/.../__tests__/[nombre].test.tsx`
  - Verificación del Headless Hook (<300 líneas) ante respuesta 200 y manejo de error 409.

---

## 6. Checklist de Cierre (DoD)

- [ ] `@parapente/shared` compila con `npm run build:shared`.
- [ ] `npx tsc --noEmit` pasa limpio en todos los workspaces.
- [ ] Suites de pruebas pasando limpias sin warnings ni unhandled rejections.
- [ ] `npm run check:quick` con código de salida 0.
- [ ] `npm run format` ejecutado incrementalmente.
- [ ] `STATE.md` actualizado con evidencia.
