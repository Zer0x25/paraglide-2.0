# Diagrama de Flujo: Módulo de Meteorología y Monitoreo de Pistas (Premium)

Este documento modela la arquitectura técnica del módulo premium de **Meteorología Operacional**, incluyendo el scheduler autónomo de sondeo a Open-Meteo, el cálculo y derivación del estado de pista (`ABIERTA`, `PRECAUCION`, `CERRADA`), la persistencia histórica en base de datos y la difusión de condiciones meteorológicas en tiempo real en **Parapente School**.

---

## 1. Diagrama de Flujo Técnico (`flowchart TD`)

```mermaid
flowchart TD
    %% Inicio del Scheduler de Fondo
    SchedulerStart([Arranque de la API Fastify]) --> InitScheduler[iniciarMeteoScheduler: Barrido inicial + Intervalo 15 min]
    InitScheduler --> TimerTrigger[Temporizador cada 15 min con setInterval .unref]

    %% TAREA DE SONDEO (SAMPLER)
    TimerTrigger --> RunSample[samplearOpenMeteo]
    RunSample --> CallMeteoService[meteorologiaService.obtenerPronosticoOpenMeteo]
    CallMeteoService --> HttpOpenMeteo[GET api.open-meteo.com/v1/forecast]
    HttpOpenMeteo --> CheckApiResponse{Respuesta HTTP 200 y JSON valido?}
    CheckApiResponse -- Fallo / Timeout / Red cada --> LogMeteoWarn[console.warn: Open-Meteo no disponible]
    LogMeteoWarn --> SkipSample([Fin del ciclo de muestreo sin lanzar error])
    CheckApiResponse -- Exito --> ParseMeteoData[Mapear viento, ráfagas, nubosidad y temperatura]
    ParseMeteoData --> ConvertUnits[gradosADireccion: Convertir azimut a cuadrante cardinal N/SO/E]
    ConvertUnits --> EstimarNubes[estimarTechoNubes: Calcular altura de base de nube]
    EstimarNubes --> BuildMeteoPayload[Crear CreateCondicionPistaPayload]
    BuildMeteoPayload --> DBPersistCondicion[(prisma.condicionPista.create)]
    DBPersistCondicion --> BroadcastMeteoSSE[broadcastDatos: Notificar 'meteorologia' por SSE]
    BroadcastMeteoSSE --> SampleDone([Muestreo 15m completado exitosamente])

    %% CONSUMO DESDE CLIENTES Y FRONTEND
    ClientRequest([Cliente Web / Director de Vuelo]) --> MeteoController[MeteorologiaController]
    MeteoController --> MeteoEndpoint{Endpoint solicitado}

    %% Consulta de Estado Actual
    MeteoEndpoint -- GET /api/meteorologia/estado-actual --> QueryLastCond[(prisma.condicionPista.findFirst: orderBy fechaHora desc)]
    QueryLastCond --> HasCondDB{Existe registro en DB?}
    HasCondDB -- Si --> ReturnLastDB([Retornar 200 OK con Condicion Actual])
    HasCondDB -- No / Error DB --> FallbackSafe[Generar Condicion Segura por Defecto: Pista ABIERTA 12km/h]
    FallbackSafe --> ReturnFallback([Retornar 200 OK con Objeto Fallback])

    %% Registro Manual por Director de Vuelo
    MeteoEndpoint -- POST /api/meteorologia/registro --> ValManualPayload[Validar CreateCondicionPistaPayload Zod]
    ValManualPayload --> DBManualInsert[(prisma.condicionPista.create con observaciones y registradoPor)]
    DBManualInsert --> ManualBroadcastSSE[broadcastDatos: 'meteorologia' a todos los clientes]
    ManualBroadcastSSE --> ReturnManualOk([Retornar 201 Created con Condicion Manual])

    %% Refresco Forzado en Demanda
    MeteoEndpoint -- POST /api/meteorologia/refrescar-openmeteo --> TriggerManualSample[samplearOpenMeteo forzado]
    TriggerManualSample --> ReturnRefreshStatus([Retornar 200 OK: Boletin actualizado])
```

---

## 2. Matriz de Referencia Cruzada: [Paso del Diagrama] -> [Código Fuente]

| Paso del Diagrama | Archivo / Ubicación | Función o Componente | Líneas de Código |
| :--- | :--- | :--- | :--- |
| **Inicio del Scheduler de Fondo** | `apps/api/src/services/meteoScheduler.service.ts` | `iniciarMeteoScheduler()` | [`L37-L43`](file:///home/zer0x/projects/paraglide/apps/api/src/services/meteoScheduler.service.ts#L37-L43) |
| **Función Sampler a Open-Meteo** | `apps/api/src/services/meteoScheduler.service.ts` | `samplearOpenMeteo()` | [`L21-L34`](file:///home/zer0x/projects/paraglide/apps/api/src/services/meteoScheduler.service.ts#L21-L34) |
| **Cliente de Red Open-Meteo** | `apps/api/src/services/openMeteo.service.ts` | `obtenerOpenMeteo()` | Service OpenMeteo |
| **Conversión de Grados a Cuadrantes**| `apps/api/src/services/openMeteo.service.ts` | `gradosADireccion(grados)` | Service OpenMeteo |
| **Estimación de Techo de Nubes** | `apps/api/src/services/openMeteo.service.ts` | `estimarTechoNubes(cobertura)` | Service OpenMeteo |
| **Servicio de Persistencia Meteo** | `apps/api/src/services/meteorologia.service.ts` | `registrar(data)` | [`L61-L77`](file:///home/zer0x/projects/paraglide/apps/api/src/services/meteorologia.service.ts#L61-L77) |
| **Consulta con Fallback Seguro** | `apps/api/src/services/meteorologia.service.ts` | `getUltimoEstado()` | [`L6-L46`](file:///home/zer0x/projects/paraglide/apps/api/src/services/meteorologia.service.ts#L6-L46) |
| **Rutas de la API** | `apps/api/src/routes/meteorologia.routes.ts` | `meteorologiaRoutes` | [`L4-L10`](file:///home/zer0x/projects/paraglide/apps/api/src/routes/meteorologia.routes.ts#L4-L10) |
| **Pantalla Pública TV de Pista** | `apps/api/src/routes/public.routes.ts` | `fastify.get('/pantalla')` | [`L463-L558`](file:///home/zer0x/projects/paraglide/apps/api/src/routes/public.routes.ts#L463-L558) |
