<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md — apps/web

Next.js 16 + React 19 + Tailwind v4 + PWA + TanStack Query.

## Guardrails de Frontend

| Dominio | Regla Obligatoria (DO) | Prohibido / Evitar (DON'T) |
| :--- | :--- | :--- |
| **Modales UI** | Patrón *Smart*: `rounded-3xl`, headers con badges, pasos `rounded-2xl`, inputs `rounded-2xl` | Modales planos, rígidos o desalineados con `AgendamientoRapidoModal` |
| **Data Fetching** | TanStack Query (`@tanstack/react-query`) + `typedApiOutbox` + `Skeleton` loaders para datos | SWR o llamadas en `useEffect`; estados iniciales `null` que flasheen ceros (`$0`) |
| **Concurrencia** | Manejo de `version` con `isConflictError` y `409`; tras una mutación que devuelve la entidad, reutilizar el `version` de la respuesta | Mutaciones ciegas sin versionado optimista; reutilizar una versión local obsoleta tras un paso que ya la incrementó (409 espurio) |
| **Tests E2E DOM** | Mockear **toda** la API con el catch-all neutro de [`tests/helpers/api-mocks.ts`](tests/helpers/api-mocks.ts) (`mockAppShellApi`; excluye `/api/auth/login` y `/api/public/`) | Specs con JWT fake y llamadas `/api/` sin mockear: un 401 real dispara el interceptor y redirige a `/login` en mitad del test |
| **Mutaciones Outbox**| Capturar `isQueuedError(error) || error?.queued` en controladores; cerrar modal, emitir `toast.info` e inyectar en caché | Tratar mutaciones encoladas en outbox como excepciones fatales con `toast.error` o rollbacks |
| **SW Lifecycle**  | `useWarmupData` sincronizado con `navigator.serviceWorker.controller` y `controllerchange` | Confiar en `navigator.serviceWorker.ready` aislado (resuelve antes de `clients.claim()`) |
| **Workbox & Cache**| `matchOptions: { ignoreSearch: true, ignoreVary: true }` y `cacheWillUpdate` sin cabeceras `vary` | Omitir `ignoreVary` en Cache API (provoca cache miss en navegación offline) |
| **Fechas & TZ** | Normalizar con `dateKeyLocal`/`getDateKey` (offset local) | `new Date().toISOString().slice(0, 10)` a secas (falla en CI UTC) |
| **Tailwind v4** | Clases canónicas v4 (`border-slate-200 dark:border-slate-700`, `bg-linear-to-*`) | Tokens ficticios como `border-default` o sintaxis v3 |
| **Vistas Públicas** | Parámetros `tokenPublico`/`shortId` + registrar ruta en `publicPaths` | IDs numéricos correlativos o rutas bloqueadas por middleware |

## Referencias Clave
- **Design System & Tokens**: [`docs/design-system.md`](../../docs/design-system.md).
- **Offline & Conflictos**: [`docs/adr/009-offline-first-conflictos.md`](../../docs/adr/009-offline-first-conflictos.md).
- **Cliente API Tipado**: [`docs/adr/010-cliente-api-tipado.md`](../../docs/adr/010-cliente-api-tipado.md).
- **Suite E2E de Producción**: `npm run test:prod` (`scripts/test-prod-suite.ts`).
