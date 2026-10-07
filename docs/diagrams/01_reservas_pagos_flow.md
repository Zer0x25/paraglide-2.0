# Diagrama de Flujo: Módulo de Reservas, Pagos y Ciclo de Vida

Este documento detalla el flujo de ejecución técnica del ciclo de vida de una reserva en **Parapente School**, abarcando la creación con cálculo de tarifas, actualización con control de concurrencia optimista (ADR 004), registro de pagos/abonos, derivación automática de estados y cancelación con devolución.

---

## 1. Diagrama de Flujo Técnico (`flowchart TD`)

```mermaid
flowchart TD
    %% Inicio del proceso
    Start([Cliente HTTP / PWA / MCP envia Request]) --> EntryPoint[ReservasController / ReservasService]

    %% Router / Dispatch de Acción
    EntryPoint --> ActionType{Tipo de Operacion}

    %% RAMA: CREACIÓN
    ActionType -- POST /api/reservas --> ValCreate[Validar payload con CreateReservaPayloadSchema]
    ValCreate --> CheckZodCreate{Payload Zod Valido?}
    CheckZodCreate -- No --> ErrZodCreate([Retornar 400 Bad Request])
    CheckZodCreate -- Si --> CalcPrecios[calcularValor: recalcular tarifas y descuentos vigentes]
    CalcPrecios --> CheckDevolucionInvalida{montoDevuelto > abono?}
    CheckDevolucionInvalida -- Si --> ErrDevolucion([Lanzar Error 400: No se puede devolver mas de lo pagado])
    CheckDevolucionInvalida -- No --> DerivarPagoCreate[derivarEstadoPago: PENDIENTE / ABONADO / PAGADO]
    DerivarPagoCreate --> GenCorrelativo[generarNumeroReserva: AAMMDD-XX con reintentos jitter P2002]
    GenCorrelativo --> DBCreateReserva[(Prisma: tx.reserva.create con pasajeros y tokens publicos)]
    DBCreateReserva --> AuditCreate[logAudit: Registrar auditoria CREAR RESERVA]
    AuditCreate --> OutCreate([Retornar 201 Created con Reserva])

    %% RAMA: EDICIÓN CON CONCURRENCIA OPTIMISTA
    ActionType -- PUT /api/reservas/:id --> ValUpdate[Validar payload con UpdateReservaPayloadSchema]
    ValUpdate --> CheckZodUpdate{Payload Zod Valido?}
    CheckZodUpdate -- No --> ErrZodUpdate([Retornar 400 Bad Request])
    CheckZodUpdate -- Si --> TxUpdate[(Prisma: Iniciar prisma.$transaction)]
    TxUpdate --> FindReservaUpd[(tx.reserva.findUnique por ID)]
    FindReservaUpd --> ExistsUpd{Reserva existe?}
    ExistsUpd -- No --> Err404Upd([Retornar 404 Not Found])
    ExistsUpd -- Si --> CheckCompletedUpd{estado == COMPLETADA?}
    CheckCompletedUpd -- Si --> ErrCompUpd([Lanzar Error 400: No se puede editar completada])
    CheckCompletedUpd -- No --> CheckVerUpd{checkVersion: prev.version == req.version?}
    CheckVerUpd -- No / Stale --> Err409Upd([Lanzar ConflictError: Retornar 409 Conflict])
    CheckVerUpd -- Si --> DerivarPagoUpd[derivarEstadoPago y validar consistencia de pagos]
    DerivarPagoUpd --> DBApplyUpdate[(tx.reserva.updateMany con version incrementada)]
    DBApplyUpdate --> AuditUpdate[logAudit: Registrar auditoria EDITAR RESERVA]
    AuditUpdate --> OutUpdate([Retornar 200 OK con Reserva Actualizada])

    %% RAMA: REGISTRO DE PAGOS / ABONOS
    ActionType -- POST /api/reservas/:id/pagos --> ValPago[Validar CreatePagoPayloadSchema]
    ValPago --> TxPago[(Prisma: Iniciar prisma.$transaction)]
    TxPago --> FindReservaPago[(tx.reserva.findUnique)]
    FindReservaPago --> ExistsPago{Reserva existe?}
    ExistsPago -- No --> Err404Pago([Retornar 404 Not Found])
    ExistsPago -- Si --> CheckVerPago{checkVersion: reserva.version == req.version?}
    CheckVerPago -- No / Stale --> Err409Pago([Retornar 409 Conflict])
    CheckVerPago -- Si --> DBCreatePago[(tx.pago.create)]
    DBCreatePago --> DBAggregatePagos[(tx.pago.aggregate _sum monto)]
    DBAggregatePagos --> RecalcPagoState[derivarEstadoPago: recalcular nuevo estado de pago]
    RecalcPagoState --> CheckAutoCompletar{finalEstadoPago == PAGADO y vuelos completados?}
    CheckAutoCompletar -- Si --> SetCompleted[Marcar estado = COMPLETADA]
    CheckAutoCompletar -- No --> KeepState[Mantener estado actual de reserva]
    SetCompleted --> DBUpdateReservaPago[(tx.reserva.update con nuevo abono y version + 1)]
    KeepState --> DBUpdateReservaPago
    DBUpdateReservaPago --> AuditPago[logAudit: Registrar auditoria REGISTRAR_PAGO]
    AuditPago --> OutPago([Retornar 201 Created con Reserva Actualizada])

    %% RAMA: CANCELACIÓN Y DEVOLUCIÓN
    ActionType -- POST /api/reservas/:id/cancelar --> ValCancel[Validar CancelarReservaPayloadSchema]
    ValCancel --> TxCancel[(Prisma: Iniciar prisma.$transaction)]
    TxCancel --> FindReservaCancel[(tx.reserva.findFirst con deletedAt: null)]
    FindReservaCancel --> ExistsCancel{Reserva existe?}
    ExistsCancel -- No --> Err404Cancel([Retornar 400 / 404 Not Found])
    ExistsCancel -- Si --> CheckFinalizada{estado CANCELADA o COMPLETADA?}
    CheckFinalizada -- Si --> ErrFinalizada([Lanzar Error: Reserva ya finalizada])
    CheckFinalizada -- No --> CheckVerCancel{checkVersion: version == req.version?}
    CheckVerCancel -- No / Stale --> Err409Cancel([Retornar 409 Conflict])
    CheckVerCancel -- Si --> SoftDeleteVuelos[(tx.vuelo.updateMany: estado CANCELADO y deletedAt = now)]
    SoftDeleteVuelos --> CheckDevolucionAtomics{data.devolucion presente y > 0?}
    CheckDevolucionAtomics -- Si --> ValidarMontoDevolver{devueltoPrevio + monto > abono?}
    ValidarMontoDevolver -- Si --> ErrMaxDev([Lanzar Error: No se puede devolver mas de lo pagado])
    ValidarMontoDevolver -- No --> DBCreateDev[(tx.devolucion.create)]
    DBCreateDev --> SetDevuelto[Actualizar montoDevuelto y derivarEstadoPago]
    CheckDevolucionAtomics -- No --> SetCancelState[Marcar estado = CANCELADA, fecha y motivo]
    SetDevuelto --> SetCancelState
    SetCancelState --> DBUpdateCancel[(tx.reserva.update: version + 1)]
    DBUpdateCancel --> CommitCancel[Commit Transaccion]
    CommitCancel --> SSEBroadcast[broadcastDatos: Notificar vuelo actualizar a todos los clientes SSE]
    SSEBroadcast --> AuditCancel[logAudit: Registrar auditoria CANCELAR_RESERVA]
    AuditCancel --> OutCancel([Retornar 200 OK con Reserva Cancelada])
```

---

## 2. Matriz de Referencia Cruzada: [Paso del Diagrama] -> [Código Fuente]

| Paso del Diagrama | Archivo / Ubicación | Función o Componente | Líneas de Código |
| :--- | :--- | :--- | :--- |
| **Punto de Entrada Controller** | `apps/api/src/controllers/reservas.controller.ts` | `ReservasController` | [`L7-L33`](file:///home/zer0x/projects/paraglide/apps/api/src/controllers/reservas.controller.ts#L7-L33) |
| **Validación Zod Create** | `apps/api/src/controllers/reservas.controller.ts` | `create(req, reply)` | [`L22-L23`](file:///home/zer0x/projects/paraglide/apps/api/src/controllers/reservas.controller.ts#L22-L23) |
| **Cálculo de Tarifas & Invariantes** | `apps/api/src/services/reservas/reservas.crud.ts` | `createReserva(data)` | [`L44-L71`](file:///home/zer0x/projects/paraglide/apps/api/src/services/reservas/reservas.crud.ts#L44-L71) |
| **Generación Correlativo AAMMDD-XX** | `apps/api/src/services/reservas/reservas.crud.ts` | `generarNumeroReserva()` | [`L14-L42`](file:///home/zer0x/projects/paraglide/apps/api/src/services/reservas/reservas.crud.ts#L14-L42) |
| **Inserción de Reserva y Pasajeros** | `apps/api/src/services/reservas/reservas.crud.ts` | `prisma.reserva.create` | [`L92-L135`](file:///home/zer0x/projects/paraglide/apps/api/src/services/reservas/reservas.crud.ts#L92-L135) |
| **Guard de Concurrencia Optimista** | `apps/api/src/services/concurrencia.service.ts` | `checkVersion(actual, esperada)` | [`L4-L12`](file:///home/zer0x/projects/paraglide/apps/api/src/services/concurrencia.service.ts#L4-L12) |
| **Edición Atómica con Versionado** | `apps/api/src/services/reservas/reservas.crud.ts` | `updateReserva(id, data)` | [`L139-L200`](file:///home/zer0x/projects/paraglide/apps/api/src/services/reservas/reservas.crud.ts#L139-L200) |
| **Manejo de Errores 409 / 400 / 404** | `apps/api/src/controllers/reservas.controller.ts` | `update(req, reply)` | [`L47-L61`](file:///home/zer0x/projects/paraglide/apps/api/src/controllers/reservas.controller.ts#L47-L61) |
| **Registro de Pagos y Recálculo** | `apps/api/src/services/reservas/reservas.pagos.ts` | `addPagoReserva(reservaId, data)` | [`L11-L74`](file:///home/zer0x/projects/paraglide/apps/api/src/services/reservas/reservas.pagos.ts#L11-L74) |
| **Derivación Automática Estado Pago** | `packages/shared/src/schemas/reservas.ts` | `derivarEstadoPago(total, abono, dev)` | Shared utility |
| **Cancelación y Soft-delete Vuelos** | `apps/api/src/services/reservas/reservas.ciclo-vida.ts` | `cancelarReserva(id, data)` | [`L84-L110`](file:///home/zer0x/projects/paraglide/apps/api/src/services/reservas/reservas.ciclo-vida.ts#L84-L110) |
| **Devolución Atómica Integrada** | `apps/api/src/services/reservas/reservas.ciclo-vida.ts` | `cancelarReserva: data.devolucion` | [`L111-L157`](file:///home/zer0x/projects/paraglide/apps/api/src/services/reservas/reservas.ciclo-vida.ts#L111-L157) |
| **Broadcast SSE Fuera de Transacción** | `apps/api/src/services/reservas/reservas.ciclo-vida.ts` | `broadcastDatos('vuelo', 'actualizar')` | [`L159-L163`](file:///home/zer0x/projects/paraglide/apps/api/src/services/reservas/reservas.ciclo-vida.ts#L159-L163) |
| **Auditoría Transversal Inmutable** | `apps/api/src/services/auditoria.service.ts` | `logAudit(req, params)` | Invocado en cada mutación |
