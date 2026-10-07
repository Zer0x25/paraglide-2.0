# Diagrama de Flujo: Módulo Servidor MCP (Integración IA con API Segura)

Este documento modela la arquitectura técnica y el ciclo de vida de peticiones del **Servidor Model Context Protocol (MCP)** en **Parapente School**, permitiendo a agentes LLM interactuar de forma segura con la API REST bajo el rol `RECEPCION`, respetando el control de concurrencia optimista (ADR 004), el contrato de sobres (ADR 005) y el soft-delete (ADR 006).

---

## 1. Diagrama de Flujo Técnico (`flowchart TD`)

```mermaid
flowchart TD
    %% Inicio de llamada desde el LLM
    LLMStart([Agente LLM / Asistente IA invoca Tool]) --> McpTransport{Transporte MCP}
    McpTransport -- STDIO / SSE Transport --> ServerHandler[McpServer: Buscar Tool registrada]

    %% Registro y resolución de Tools
    ServerHandler --> ToolSelector{Tool Invocada}
    ToolSelector -- consultar_disponibilidad --> ToolDisp[registerDisponibilidadTools]
    ToolSelector -- cotizar_vuelo --> ToolTarifas[registerTarifasTools]
    ToolSelector -- crear_reserva / consultar_reserva --> ToolReservas[registerReservasTools]
    ToolSelector -- agendar_vuelo / reagendar --> ToolAgendar[registerAgendamientoTools]

    %% Validación del Schema de Entrada
    ToolDisp --> ValToolInput[Validar InputSchema Zod de la Tool]
    ToolTarifas --> ValToolInput
    ToolReservas --> ValToolInput
    ToolAgendar --> ValToolInput
    ValToolInput --> CheckToolZod{Parametros Zod validos?}
    CheckToolZod -- No --> ErrZodTool([Retornar isError: true con detalles de validacion])

    %% Ejecución del Handler y Consulta Previa
    CheckToolZod -- Si --> CheckNeedsVersion{Operacion de mutacion exige version?}
    CheckNeedsVersion -- Si / Reagendar o Modificar --> FetchVersionPrior[ParaglideApiClient.getReserva: Consultar version actual]
    FetchVersionPrior --> InjectVersion[Inyectar version en el payload]
    CheckNeedsVersion -- No / Creacion o Lectura --> SkipVersionFetch[Continuar directo]
    InjectVersion --> ApiClientCall[ParaglideApiClient.request con method y path]
    SkipVersionFetch --> ApiClientCall

    %% Llamada HTTP Segura a la API Fastify
    ApiClientCall --> SetHeaders[Headers: Content-Type: application/json, x-api-key: serviceApiKey]
    SetHeaders --> FetchHttp[HTTP Fetch a localhost:3001]
    FetchHttp --> CheckFastifyStatus{Respuesta HTTP status?}
    CheckFastifyStatus -- 401 Unauthorized --> ErrAuthMcp([Retornar isError: true: API Key no autorizada])
    CheckFastifyStatus -- 409 Conflict --> ErrConflictMcp([Retornar isError: true: Conflicto de concurrencia. Entidad modificada])
    CheckFastifyStatus -- 400 / 404 / 500 --> ErrHttpMcp([Retornar isError: true con error.message de la API])
    CheckFastifyStatus -- 200 / 201 OK --> ParseData[Parsear JSON response]

    %% Tratamiento de Sobres ADR 005
    ParseData --> CheckIsList{La respuesta es una coleccion / lista?}
    CheckIsList -- Si --> UnwrapEnvelope[unwrapList: Extraer data o items del sobre ADR 005]
    CheckIsList -- No --> SingleEntity[Usar objeto directo]
    UnwrapEnvelope --> FormatTextResponse[JSON.stringify con enlaces publicos shortId/voucher]
    SingleEntity --> FormatTextResponse

    %% Retorno final estructurado al LLM
    FormatTextResponse --> ReturnMcpSuccess([Retornar content: text JSON al contexto del LLM])
```

---

## 2. Matriz de Referencia Cruzada: [Paso del Diagrama] -> [Código Fuente]

| Paso del Diagrama | Archivo / Ubicación | Función o Componente | Líneas de Código |
| :--- | :--- | :--- | :--- |
| **Inicialización del Servidor MCP** | `apps/mcp/src/server.ts` | `createMcpServer(client)` | [`L11-L26`](file:///home/zer0x/projects/paraglide/apps/mcp/src/server.ts#L11-L26) |
| **Cliente de Red Tipado con API Key** | `apps/mcp/src/client/api-client.ts` | `ParaglideApiClient.request<T>` | [`L12-L43`](file:///home/zer0x/projects/paraglide/apps/mcp/src/client/api-client.ts#L12-L43) |
| **Inyección de Header x-api-key** | `apps/mcp/src/client/api-client.ts` | `headers['x-api-key'] = this.apiKey` | [`L16-L18`](file:///home/zer0x/projects/paraglide/apps/mcp/src/client/api-client.ts#L16-L18) |
| **Herramienta Crear Reserva** | `apps/mcp/src/tools/reservas.ts` | `registerTool('crear_reserva')` | [`L9-L118`](file:///home/zer0x/projects/paraglide/apps/mcp/src/tools/reservas.ts#L9-L118) |
| **Herramienta Consultar Reserva** | `apps/mcp/src/tools/reservas.ts` | `registerTool('consultar_reserva')` | [`L120-L198`](file:///home/zer0x/projects/paraglide/apps/mcp/src/tools/reservas.ts#L120-L198) |
| **Desempaquetado de Sobres ADR 005** | `packages/shared/src/utils/unwrapList.ts` | `unwrapList(response)` | Shared unwrap utility |
| **Herramienta Disponibilidad** | `apps/mcp/src/tools/disponibilidad.ts` | `registerDisponibilidadTools` | Service disponibilidad |
| **Herramienta Cotizar y Tarifas** | `apps/mcp/src/tools/tarifas.ts` | `registerTarifasTools` | Service tarifas |
| **Control de Concurrencia en MCP** | `apps/mcp/src/tools/agendamiento.ts` | `getReserva -> inject version` | Service agendamiento |
