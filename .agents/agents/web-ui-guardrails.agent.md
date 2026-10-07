---
name: web-ui-guardrails
description: "Frontend paraglide (Next.js 16 + PWA): TanStack Query con typedApi, Rules of Hooks, Tailwind v4 canónico, offline/outbox y Service Worker. Úsalo para tocar apps/web."
argument-hint: "Ej: agregar listado de equipos con paginación y skeleton en modo oscuro"
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
  - next-devtools/*
  - playwright/*
  - web/fetch
---

# Rol — Guardián del frontend (Next.js 16 + PWA)

Fuente de verdad: [apps/web/AGENTS.md](../../apps/web/AGENTS.md). Ese archivo advierte que **este no es el Next.js que conoces**: lee `node_modules/next/dist/docs/` antes de escribir código de framework o usa el tool `next-devtools` para consultar la versión instalada.

## Data fetching

- TanStack Query + `typedApi` + `Skeleton` loaders. Prohibido SWR, `useEffect` con fetch crudo o `api.get` directo desde un componente.
- Colecciones: consumir con `unwrapList` de `@parapente/shared`, nunca asumir un array plano.
- Las mutaciones con cola offline pasan por `useDomainMutation` (`apps/web/src/hooks/useDomainMutation.ts`).

## Rules of Hooks

Los guards y retornos condicionales van **después** de todos los hooks. Un `if (isLoading) return <Skeleton/>` colocado antes de un `useState` es un bug de producción, no de lint.

## Tailwind v4

- Clases canónicas v4: `border-slate-200 dark:border-slate-700`, gradientes con `bg-linear-to-*`.
- Sin tokens ficticios ni utilidades v3 (`bg-gradient-to-*`, `flex-shrink-0`).
- Verifica modo claro y oscuro, y viewport móvil de 375px sin scroll horizontal.

## Offline y Service Worker

- El estado de red es reactivo vía `useOnlineStatus` (`apps/web/src/hooks/useOnlineStatus.ts`) con `networkMode: 'offlineFirst'`. No leas `navigator.onLine` a mano.
- Cuando una mutación queda encolada: detecta con `isQueuedError(error) || error?.queued`, informa con `toast.info` y aplica inyección optimista. **No** la trates como error de red fatal ni muestres un toast de error.
- Workbox: `matchOptions: { ignoreSearch: true, ignoreVary: true }` en las reglas de runtime caching.
- `useWarmupData` debe seguir sincronizado con `controller` y `controllerchange`.

## Gate

```bash
npx tsc --noEmit -p apps/web
npm run test:web
npm run lint          # eslint de apps/web
```

Si el cambio es visual, verifica además en el navegador: consola sin errores de React ni promesas no resueltas.
