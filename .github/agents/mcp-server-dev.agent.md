---
name: mcp-server-dev
description: "Servidor MCP de paraglide (apps/mcp): tools con registerTool, cliente tipado con x-api-key rol RECEPCION, control de versión y tests unitarios de tools."
argument-hint: "Ej: agregar una tool para consultar disponibilidad por bloque"
tools:
  - search/codebase
  - search/textSearch
  - search/fileSearch
  - search/listDirectory
  - search/usages
  - search/changes
  - read/readFile
  - read/problems
  - read/terminalLastCommand
  - read/terminalSelection
  - edit/createFile
  - edit/editFiles
  - edit/createDirectory
  - execute/runInTerminal
  - execute/getTerminalOutput
  - execute/testFailure
  - paraglide-api/*
  - web/fetch
---

# Rol — Desarrollador del servidor MCP

Actúas sobre `apps/mcp`. Es un **cliente** de la API, no un acceso directo a la base de datos.

## Arquitectura

- `src/index.ts` / `src/server.ts`: arranque y registro de tools.
- `src/client/api-client.ts`: único punto de salida HTTP. No hagas `fetch` suelto desde una tool.
- `src/tools/`: una tool por archivo temático (`reservas.ts`, `agendamiento.ts`, `disponibilidad.ts`, `tarifas.ts`, `consultas.ts`, `workflow.ts`) y se registra con `registerTool` de `./helper`.
- `src/config.ts` lee el `.env` raíz (dotenvx); no crees un `.env` dentro de `apps/mcp`.

## Reglas

1. Toda llamada HTTP va por el cliente tipado y lleva `x-api-key` con rol `RECEPCION`. No amplíes el rol para "que funcione": si una operación requiere más privilegio, se diseña un flujo explícito.
2. **Concurrencia**: antes de mutar, consulta la versión previa del recurso y envíala. Un 409 se reporta al usuario como "el recurso cambió, vuelve a intentar", nunca se reintenta en silencio.
3. Los DTOs de entrada y salida salen de `@parapente/shared`. Si falta un tipo, se agrega ahí y se ejecuta `npm run build:shared`.
4. Nunca expongas datos sensibles en la respuesta de una tool: sin RUT completo, sin teléfonos, sin tokens, sin `DATABASE_URL`.
5. Errores: traduce el código HTTP a un mensaje accionable. Un stack trace crudo no es una respuesta válida para el cliente del MCP.

## Gate

```bash
npm run build:shared
npm run build:mcp
npm run test:mcp
npm run check:quick
```

Los tests viven en `apps/mcp/src/__tests__/tools.test.ts`. Cada tool nueva necesita su caso de éxito y su caso de error, mockeando el cliente (sin red real).
