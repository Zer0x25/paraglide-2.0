# @parapente/mcp — Paraglide Model Context Protocol (MCP) Server

Servidor oficial MCP (*Model Context Protocol*) de Paraglide para permitir que agentes de IA (Cursor, Claude Desktop, Copilot, bots conversacionales, n8n, etc.) interactúen de forma segura y estructurada con el sistema de reservas y agendamiento de la escuela de parapente.

---

## 🛡️ Modelo de Seguridad y Roles (No-Admin)

- **Identidad**: El servidor MCP se autentica ante `apps/api` como un agente de servicio con rol **`RECEPCION`** (cabecera `x-api-key`).
- **Sin permisos de administrador**: No tiene acceso a endpoints de `/dev/*`, gestión de usuarios/contraseñas (`/users`), configuración de tarifas base ni reglas operativas globales (`/tarifas`, `/reglas-operativas`, `/configuracion-bloques` edición).
- **Sin borrado destructivo**: El agente no puede invocar `DELETE`; las cancelaciones se realizan formalmente a través del endpoint controlado `POST /api/reservas/:id/cancelar` con auditoría.
- **Enlaces con tokens seguros**: Todos los accesos públicos para clientes y pasajeros (voucher y firma de deslinde) se generan usando tokens únicos y no secuenciales (`tokenPublico` o `shortId`), evitando la enumeración secuencial de IDs.

---

## 🧭 Convenciones de Integridad (aplican a todas las tools)

- **Horas en zona local (America/Santiago)**: `fechaHora` y `nuevaFechaHora` aceptan `YYYY-MM-DD HH:mm` (interpretado como hora local de Chile y normalizado a ISO UTC con `fechaHoraLocalToIso` de `@parapente/shared`) o un ISO UTC explícito. Los pares `fecha` + `hora` de `crear_y_agendar_reserva` siempre son hora local. Nunca se marca una hora local como si fuera UTC (desfase de 3–4 h).
- **Concurrencia optimista**: toda mutación envía el `version` de la reserva (si el invocador no lo indica, la tool lo consulta previamente). Ante un cambio concurrente la API responde `409 Conflict` y la tool retorna `isError`, de modo que el agente puede reconsultar y reintentar.
- **Sin precios inventados**: la cotización se obtiene de la API (`calcular_tarifa_reserva`); si falla, `crear_y_agendar_reserva` **aborta antes de crear la reserva** en vez de guardar un monto estimado como dinero real.
- **Moneda**: todos los montos son CLP.

---

## 🛠️ Herramientas Expuestas (Tools)

### 1. Consulta y Lectura
| Tool | Descripción | Parámetros principales |
| :--- | :--- | :--- |
| `consultar_meteorologia` | Condiciones actuales del centro (viento, ráfagas, recomendación y volabilidad). | Ninguno |
| `consultar_disponibilidad_calendario` | Consulta bloques configurados, vuelos agendados y capacidad libre. | `fecha` (YYYY-MM-DD) |
| `consultar_pilotos_disponibles` | Lista los pilotos activos y sus categorías sin exponer datos personales privados. | Ninguno |
| `calcular_tarifa_reserva` | Cotiza valor total, descuentos y valor por pasajero aplicando promociones. | `tarifaId?` (default 1: Vuelo Standard), `promocionId?`, `cantidadPasajeros` |
| `consultar_reserva` | Detalles completos de una reserva: titular, pasajeros, vuelos, pagos, versión y enlaces. | `reservaId` (número) |
| `listar_reservas` | Lista reservas con filtros de búsqueda, estado y rango de fechas (sobre ADR 005). | `q?`, `estado?`, `desde?`, `hasta?`, `page?`, `pageSize?` |
| `obtener_enlaces_deslinde` | Retorna los enlaces web públicos para la firma digital de deslinde y voucher. | `reservaId` (número) |
| `consultar_preguntas_frecuentes` | FAQ del centro con filtro por categoría y búsqueda de texto. | `categoria?`, `buscar?` |
| `consultar_reglas_operativas` | Reglas operativas vigentes (pesos, clima, cancelaciones, etc.). | Ninguno |
| `consultar_contacto_escuela` | Datos de contacto y ubicación de la escuela. | Ninguno |
| `consultar_promociones_activas` | Promociones vigentes con sus condiciones. | Ninguno |

### 2. Escritura y Agendamiento
| Tool | Descripción | Parámetros principales |
| :--- | :--- | :--- |
| `crear_reserva` | Crea una nueva reserva en estado `SIN_AGENDAR` con sus pasajeros y retorna los enlaces públicos. | `nombreTitular`, `pasajeros[]` (`nombre`, `peso?` máx. 130 kg, `telefono?`, `email?`, `rutDni?`), `email?`, `telefono?`, `rutDniTitular?`, `fechaAgenda?`, `horaAgenda?`, `esGiftCard?`, `valorTotal?`, `abono?`, `notas?` |
| `agendar_vuelos_reserva` | Agenda los vuelos del grupo en fecha y hora específica (auto-asigna pilotos). | `reservaId`, `fechaHora` (ISO UTC o `YYYY-MM-DD HH:mm` hora local), `valorPactadoPorPasajero?`, `asignaciones?`, `version?` |
| `reagendar_reserva` | Reprograma los vuelos de una reserva ante cancelaciones o mal tiempo (consulta la versión automáticamente). | `reservaId`, `nuevaFechaHora` (ISO o `YYYY-MM-DD HH:mm`), `motivo?` |
| `cancelar_reserva` | Cancela la reserva y desactiva los turnos agendados con motivo justificado; opcionalmente emite la devolución del abono. | `reservaId`, `motivo`, `devolverDinero?` |
| `desagendar_reserva` | Devuelve una reserva de `AGENDADA` a `SIN_AGENDAR`, liberando vuelos y pilotos para reagendarla. | `reservaId`, `version?` (se obtiene automáticamente si se omite) |

### 3. Flujo Compuesto de Alta Eficiencia
| Tool | Descripción | Parámetros |
| :--- | :--- | :--- |
| `crear_y_agendar_reserva` | **Operación compuesta**: cotiza, crea la reserva, agenda inmediatamente los turnos y retorna los enlaces públicos en un solo paso. Si la cotización falla, aborta sin crear nada. | `nombreTitular`, `pasajeros[]`, `fecha` (YYYY-MM-DD), `hora` (HH:mm), `tarifaId?`, `promocionId?`, `abono?`, `email?`, `telefono?`, `rutDniTitular?` |

---

## 🚀 Instalación y Ejecución

### 1. Variables de Entorno

Se cargan desde el `.env` de la raíz del monorepo y/o `apps/mcp/.env`:

```env
# URL base de la API de Fastify
PARAPENTE_API_URL=http://localhost:3001/api

# Clave de servicio para el servidor MCP (debe coincidir con SERVICE_API_KEY en apps/api)
PARAPENTE_API_KEY=dev-mcp-service-key-12345

# URL pública de la aplicación web (para links de voucher y deslinde)
PUBLIC_WEB_URL=http://localhost:3000
```

> ⚠️ La clave `dev-mcp-service-key-12345` es el fallback de desarrollo; en cualquier entorno expuesto debe definirse `PARAPENTE_API_KEY` (o `SERVICE_API_KEY`) con un valor secreto fuerte.

### 2. Comandos

Desde la raíz del monorepo:

- **Desarrollo (TSX)**:
  ```bash
  npm run dev --workspace=@parapente/mcp
  ```
- **Compilación (TypeScript)**:
  ```bash
  npm run build:mcp
  ```
- **Tests unitarios**:
  ```bash
  npm run test:mcp
  ```
- **Ejecutar servidor compilado (Stdio)**:
  ```bash
  node apps/mcp/dist/index.js
  ```

> Transporte actual: **Stdio** (`StdioServerTransport`). La conexión HTTP es la que el servidor MCP mantiene hacia `apps/api` mediante [`src/client/api-client.ts`](./src/client/api-client.ts) con `x-api-key`.

---

## 🔌 Configuración en Clientes MCP

### Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "paraglide": {
      "command": "node",
      "args": ["/ruta/absoluta/a/paraglide/apps/mcp/dist/index.js"],
      "env": {
        "PARAPENTE_API_URL": "http://localhost:3001/api",
        "PARAPENTE_API_KEY": "dev-mcp-service-key-12345",
        "PUBLIC_WEB_URL": "http://localhost:3000"
      }
    }
  }
}
```

### VS Code / GitHub Copilot (`.vscode/mcp.json`)

```json
{
  "servers": {
    "paraglide": {
      "command": "node",
      "args": ["${workspaceFolder}/apps/mcp/dist/index.js"],
      "env": {
        "PARAPENTE_API_URL": "http://localhost:3001/api",
        "PARAPENTE_API_KEY": "dev-mcp-service-key-12345",
        "PUBLIC_WEB_URL": "http://localhost:3000"
      }
    }
  }
}
```
