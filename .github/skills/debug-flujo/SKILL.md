---
name: debug-flujo
description: "Use when: depurar un bug, test que falla, error de CI, fallo de deploy, 'local pasa pero CI falla', comportamiento inesperado en runtime, o diagnosticar cualquier problema antes de arreglarlo. Flujo sistemático con límite de iteraciones y verificación en el entorno real del fallo. NO usar para features nuevas ni refactors planificados."
---

# Flujo DEBUG — Resolución sistemática de bugs

Objetivo: minimizar el tiempo entre síntoma y fix **verificado**. El enemigo es el loop lento de hipótesis probadas de una en una.

## Paso 0 — Clasifica (30 segundos)

1. ¿Reproduce local? 
   - **Sí** → continúa al paso 1.
   - **No (solo CI/prod)** → es bug de **PARIDAD DE ENTORNO**: el paso 2 es obligatorio, no opcional.
2. ¿Es conocido? Consulta `/memories/repo/` y los gotchas del proyecto ANTES de diagnosticar nada.
3. `git status` + grep de símbolos relevantes: el fix puede estar a medias en el working tree.

## Paso 1 — Reproduce UNA vez con evidencia completa

- Corre el comando/test que falla y guarda la salida COMPLETA (sin greps agresivos que recorten el stack).
- Un solo intento bien instrumentado vale más que diez intentos a ciegas.

## Paso 2 — Paridad de entornos (si solo falla fuera de local)

Compara ANTES de hipotetizar:

```bash
node --version          # local vs la del workflow (grep node-version .github/workflows/*.yml)
npm ls <dep>            # vs lockfile
git diff <sha> HEAD -- package-lock.json | grep '"version"' | sort -u
```

- Un diff de versiones explica la mayoría de los "local pasa / CI falla".
- Para probar el código EXACTO de otro commit sin tocar tu working tree:
  ```bash
  git worktree add /tmp/test-<sha> <sha>
  cd /tmp/test-<sha> && npm ci && npx prisma generate && npm run build:shared
  ```

## Paso 3 — Lote de diagnóstico (prohibidas las hipótesis secuenciales)

Escribe UN probe que pruebe 3–5 hipótesis a la vez, con salidas etiquetadas:

```ts
console.log('H1 version:', process.version);
console.log('H2 mock aplicado?:', vi.isMockFunction(mod.apiRaw.get));
console.log('H3 env var:', process.env.ALGO ?? 'UNDEFINED');
```

Córrelo, lee TODO, bórralo.

> **Límite duro: 3 iteraciones write-run-read.** Si 3 lotes no lo resuelven, tu modelo mental está mal → vuelve al paso 0/1 y cuestiona supuestos (¿es el archivo que crees? ¿la versión que crees? ¿el entorno que crees?).

## Paso 4 — Fix mínimo contra la causa raíz + test de regresión

- Ataca la raíz (ej. polyfill de localStorage en `setup.ts`), nunca el síntoma (parchear cada test uno a uno).
- Añade o ajusta un test que falle SIN el fix y pase CON él.
- NO commitees una hipótesis sin verificarla donde fallaba (paso 5).

## Paso 5 — Verificación en el entorno del fallo

- Bug de CI → push y observa el run real:
  ```bash
  gh run watch <id> --exit-status        # en background; sigue otra tarea mientras tanto
  gh run view <id> --log-failed          # solo los pasos rotos, no el log completo
  ```
- Local verde **NO cuenta** si el fallo era de CI.
- Si tocaste `.github/workflows/**`: valida el YAML antes de pushear. Modificar workflows exige scope `workflow`: `gh auth refresh -h github.com -s workflow` (código one-time por navegador); sin él el push se rechaza DESPUÉS de commitear.

## Paso 6 — Post-mortem exprés (obligatorio)

3 líneas en `/memories/repo/`:
1. Causa raíz.
2. Qué señal lo habría revelado antes (¿en qué paso?).
3. Regla nueva para la próxima vez.

## Anti-patrones (detectados en sesión real — prohibidos)

| ❌ Anti-patrón | ✅ Correcto |
|---|---|
| ~30 probes secuenciales para una causa que un diff de versiones revelaba | Paridad de entornos en el paso 2 |
| Commitear la primera hipótesis plausible verificada solo donde YA pasaba | Verificar en el entorno del fallo (paso 5) |
| Delegar el debugging a subagentes | Diagnóstico directo: los subagentes no ven tu terminal ni tu historial |
| Empezar a implementar sin `git status` | Pre-vuelo: puede que el trabajo ya exista |
| Polling de CI con `sleep` largos | `gh run watch --exit-status` en background + otra tarea mientras tanto |

## Gotchas específicos de este repo (ver también `/memories/repo/`)

- **Node**: local puede tener Node 26; el workflow usa Node 22. jsdom/localStorage y otros APIs se comportan distinto entre versiones.
- **Automock de axios** (`vi.mock('axios')` sin factory): `create()` devuelve `undefined` y `api.ts` explota en interceptors a nivel de import. Usar factory con `importOriginal` + instancia compartida.
- **Health checks vs middleware**: si añades un guard que redirige rutas, actualiza el health check del deploy en el MISMO commit (un 307 esperado no es fallo de deploy).
- **Builds stale**: tras editar `packages/shared/src` correr `npm run build:shared`; tras editar schema Prisma, `npx prisma generate`. Errores TS2305/"property does not exist" recién editados casi siempre son esto.
