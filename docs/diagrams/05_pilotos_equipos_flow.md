# Diagrama de Flujo: Módulo de Pilotos, Equipos y Mantenimiento

Este documento modela el flujo de ejecución técnica para la administración del personal de vuelo (pilotos, licencias y turnos de disponibilidad), asignación inteligente de cargas operativas, y el ciclo de vida y mantenimiento preventivo de equipos de parapente (velas, arneses y paracaídas) en **Parapente School**.

---

## 1. Diagrama de Flujo Técnico (`flowchart TD`)

```mermaid
flowchart TD
    %% Inicio del módulo de activos y personal
    Start([Peticion HTTP a Pilotos / Equipos]) --> AssetDispatcher{Sub-modulo}

    %% SUB-MÓDULO: GESTIÓN DE PILOTOS Y DISPONIBILIDAD
    AssetDispatcher -- /api/pilotos --> PilotoAction{Operacion Piloto}

    %% Sugerencia de Piloto para Vuelo
    PilotoAction -- POST /api/pilotos/sugerir --> ValSugerir[Validar fechaHora, pesoPasajero, pasajeroId]
    ValSugerir --> QueryPilotosActivos[(prisma.piloto.findMany: activo = true, deletedAt = null)]
    QueryPilotosActivos --> LoopPilotos[Evaluar candidatos en memoria]
    LoopPilotos --> CheckLicencia{licenciaVigente: tieneLicencia y fecha no expirada?}
    CheckLicencia -- No --> DiscardPiloto[Descartar piloto: Licencia vencida]
    CheckLicencia -- Si --> CheckRangoPeso{pesoPasajero entre pesoMinimo y pesoMaximo?}
    CheckRangoPeso -- No --> DiscardPiloto
    CheckRangoPeso -- Si --> CheckConflictoHorario[(tx / prisma.vuelo.findFirst a la misma hora)]
    CheckConflictoHorario --> HasConflicto{Piloto ya tiene vuelo en franja?}
    HasConflicto -- Si --> DiscardPiloto
    HasConflicto -- No --> CheckTurnoDia{disponibilidadTotal o turno activo en fecha?}
    CheckTurnoDia -- No --> DiscardPiloto
    CheckTurnoDia -- Si --> RankPiloto[Ordenar por prioridad asc, vuelos completados hoy y categoria]
    RankPiloto --> ReturnBestPiloto([Retornar 200 OK con Piloto Sugerido])

    %% CRUD y Disponibilidad de Pilotos
    PilotoAction -- PUT /api/pilotos/:id --> ValPilotoSchema[Validar PilotoSchema Zod y version]
    ValPilotoSchema --> CheckVerPiloto{checkVersion: version coincide?}
    CheckVerPiloto -- No / Stale --> Err409Piloto([Retornar 409 Conflict])
    CheckVerPiloto -- Si --> DBPilotoUpd[(prisma.piloto.update: datos, version + 1)]
    DBPilotoUpd --> AuditPiloto[logAudit: EDITAR PILOTO]
    AuditPiloto --> OutPilotoUpd([Retornar 200 OK])

    %% SUB-MÓDULO: EQUIPOS Y MANTENIMIENTO
    AssetDispatcher -- /api/equipos --> EquipoAction{Operacion Equipo}

    %% Crear / Registrar Equipo
    EquipoAction -- POST /api/equipos --> ValEquipoCreate[Validar CreateEquipoPayloadSchema]
    ValEquipoCreate --> DBEquipoCreate[(prisma.equipo.create: codigo, tipo, limiteHoras)]
    DBEquipoCreate --> CheckDupCode{Codigo unico P2002?}
    CheckDupCode -- Colision --> ErrDupCode([Retornar 400: Codigo duplicado])
    CheckDupCode -- Exito --> AuditEquipo[logAudit: CREAR EQUIPO]
    AuditEquipo --> OutEquipoCreate([Retornar 201 Created])

    %% Agregar Mantenimiento
    EquipoAction -- POST /api/equipos/:id/mantenimiento --> ValMantenimiento[Validar CreateMantenimientoPayloadSchema]
    ValMantenimiento --> TxMante[(Iniciar prisma.$transaction)]
    TxMante --> FindEquipoMante[(tx.equipo.findUnique por ID)]
    FindEquipoMante --> ExistsEquipoMante{Equipo existe?}
    ExistsEquipoMante -- No --> Err404Equipo([Retornar 404 Not Found])
    ExistsEquipoMante -- Si --> DBCreateMante[(tx.mantenimiento.create: tipo, fecha, costo, notas)]
    DBCreateMante --> EvalEstadoEquipo{tipoMantenimiento y estado actual}
    EvalEstadoEquipo -- En Reparacion --> SetMantenimientoState[estado = EN_MANTENIMIENTO]
    EvalEstadoEquipo -- Revision Concluida OK --> SetOperativoState[estado = OPERATIVO, fechaUltimaRevision = now]
    SetMantenimientoState --> UpdateEquipoStatus[(tx.equipo.update: estado, version + 1)]
    SetOperativoState --> UpdateEquipoStatus
    UpdateEquipoStatus --> CommitMante[Commit Transaccion]
    CommitMante --> AuditMante[logAudit: MANTENIMIENTO EQUIPO]
    AuditMante --> OutManteSuccess([Retornar 201 Created con Registro de Mantenimiento])

    %% Cómputo de Horas de Vuelo (Trigger / Scheduler)
    VueloCompletadoEvent([Evento Vuelo Completado]) --> QueryEquipoVuelo[(Obtener vela y arnes asignados)]
    QueryEquipoVuelo --> IncHoras[(tx.equipo.update: horasVueloEstimadas + 0.33, vuelosRealizados + 1)]
    IncHoras --> CheckLimiteInspeccion{horasVuelo >= limiteHorasInspeccion?}
    CheckLimiteInspeccion -- Si --> TriggerAlert[Marcar estado = REVISION_PENDIENTE y generar Alerta]
    CheckLimiteInspeccion -- No --> KeepOperativo[Mantener estado OPERATIVO]
    TriggerAlert --> OutEventDone([Fin de actualizacion de equipo])
    KeepOperativo --> OutEventDone
```

---

## 2. Matriz de Referencia Cruzada: [Paso del Diagrama] -> [Código Fuente]

| Paso del Diagrama | Archivo / Ubicación | Función o Componente | Líneas de Código |
| :--- | :--- | :--- | :--- |
| **Punto de Entrada Pilotos** | `apps/api/src/controllers/pilotos.controller.ts` | `PilotosController` | [`L6-L45`](file:///home/zer0x/projects/paraglide/apps/api/src/controllers/pilotos.controller.ts#L6-L45) |
| **Sugerencia Inteligente de Piloto** | `apps/api/src/services/pilotos.service.ts` | `sugerirPiloto(payload)` | [`L93-L160`](file:///home/zer0x/projects/paraglide/apps/api/src/services/pilotos.service.ts#L93-L160) |
| **Validación de Licencia Vigente** | `apps/api/src/services/pilotos.service.ts` | `licenciaVigente(piloto)` | [`L8-L15`](file:///home/zer0x/projects/paraglide/apps/api/src/services/pilotos.service.ts#L8-L15) |
| **Control de Versión de Piloto** | `apps/api/src/services/pilotos.service.ts` | `update: checkVersion(actual.version)` | [`L80-L91`](file:///home/zer0x/projects/paraglide/apps/api/src/services/pilotos.service.ts#L80-L91) |
| **Punto de Entrada Equipos** | `apps/api/src/controllers/equipos.controller.ts` | `EquiposController` | [`L6-L70`](file:///home/zer0x/projects/paraglide/apps/api/src/controllers/equipos.controller.ts#L6-L70) |
| **Registro de Nuevo Equipo** | `apps/api/src/services/equipos.service.ts` | `create(data)` | [`L58-L82`](file:///home/zer0x/projects/paraglide/apps/api/src/services/equipos.service.ts#L58-L82) |
| **Detección Código Duplicado** | `apps/api/src/controllers/equipos.controller.ts` | `catch: error.code === 'P2002'` | [`L32-L37`](file:///home/zer0x/projects/paraglide/apps/api/src/controllers/equipos.controller.ts#L32-L37) |
| **Registro de Mantenimiento** | `apps/api/src/controllers/equipos.controller.ts` | `addMantenimiento(req, reply)` | [`L72-L84`](file:///home/zer0x/projects/paraglide/apps/api/src/controllers/equipos.controller.ts#L72-L84) |
| **Persistencia de Mantenimiento** | `apps/api/src/services/equipos.service.ts` | `addMantenimiento(id, data)` | [`L130-L155`](file:///home/zer0x/projects/paraglide/apps/api/src/services/equipos.service.ts#L130-L155) |
| **Paginación ADR 005 en Equipos** | `apps/api/src/services/equipos.service.ts` | `getAll: listar(opts, ...)` | [`L7-L40`](file:///home/zer0x/projects/paraglide/apps/api/src/services/equipos.service.ts#L7-L40) |
