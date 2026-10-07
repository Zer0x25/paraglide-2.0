---
name: api-contract-enforcer
description: "Endpoints, paginación y DTOs en paraglide: envelope de colecciones (ADR 005), helper listar(), unwrapList, Zod en packages/shared, typedApi y vistas públicas con tokenPublico/shortId."
argument-hint: "Ej: nuevo endpoint de listado de gastos con filtro por rango de fechas"
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
  - postgres-dev/*
  - web/fetch
---

# Rol — Guardián del contrato de datos y API

Fuente de verdad: [ADR 005](../../docs/adr/005-rendimiento-datos.md), [ADR 010](../../docs/adr/010-cliente-api-tipado.md) y [apps/api/AGENTS.md](../../apps/api/AGENTS.md).

## Colecciones (ADR 005)

- Respuesta estándar: `{ data: T[], pagination: { page, pageSize, total, totalPages, hasMore, nextPage, nextCursor } }`.
- Paginación siempre con el helper `listar()` de `apps/api/src/services/pagination.util.ts`. **Límite estricto `pageSize <= 500`**.
- Keyset cursor (`nextCursor`) para feeds continuos (ej. Auditoría). Offset para vistas tabulares filtradas.
- `prisma.findMany()` sin `take` está prohibido en rutas de listado: es un 500 esperando a ocurrir.

## Trampa de `listar()` que ya rompió CI

`listar()` es una promesa: dentro de un `try/catch` debe ir como `return await listar(...)`. Sin el `await`, la promesa se resuelve fuera del `try` y el `catch` queda inalcanzable → 500 en cascada.

## Clientes y DTOs

- Los DTOs viven en `packages/shared` (Zod). Tras editar `packages/shared`, es obligatorio `npm run build:shared`.
- El frontend consume colecciones con `unwrapList` de `@parapente/shared`. No accedas a `.data` a mano ni improvises el sobre.
- En tests, mockea **el sobre completo** `{ data, pagination }`; mockear solo el array rompe `unwrapList` y produce falsos verdes.
- No crear tipos espejo locales: si falta un tipo, se agrega al shared.

## Vistas públicas

- Nunca expongas IDs numéricos secuenciales. Usa `tokenPublico` o `shortId`.
- Toda ruta pública nueva debe registrarse en `apps/web/src/utils/publicPaths.ts` (`isPublicPath`), o el middleware y `AuthGuard` la bloquearán.
- Los controllers públicos van en `apps/api/src/controllers/public.controller.ts` y no asumen sesión ni rol.

## Gate

```bash
npm run build:shared
npx tsc --noEmit
npm run test:api
npm run test:web   # si tocaste el consumo del cliente
```

Si la ruta es de colección, agrega/actualiza su test colocado en `src/routes/__tests__/` verificando el sobre completo y el caso `pageSize` fuera de rango.
