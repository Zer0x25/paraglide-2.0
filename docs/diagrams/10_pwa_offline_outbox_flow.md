# Diagrama de Flujo: Módulo Frontend PWA Offline-First y Cola Outbox

Este documento modela el subsistema de resiliencia y funcionamiento sin conexión (**Offline-First - ADR 009**) en **Parapente School**, detallando la detección de red (`useSyncExternalStore`), la intercepción de mutaciones fallidas, el almacenamiento local en IndexedDB (`idb`), la cola FIFO con cabeceras de idempotencia (`X-Client-Id`), el remapeo dinámico de IDs temporales a reales, y la resolución de conflictos concurrentes (`409 Conflict`).

---

## 1. Diagrama de Flujo Técnico (`flowchart TD`)

```mermaid
flowchart TD
    %% Inicio de mutación desde un componente de UI
    UIAction([Usuario ejecuta accion en Web: Crear/Editar Reserva]) --> MutateCall[TanStack Query mutate / typedApi]

    %% EVALUACIÓN DE CONECTIVIDAD
    MutateCall --> CheckConn{useOnlineStatus: isOnlineState == true?}
    CheckConn -- Offline Detectado --> QueueDirect[enqueue: Encolar mutacion directamente en IndexedDB]
    CheckConn -- Online Asumido --> SendHttpReq[Enviar peticion HTTP via Axios / fetch]

    %% RESPUESTA DEL PRIMER INTENTO
    SendHttpReq --> CheckReqResult{Resultado del intento HTTP}
    CheckReqResult -- HTTP 200 / 201 OK --> ReqSuccess([Exito: Actualizar cache React Query y UI])
    CheckReqResult -- Fallo de Red / ERR_NETWORK --> HandleNetworkErr[reportNetworkError: Marcar offline y reportar a useOnlineStatus]
    HandleNetworkErr --> QueueFallback[enqueue en STORE_OUTBOX con X-Client-Id generado]
    CheckReqResult -- Error HTTP 409 Conflict --> ShowConflictToast([toast.error: Conflicto 409 inmediato en linea])

    %% ENCOLAMIENTO EN INDEXEDDB
    QueueDirect --> PutIndexedDB[(IndexedDB: db.put en STORE_OUTBOX FIFO)]
    QueueFallback --> PutIndexedDB
    PutIndexedDB --> NotifyCount[notificar: Actualizar badge UI de mutaciones pendientes]
    NotifyCount --> OptimisticUI([toast.info: Guardado offline pendiente de sincronizacion])

    %% RECONEXIÓN Y CICLO DE REPLAY
    BrowserOnlineEvent([Evento del Navegador: window 'online' o Ping exitoso]) --> TriggerReplay[setOnlineStatus true -> replayOutbox]
    TriggerReplay --> ReadOutbox[(IndexedDB: listOutbox ordenado por createdAt FIFO)]
    ReadOutbox --> HasEntries{Hay mutaciones pendientes?}
    HasEntries -- No --> ReplayFinished([Cola limpia y sincronizada])
    HasEntries -- Si --> LoopEntries[Tomar siguiente OutboxEntry]

    %% REMAPEO DE IDS TEMPORALES (ID MAPPING)
    LoopEntries --> CheckTempIds{URL o payload contienen tempId previo?}
    CheckTempIds -- Si --> ApplyRemap[deepReplaceId: Sustituir tempId por el ID real generado en DB]
    CheckTempIds -- No --> KeepPayload[Mantener URL y payload intactos]
    ApplyRemap --> ExecReplayRequest[api.request con X-Client-Id del registro original]
    KeepPayload --> ExecReplayRequest

    %% RESULTADO DEL REPLAY
    ExecReplayRequest --> EvalReplayStatus{Respuesta del Servidor}
    EvalReplayStatus -- 200 / 201 OK --> ExtractRealId[Capturar createdId real generado en DB]
    ExtractRealId --> UpdateIdMapping[idMapping.set tempId -> realId para siguientes llamadas]
    UpdateIdMapping --> RemoveFromOutbox[(IndexedDB: db.delete de STORE_OUTBOX)]
    RemoveFromOutbox --> LoopEntries

    EvalReplayStatus -- Error de Red / Conexión inestable --> PauseReplay[Pausar replay sin quemar intentos hasta nueva conexion estable]
    PauseReplay --> ReplaySuspended([Sincronizacion suspendida])

    EvalReplayStatus -- 409 Conflict o 400 Estructural --> SendToConflictos[markConflict: Mover de outbox a STORE_CONFLICTOS]
    SendToConflictos --> NotifyConflictUser[Mostrar banner de conflicto al usuario para resolucion manual]
    NotifyConflictUser --> LoopEntries

    EvalReplayStatus -- Error 500 / Reintentable --> CheckMaxRetries{intentos >= MAX_INTENTOS 5?}
    CheckMaxRetries -- Si --> SendToConflictos
    CheckMaxRetries -- No --> IncAttempts[(IndexedDB: entry.intentos + 1 en STORE_OUTBOX)]
    IncAttempts --> LoopEntries
```

---

## 2. Matriz de Referencia Cruzada: [Paso del Diagrama] -> [Código Fuente]

| Paso del Diagrama | Archivo / Ubicación | Función o Componente | Líneas de Código |
| :--- | :--- | :--- | :--- |
| **Detección Reactiva de Conectividad**| `apps/web/src/hooks/useOnlineStatus.ts` | `useSyncExternalStore + onlineManager` | [`L1-L37`](file:///home/zer0x/projects/paraglide/apps/web/src/hooks/useOnlineStatus.ts#L1-L37) |
| **Reporte Automático de Error de Red**| `apps/web/src/hooks/useOnlineStatus.ts` | `reportNetworkError()` | [`L40-L47`](file:///home/zer0x/projects/paraglide/apps/web/src/hooks/useOnlineStatus.ts#L40-L47) |
| **Inicialización IndexedDB (idb)** | `apps/web/src/services/outbox/outbox.service.ts` | `getDB()` | [`L12-L26`](file:///home/zer0x/projects/paraglide/apps/web/src/services/outbox/outbox.service.ts#L12-L26) |
| **Encolamiento con Idempotencia** | `apps/web/src/services/outbox/outbox.service.ts` | `enqueue(entry, opciones)` | [`L45-L59`](file:///home/zer0x/projects/paraglide/apps/web/src/services/outbox/outbox.service.ts#L45-L59) |
| **Listado FIFO de Mutaciones** | `apps/web/src/services/outbox/outbox.service.ts` | `listOutbox()` | [`L61-L65`](file:///home/zer0x/projects/paraglide/apps/web/src/services/outbox/outbox.service.ts#L61-L65) |
| **Función Maestra de Replay** | `apps/web/src/services/outbox/outbox.service.ts` | `replayOutbox(api)` | [`L153-L217`](file:///home/zer0x/projects/paraglide/apps/web/src/services/outbox/outbox.service.ts#L153-L217) |
| **Remapeo Dinámico de IDs Temporales**| `apps/web/src/services/outbox/outbox.service.ts` | `deepReplaceId(target, oldId, newId)` | [`L119-L139, L188-L213`](file:///home/zer0x/projects/paraglide/apps/web/src/services/outbox/outbox.service.ts#L119-L139) |
| **Detección de Caída de Red en Replay**| `apps/web/src/services/outbox/outbox.service.ts` | `isNetworkError(err)` | [`L141-L150, L218-L223`](file:///home/zer0x/projects/paraglide/apps/web/src/services/outbox/outbox.service.ts#L141-L150) |
| **Gestión de Conflictos 409** | `apps/web/src/services/outbox/outbox.service.ts` | `markConflict(entry, error, status)` | [`L73-L88, L235-L238`](file:///home/zer0x/projects/paraglide/apps/web/src/services/outbox/outbox.service.ts#L73-L88) |
| **Límite de Reintentos (Max 5)** | `apps/web/src/services/outbox/outbox.service.ts` | `MAX_INTENTOS & entry.intentos` | [`L151, L243-L250`](file:///home/zer0x/projects/paraglide/apps/web/src/services/outbox/outbox.service.ts#L151) |
