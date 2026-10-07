---
name: e2e-flake-guard
description: "E2E Playwright en paraglide y prevención del flake de /login: mocks catch-all en DOM specs con JWT falso, catch de endpoints nuevos de warmup y verificación de specs. Úsalo al tocar apps/web/tests."
argument-hint: "Ej: el spec de pilotos redirige a /login cuando corro la suite completa"
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
  - playwright/*
  - web/fetch
---

# Rol — Guardián de E2E (antiflake)

Contexto obligatorio antes de tocar nada: [`.agents/memories/postmortem-e2e-flake-login.md`](../../.agents/memories/postmortem-e2e-flake-login.md).

## La causa raíz que ya nos costó una tarde

Los specs E2E de DOM mockean `/api/auth/login` con un **JWT falso** pero dejan fugarse al backend real el resto de endpoints (los que dispara `useWarmupData`: `pasajeros`, `reservas`, `vuelos`, `configuracion`, …). Un 401 real con ese JWT activa el interceptor de `apps/web/src/services/api.ts`, que borra la cookie y hace `window.location.href = '/login'` en medio del test. La carrera entre render y redirect hace fallar specs distintos según el paralelismo. **Es un flake, no un bug de la feature.**

## Regla inmutable

En todo spec con JWT falso, **cada endpoint `/api/` debe quedar mockeado**. El catch-all neutro es `mockAppShellApi` (`apps/web/tests/helpers/api-mocks.ts`), con dos excepciones:

- `/api/auth/login` → lo mockea `mockLoginApi` (el catch-all lo excluye a propósito).
- `/api/public/` → vistas sin sesión.

Al añadir un endpoint nuevo al AppShell o a `useWarmupData`, la suite DOM **no** debe depender de su respuesta real: verifica que caiga en el catch-all y no en la red.

## Checklist de diagnóstico

1. Confirma el síntoma en el snapshot de error de Playwright: si la página es `/login` y el test esperaba `/pilotos` o `/reservas`, es este flake.
2. Revisa `apps/web/src/services/api.ts` (interceptor 401) y `src/hooks/useWarmupData.ts` para ver qué endpoints nuevos se disparan.
3. `apps/web/tests/helpers/api-mocks.ts`: agrega el endpoint faltante al catch-all en lugar de mockearlo spec por spec.
4. Los specs "live" (`e2e-live-contract.spec.ts`) sí hablan con el backend real: no les apliques mocks y no los corras en paralelo con los DOM si el backend no está arriba.

## Gate

```bash
npm run test:e2e            # desde raíz, suite Playwright de apps/web
npx playwright test tests/<spec>.spec.ts --repeat-each=3   # desde apps/web, para confirmar que el flake murió
```

Repetir el spec 3 veces es obligatorio: un fix de flake que pasa una sola vez no está verificado.
