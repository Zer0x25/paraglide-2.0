# Diagrama de Flujo: Módulo de Calendario, Slots y Capacidad

Este documento describe la arquitectura técnica del subsistema de **Calendario, Franjas Horarias y Capacidad Dinámica** en **Parapente School**, incluyendo la jerarquía de resolución de configuraciones de bloques, el cálculo de disponibilidad horaria, la prevención de solapamientos y la generación de feeds iCalendar (`.ics`) con verificación criptográfica HMAC-SHA256.

---

## 1. Diagrama de Flujo Técnico (`flowchart TD`)

```mermaid
flowchart TD
    %% Inicio y enrutamiento
    Start([Peticion HTTP al Calendario]) --> RouteDispatcher{Ruta / Endpoint}

    %% RAMA 1: RESOLVER CONFIGURACIÓN DE RANGO
    RouteDispatcher -- GET /api/configuracion-bloques/resolver --> ValFechas[Validar formato YYYY-MM-DD y rango desde <= hasta]
    ValFechas --> CheckDias{dias <= RESOLVER_MAX_DIAS 400?}
    CheckDias -- No --> ErrMaxDias([Retornar 400: Rango supera limite])
    CheckDias -- Si --> QueryConfigs[(tx / prisma.configuracionBloque.findMany activas con horarios)]
    QueryConfigs --> NumerarConfigs[numerarConfigs: Ordenar #1 INDEFINIDO, luego RANGOS y EXACTAS]
    NumerarConfigs --> LoopDias[Iterar dia por dia en el intervalo]
    LoopDias --> ResolveRule{Evaluar precedencia para la fecha}
    ResolveRule -- Prioridad 1 --> PickExacta[Seleccionar EXACTA coincidente con fecha]
    ResolveRule -- Prioridad 2 --> PickRango[Seleccionar RANGO que contenga la fecha]
    ResolveRule -- Prioridad 3 / Fallback --> PickIndefinido[Seleccionar INDEFINIDO global #1]
    PickExacta --> CheckBloqueadoDia{Configuracion bloqueada?}
    PickRango --> CheckBloqueadoDia
    PickIndefinido --> CheckBloqueadoDia
    CheckBloqueadoDia -- Si --> MarkBloqueado[capacidad = 0, bloqueado = true]
    CheckBloqueadoDia -- No --> CalcHorarios[Mapear franjas horarias y slots de vuelo]
    MarkBloqueado --> AccumResult[Acumular ResolucionDiaDTO]
    CalcHorarios --> AccumResult
    AccumResult --> OutResolver([Retornar 200 OK con Mapa de Disponibilidad])

    %% RAMA 2: CREAR / ACTUALIZAR CONFIGURACIÓN DE BLOQUES
    RouteDispatcher -- POST/PUT /api/configuracion-bloques --> ValSchema[CreateConfiguracionPayloadSchema Zod]
    ValSchema --> CheckZodConfig{Schema valido?}
    CheckZodConfig -- No --> ErrZodConfig([Retornar 400 Bad Request])
    CheckZodConfig -- Si --> TxConfig[(Iniciar prisma.$transaction)]
    TxConfig --> CheckAlcance{alcanceDe: EXACTA, RANGO o INDEFINIDO?}
    CheckAlcance --> ValidarSolapamientos[validarSolapamientos con configuraciones existentes]
    ValidarSolapamientos --> SolapaDetectado{Existe conflicto de fechas?}
    SolapaDetectado -- Si --> ErrConflict([Lanzar Error 400 con detalle de solapamiento])
    SolapaDetectado -- No --> CheckIndefinidoDup{Segundo indefinido intentado?}
    CheckIndefinidoDup -- Si --> ErrIndef([Lanzar Error 400: Solo un indefinido permitido])
    CheckIndefinidoDup -- No --> SaveConfig[(tx.configuracionBloque.create / update con horarios)]
    SaveConfig --> AuditConfig[logAudit: Registrar ARCHIVAR / CREAR / EDITAR]
    AuditConfig --> OutSaveConfig([Retornar 200 / 201 con Configuracion])

    %% RAMA 3: FEED PÚBLICO ICALENDAR (.ICS)
    RouteDispatcher -- GET /api/public/calendar/feed.ics --> CheckTokenParam{Parametro ?token presente?}
    CheckTokenParam -- No --> ErrNoToken([Retornar 401 Unauthorized])
    CheckTokenParam -- Si --> VerifyHmac[calendarService.verifyFeedToken: Deserializar Base64URL y HMAC-SHA256]
    VerifyHmac --> CheckSig{Firma criptografica valida?}
    CheckSig -- No --> ErrInvalidSig([Retornar 401: Token invalido o revocado])
    CheckSig -- Si --> EvalScope{Scope: all o piloto?}
    EvalScope -- all --> QueryAllVuelos[(prisma.vuelo.findMany con estado != CANCELADO)]
    EvalScope -- piloto --> QueryPilotoVuelos[(prisma.vuelo.findMany where pilotoId)]
    QueryAllVuelos --> BuildIcs[ical-generator: Construir eventos VEVENT, resumen y geolocalizacion]
    QueryPilotoVuelos --> BuildIcs
    BuildIcs --> SetIcsHeaders[Headers: text/calendar, Content-Disposition, Cache-Control 900s]
    SetIcsHeaders --> OutIcs([Retornar 200 OK con Stream ICS])
```

---

## 2. Matriz de Referencia Cruzada: [Paso del Diagrama] -> [Código Fuente]

| Paso del Diagrama | Archivo / Ubicación | Función o Componente | Líneas de Código |
| :--- | :--- | :--- | :--- |
| **Punto de Entrada Resolver** | `apps/api/src/routes/configuracionBloques.ts` | `fastify.get('/resolver')` | [`L33-L60`](file:///home/zer0x/projects/paraglide/apps/api/src/routes/configuracionBloques.ts#L33-L60) |
| **Validación de Rango y Límite** | `apps/api/src/routes/configuracionBloques.ts` | `formatoFecha y RESOLVER_MAX_DIAS` | [`L41-L56`](file:///home/zer0x/projects/paraglide/apps/api/src/routes/configuracionBloques.ts#L41-L56) |
| **Jerarquía de Precedencia** | `packages/shared/src/utils/configuracion.ts` | `resolverConfiguracion(configs, dia)` | Shared core logic |
| **Numeración Determinista** | `packages/shared/src/utils/configuracion.ts` | `numerarConfigs(configs)` | Shared core logic |
| **Validación de Solapamientos** | `apps/api/src/services/configuracion.service.ts` | `validarSolapamientos(db, data)` | [`L86-L120`](file:///home/zer0x/projects/paraglide/apps/api/src/services/configuracion.service.ts#L86-L120) |
| **Detección de Solapamiento Temporal**| `apps/api/src/services/configuracion.service.ts` | `solapan(aIni, aFin, bIni, bFin)` | [`L56-L69`](file:///home/zer0x/projects/paraglide/apps/api/src/services/configuracion.service.ts#L56-L69) |
| **Creación Atómica de Configuración** | `apps/api/src/routes/configuracionBloques.ts` | `fastify.post('/')` | [`L106-L140`](file:///home/zer0x/projects/paraglide/apps/api/src/routes/configuracionBloques.ts#L106-L140) |
| **Punto de Entrada Feed iCalendar** | `apps/api/src/controllers/calendar.controller.ts` | `CalendarController.getFeed` | [`L11-L58`](file:///home/zer0x/projects/paraglide/apps/api/src/controllers/calendar.controller.ts#L11-L58) |
| **Generación de Token HMAC-SHA256** | `apps/api/src/services/calendar.service.ts` | `generateFeedToken(scope, pilotoId)` | [`L21-L35`](file:///home/zer0x/projects/paraglide/apps/api/src/services/calendar.service.ts#L21-L35) |
| **Verificación Timing-Safe de Token** | `apps/api/src/services/calendar.service.ts` | `verifyFeedToken(token)` | [`L40-L65`](file:///home/zer0x/projects/paraglide/apps/api/src/services/calendar.service.ts#L40-L65) |
| **Generación Estructurada ICS** | `apps/api/src/services/calendar.service.ts` | `generateFeed(options)` | [`L70-L150`](file:///home/zer0x/projects/paraglide/apps/api/src/services/calendar.service.ts#L70-L150) |
