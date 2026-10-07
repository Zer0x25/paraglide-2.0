# SPEC-001: Gestión Concurrente de Reservas y Sincronización SSE

**Estado:** Implementado / Referencia Viva  
**Autor:** Equipo de Ingeniería Paraglide  
**Fecha:** 2026-10-07  
**Referencia PRD:** [`PRD.md`](../PRD.md) — RF-01, RF-04, RF-05  
**Referencia ADR:** [`docs/adr/004-sincronizacion-multicliente.md`](../docs/adr/004-sincronizacion-multicliente.md), [`docs/adr/007-tiempo-real-sse.md`](../docs/adr/007-tiempo-real-sse.md), [`docs/adr/008-dinero-decimal.md`](../docs/adr/008-dinero-decimal.md)  

---

## 1. Contexto y Objetivos

En el entorno de la escuela de parapente, múltiples terminales (recepción en mostrador, piloto en despegue, tablet de pista) interactúan simultáneamente sobre el listado y detalle de reservas. Sin un control de concurrencia optimista estricto, dos operadores podrían confirmar y modificar una misma reserva a la vez, causando inconsistencias operativas y financieras (doble cobro o sobrescritura ciega de asignación de piloto).

**Objetivo**:
Garantizar que toda mutación sobre una reserva verifique la versión de la entidad (`version Int`). Ante un conflicto de versión concurrente, la API debe rechazar la mutación con `HTTP 409 Conflict`, previniendo pérdida de datos y emitiendo eventos SSE únicamente tras commits de base de datos exitosos.

---

## 2. SDD: Contratos de Datos y API

### 2.1 Esquemas Zod (`packages/shared/src/schemas/reservas.schema.ts`)
```typescript
import { z } from 'zod';

export const ActualizarReservaInputSchema = z.object({
  version: z.number().int().nonnegative({
    message: 'Se requiere el número de versión para control de concurrencia',
  }),
  estado: z.enum(['PENDIENTE', 'CONFIRMADA', 'EN_ESPERA', 'VOLANDO', 'COMPLETADA', 'CANCELADA']).optional(),
  pilotoId: z.string().uuid().nullable().optional(),
  montoCobrado: z.number().nonnegative().optional(),
  observaciones: z.string().max(500).optional(),
});

export type ActualizarReservaInput = z.infer<typeof ActualizarReservaInputSchema>;
```

### 2.2 Endpoints (`apps/api`)
- **Ruta**: `PATCH /api/reservas/:id`
- **Autenticación**: Bearer Token JWT (Roles: `RECEPCION`, `ADMIN`, `PILOTO`)
- **Headers**: `Content-Type: application/json`
- **Payload**:
  ```json
  {
    "version": 3,
    "estado": "CONFIRMADA",
    "montoCobrado": 150.00
  }
  ```
- **Respuestas**:
  - `200 OK`:
    ```json
    {
      "data": {
        "id": "res_abc123",
        "shortId": "R-1042",
        "version": 4,
        "estado": "CONFIRMADA",
        "montoCobrado": 150.00,
        "updatedAt": "2026-10-07T12:00:00Z"
      }
    }
    ```
  - `409 Conflict`:
    ```json
    {
      "error": "CONFLICT",
      "message": "La reserva ha sido modificada por otro usuario. Por favor recarga los datos.",
      "currentVersion": 4
    }
    ```

---

## 3. SDD: Límites de Dominio y Restricciones

1. **Dinero**: `montoCobrado` se almacena como `Decimal(12,2)` en Postgres y se expone normalizado con `toNum()` de `money.util.ts`.
2. **Concurrencia**:
   ```typescript
   // En apps/api/src/services/reservas.service.ts
   const updated = await prisma.reserva.updateMany({
     where: { id, version: input.version, deletedAt: null },
     data: { ...updateData, version: { increment: 1 } },
   });
   if (updated.count === 0) {
     throw new ConflictError('Conflicto de concurrencia: la reserva fue modificada.');
   }
   ```
3. **Side Effects**: La emisión de `broadcastDatos('reservas-cambios', data)` se ejecuta **estrictamente fuera** del bloque de `$transaction`, tras el commit exitoso.

---

## 4. BDD: Escenarios de Comportamiento (Dado / Cuando / Entonces)

### Escenario 1: Actualización exitosa con incremento de versión
- **Dado** una reserva existente con ID `res-1` y versión `1`
- **Cuando** el usuario envía `PATCH /api/reservas/res-1` con `{ "version": 1, "estado": "CONFIRMADA" }`
- **Entonces** el endpoint retorna HTTP `200 OK`
- **Y** el registro en base de datos tiene ahora `version = 2` y `estado = "CONFIRMADA"`
- **Y** se dispara un evento SSE `reservas-cambios` con los datos actualizados.

### Escenario 2: Choque concurrente entre dos clientes
- **Dado** una reserva en estado inicial con versión `1`
- **Cuando** el Cliente A actualiza exitosamente la reserva con `version: 1` incrementándola a `2`
- **Y** el Cliente B intenta actualizar la misma reserva enviando la versión obsoleta `version: 1`
- **Entonces** la API responde al Cliente B con HTTP `409 Conflict`
- **Y** los datos modificados por el Cliente A se preservan íntegros
- **Y** no se emite ningún evento SSE erróneo.

### Escenario 3: Rechazo ante versión ausente o negativa
- **Dado** un cliente que envía `PATCH /api/reservas/res-1` omitiendo el campo `version`
- **Cuando** el middleware de validación procesa la petición
- **Entonces** la API responde con HTTP `400 Bad Request` indicando que `version` es obligatorio.

---

## 5. Estrategia TDD

- **Unitarios API**: `apps/api/src/modules/reservas/__tests__/reservas.service.test.ts`
  - Valida el lanzamiento de `ConflictError` ante `updated.count === 0`.
- **Integración API**: `apps/api/test/integration/reservas-concurrencia.test.ts`
  - Simula dos promesas concurrentes `Promise.allSettled` contra la base de datos de Dev en puerto `:5679`. Uno resuelve con 200 y el otro con 409.
- **Frontend Hook**: `apps/web/src/hooks/useReservasMutations.ts`
  - Manejo optimista y captura de error 409 con notificación toast para recargar la vista.

---

## 6. Checklist de Cierre (DoD)

- [x] Contratos Zod exportados y sincronizados.
- [x] Suites de pruebas unitarias y de integración pasando.
- [x] Gate `npm run check:quick` con código 0.
- [x] Formato incremental Prettier aplicado.
- [x] `STATE.md` actualizado con el registro del avance.
