# 🗺️ Diagramas de Flujo Técnico de la Arquitectura — Parapente School

Este directorio constituye la especificación visual y técnica transversal de los flujos de ejecución del sistema **Parapente School**. Cada módulo cuenta con un diagrama formal en **Mermaid.js (`flowchart TD`)** y una **matriz de referencia cruzada** que vincula cada paso del flujo con la función y líneas de código exactas de la implementación.

---

## 🎨 Convenciones Visuales en Mermaid

Todos los diagramas siguen un estándar estricto para garantizar legibilidad, precisión arquitectónica y consistencia entre módulos:

| Elemento Visual | Sintaxis Mermaid | Significado Arquitectónico |
| :--- | :--- | :--- |
| **Inicio / Fin de Flujo** | `([ Texto ])` | Punto de entrada (Request del cliente, evento del scheduler) o término de ejecución (HTTP Response, confirmación). |
| **Decisión / Bifurcación** | `{ Texto }` | Condicionales lógicos (`if/else`, validaciones de Zod, comprobación de concurrencia `version`, guards de estado). |
| **Operación / Mutación** | `[ Texto ]` | Procesamiento en memoria, transformaciones, cálculo de tarifas, hashing y derivación de estados. |
| **Persistencia / I/O Asíncrono**| `[( Texto )]` | Operaciones de base de datos (Prisma `$transaction`, queries Postgres, IndexedDB, APIs externas). |
| **Ramas Condicionales** | `-- Si -->`, `-- No -->`, `-- Error -->` | Etiquetas explícitas de transición para cada camino de ejecución posible. |

---

## 🏛️ Mapa de Interacción Arquitectónica Global

```mermaid
flowchart TD
    %% Clientes y Actores
    UserWeb[Cliente Web / PWA Next.js] --> PWAOutbox[10. Resiliencia PWA & Outbox Sync]
    UserTV[Pantalla TV Espera] --> PublicRoutes[04. Rutas Publicas & Deslinde]
    AIAssistant[Agente IA / LLM] --> MCPServer[09. Servidor MCP]

    %% Capa Perimetral de Seguridad
    PWAOutbox --> AuthPerimeter[06. Auth JWT & Single Session ADR 013]
    MCPServer -- x-api-key RECEPCION --> AuthPerimeter

    %% Núcleo de Dominio (Fastify API)
    AuthPerimeter --> ReservasMod[01. Reservas, Pagos & Concurrencia ADR 004]
    AuthPerimeter --> CalendarMod[02. Calendario, Bloques & Capacidad]
    AuthPerimeter --> VuelosMod[03. Operaciones de Vuelo & Despacho]
    AuthPerimeter --> PilotosEquiposMod[05. Pilotos, Turnos & Mantenimiento]

    %% Interacciones Internas
    ReservasMod -- Invalida Vuelos --> VuelosMod
    CalendarMod -- Resuelve Slots para --> ReservasMod
    VuelosMod -- Actualiza Horas de Vela --> PilotosEquiposMod
    PublicRoutes -- Firma Digital Inmutable --> ReservasMod

    %% Servicios de Fondo y Automatización
    OpenMeteoAPI[Open-Meteo API Externa] --> MeteoScheduler[07. Scheduler Meteorologia 15m]
    MeteoScheduler -- Estado de Pista --> CalendarMod
    MeteoScheduler -- Alerta de Viento --> NotifScheduler[08. Scheduler Notificaciones 60m]
    VuelosMod -- Recordatorios 24h/2h --> NotifScheduler
    NotifScheduler --> Omnichannel[WhatsApp / Email / SMS]

    %% Eventos en Tiempo Real
    ReservasMod -- broadcastDatos --> SSEReactive[Eventos SSE multicliente]
    VuelosMod -- broadcastDatos --> SSEReactive
    MeteoScheduler -- broadcastDatos --> SSEReactive
    SSEReactive -. Invalidacion Reactiva .-> UserWeb
```

---

## 📑 Catálogo de Flujos Técnicos por Módulo

| Módulo | Documento de Flujo | Dominio y Responsabilidad Principal | Archivos Fuente Clave |
| :--- | :--- | :--- | :--- |
| **🌟 E2E Master** | [`reserva_vuelo_lifecycle_process_map.md`](./reserva_vuelo_lifecycle_process_map.md) | **Macroproceso End-to-End**: De la reserva al vuelo, deslinde digital táctil, matching por pesos, concurrencia híbrida, outbox offline y liquidación. | Arquitectura global (todas las capas) |
| **01. Reservas & Pagos** | [`01_reservas_pagos_flow.md`](./01_reservas_pagos_flow.md) | Ciclo de vida de reservas, cálculo de tarifas con `Decimal(12,2)`, abonos, derivación automática de estados y concurrencia optimista (`version Int`). | `reservas.controller.ts`<br>`reservas.crud.ts`<br>`reservas.ciclo-vida.ts` |
| **02. Calendario & Slots** | [`02_calendario_slots_flow.md`](./02_calendario_slots_flow.md) | Capacidad horaria, jerarquía de bloques (INDEFINIDO -> RANGO -> EXACTA), no solapamiento y feeds iCalendar HMAC-SHA256. | `configuracionBloques.ts`<br>`calendar.service.ts`<br>`configuracion.service.ts` |
| **03. Vuelos & Despacho** | [`03_vuelos_despacho_flow.md`](./03_vuelos_despacho_flow.md) | Asignación automática por pesos, agendamiento grupal atómico, bloqueo `SELECT FOR UPDATE` y máquina de estados. | `vuelos.controller.ts`<br>`vuelos.matching.ts`<br>`vuelos.lifecycle.ts` |
| **04. Pasajeros & Deslindes**| [`04_pasajeros_deslindes_flow.md`](./04_pasajeros_deslindes_flow.md) | Tokens públicos no secuenciales, captura táctil de firma Base64, inmutabilidad legal y actualización a apto para vuelo. | `public.routes.ts`<br>`deslindes.ts`<br>`deslinde/[token]/page.tsx` |
| **05. Pilotos & Equipos** | [`05_pilotos_equipos_flow.md`](./05_pilotos_equipos_flow.md) | Licencias vigentes, turnos, balanceo de carga de pilotos, historial de velas y alertas preventivas de inspección. | `pilotos.service.ts`<br>`equipos.service.ts`<br>`equipos.controller.ts` |
| **06. Auth & Sesión Única** | [`06_auth_single_session_flow.md`](./06_auth_single_session_flow.md) | Login bcrypt/OAuth2, incremento de `sessionVersion` (ADR 013), middleware Next.js y autorización por roles RBAC. | `auth.service.ts`<br>`plugins/auth.ts`<br>`web/middleware.ts` |
| **07. Meteorología & Pistas**| [`07_meteorologia_alertas_flow.md`](./07_meteorologia_alertas_flow.md) | Sampler de Open-Meteo cada 15 min, semáforo de pista (ABIERTA/CERRADA), fallback seguro y pantalla TV. | `meteoScheduler.service.ts`<br>`meteorologia.service.ts`<br>`openMeteo.service.ts` |
| **08. Notificaciones** | [`08_notificaciones_plantillas_flow.md`](./08_notificaciones_plantillas_flow.md) | Scheduler cada 60 min, ventanas de 24h y 2h, motor de plantillas seguras y despacho omnicanal (WhatsApp/Email). | `notificacionesScheduler.service.ts`<br>`notificaciones.service.ts`<br>`plantillas.service.ts` |
| **09. Servidor MCP** | [`09_mcp_server_flow.md`](./09_mcp_server_flow.md) | Integración para agentes IA, transporte STDIO/SSE, cliente HTTP Fastify tipado, auth por API Key y desempaque ADR 005. | `server.ts`<br>`client/api-client.ts`<br>`tools/reservas.ts` |
| **10. PWA & Outbox Offline** | [`10_pwa_offline_outbox_flow.md`](./10_pwa_offline_outbox_flow.md) | Detección reactiva de red, cola FIFO en IndexedDB con `X-Client-Id`, remapeo de IDs temporales y resolución de 409. | `useOnlineStatus.ts`<br>`outbox.service.ts` |
