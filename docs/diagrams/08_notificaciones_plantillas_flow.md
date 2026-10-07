# Diagrama de Flujo: Módulo de Notificaciones Omnicanal y Plantillas (Premium)

Este documento describe la arquitectura técnica del subsistema de **Notificaciones Automatizadas y Motor de Plantillas** en **Parapente School**, incluyendo el scheduler cron de fondo cada 60 minutos, el cálculo de ventanas de recordatorio (24h y 2h), el motor de interpolación de plantillas seguras y el despacho omnicanal (WhatsApp / Email / SMS).

---

## 1. Diagrama de Flujo Técnico (`flowchart TD`)

```mermaid
flowchart TD
    %% Inicio del Scheduler de Notificaciones
    Start([Inicio del Servidor Fastify]) --> InitScheduler[iniciarNotificacionesScheduler: Barrido inicial + Intervalo 60 min]
    InitScheduler --> IntervalTimer[Temporizador cada 60 min con setInterval .unref]

    %% CICLO DE EVALUACIÓN (TICK)
    IntervalTimer --> Tick[tickNotificaciones: Ejecutar programarEnvios]
    Tick --> CheckConfig24h[(getNotificacionConfigSafe: Consultar recordatorio24hActivo)]
    CheckConfig24h --> Is24hActive{recordatorio24hActivo == true?}
    Is24hActive -- No --> Skip24h[Log: RECORDATORIO_24H desactivado por configuracion]
    Is24hActive -- Si --> Query24h[(buscarVuelosProximos: 24h con tolerancia ±30min, estado AGENDADO)]
    Query24h --> FetchPlantilla24h[(plantillasService.getByTipo: RECORDATORIO_24H)]
    FetchPlantilla24h --> LoopVuelos24h[Iterar sobre cada vuelo elegible]
    LoopVuelos24h --> BuildVars24h[varsParaRecordatorio24h: inyectar nombre, fecha, hora, link_voucher]
    BuildVars24h --> Render24h[renderPlantilla: Reemplazar {{clave}} con RegExp segura]
    Render24h --> Dispatch24h{Canal Configurado: WHATSAPP / EMAIL / SMS}
    Dispatch24h -- WHATSAPP / Twilio --> SendWa24h[Despacho API WhatsApp o Log Stub]
    Dispatch24h -- EMAIL / Resend --> SendEmail24h[Despacho API Resend o Log Stub]
    SendWa24h --> IncCounter24h[Incrementar contador enviados ventana 24h]
    SendEmail24h --> IncCounter24h
    IncCounter24h --> NextVuelo24h{Mas vuelos en 24h?}
    NextVuelo24h -- Si --> LoopVuelos24h
    NextVuelo24h -- No --> Done24h[Ventana 24h finalizada]

    %% VENTANA 2H
    Skip24h --> CheckConfig2h[(getNotificacionConfigSafe: Consultar avisoClimaActivo)]
    Done24h --> CheckConfig2h
    CheckConfig2h --> Is2hActive{avisoClimaActivo == true?}
    Is2hActive -- No --> Skip2h[Log: AVISO_CLIMA desactivado por configuracion]
    Is2hActive -- Si --> Query2h[(buscarVuelosProximos: 2h con tolerancia ±15min)]
    Query2h --> FetchPlantilla2h[(plantillasService.getByTipo: AVISO_CLIMA_CANCELACION)]
    FetchPlantilla2h --> LoopVuelos2h[Iterar sobre cada vuelo en ventana 2h]
    LoopVuelos2h --> BuildVars2h[varsParaAvisoClima: inyectar nombre y fecha]
    BuildVars2h --> Render2h[renderPlantilla: Compilar mensaje]
    Render2h --> Dispatch2h[Despacho operativo omnicanal]
    Dispatch2h --> IncCounter2h[Incrementar contador enviados ventana 2h]
    IncCounter2h --> NextVuelo2h{Mas vuelos en 2h?}
    NextVuelo2h -- Si --> LoopVuelos2h
    NextVuelo2h -- No --> Done2h[Ventana 2h finalizada]

    %% RESULTADO DEL CICLO
    Skip2h --> FinishCycle[Retornar ResultadoProgramacion: totales y enviados por ventana]
    Done2h --> FinishCycle
    FinishCycle --> CycleSuccess([Ciclo de notificaciones completado])
```

---

## 2. Matriz de Referencia Cruzada: [Paso del Diagrama] -> [Código Fuente]

| Paso del Diagrama | Archivo / Ubicación | Función o Componente | Líneas de Código |
| :--- | :--- | :--- | :--- |
| **Inicio del Scheduler** | `apps/api/src/services/notificacionesScheduler.service.ts` | `iniciarNotificacionesScheduler()` | [`L32-L38`](file:///home/zer0x/projects/paraglide/apps/api/src/services/notificacionesScheduler.service.ts#L32-L38) |
| **Ejecución del Tick Periódico** | `apps/api/src/services/notificacionesScheduler.service.ts` | `tickNotificaciones()` | [`L22-L30`](file:///home/zer0x/projects/paraglide/apps/api/src/services/notificacionesScheduler.service.ts#L22-L30) |
| **Punto de Entrada de Envío** | `apps/api/src/services/notificaciones.service.ts` | `programarEnvios()` | [`L188-L260`](file:///home/zer0x/projects/paraglide/apps/api/src/services/notificaciones.service.ts#L188-L260) |
| **Motor de Interpolación de Plantilla**| `apps/api/src/services/notificaciones.service.ts` | `renderPlantilla(plantilla, vars)` | [`L65-L72`](file:///home/zer0x/projects/paraglide/apps/api/src/services/notificaciones.service.ts#L65-L72) |
| **Búsqueda de Vuelos por Ventana** | `apps/api/src/services/notificaciones.service.ts` | `buscarVuelosProximos(horas)` | [`L102-L140`](file:///home/zer0x/projects/paraglide/apps/api/src/services/notificaciones.service.ts#L102-L140) |
| **Construcción de Variables 24h** | `apps/api/src/services/notificaciones.service.ts` | `varsParaRecordatorio24h(vuelo)` | [`L142-L160`](file:///home/zer0x/projects/paraglide/apps/api/src/services/notificaciones.service.ts#L142-L160) |
| **Construcción de Variables 2h** | `apps/api/src/services/notificaciones.service.ts` | `varsParaAvisoClima(vuelo)` | [`L162-L168`](file:///home/zer0x/projects/paraglide/apps/api/src/services/notificaciones.service.ts#L162-L168) |
| **Consulta de Configuración Segura** | `apps/api/src/services/notificacionConfig.service.ts` | `getNotificacionConfigSafe()` | Service config |
| **CRUD de Plantillas** | `apps/api/src/services/plantillas.service.ts` | `PlantillasService.getByTipo` | Service plantillas |
