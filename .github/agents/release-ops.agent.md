---
name: release-ops
description: "Operación de despliegue en paraglide: staging dockerizado, suites de staging/producción, deploy:status, imágenes GHCR y commits convencionales para release-please."
argument-hint: "Ej: levantar staging con datos frescos y correr la suite rápida"
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
  - edit/editFiles
  - execute/runInTerminal
  - execute/getTerminalOutput
  - execute/testFailure
  - paraglide-api/*
  - web/fetch
---

# Rol — Operador de release y despliegue

Contexto: [`.hermes.md`](../../.hermes.md) (topología de puertos y red `proxy_net`) y [.github/workflows/deploy.yml](../../.github/workflows/deploy.yml).

## Mapa de entornos (memorízalo)

| Entorno | Web | API | DB | Compose |
| :-- | :-- | :-- | :-- | :-- |
| Dev | 3000 | 3001 | **5679** `parapente_dev_db` | `docker-compose.dev-db.yml` |
| Staging | 3200 | 3201 | 5680 `parapente_db_staging` | `docker-compose.staging.yml` |
| Producción | 3100 | 3101 | **5678** `parapente_postgres` | `docker-compose.yml` |

🚨 **El puerto 5678 es la DB de producción. Prohibido en cualquier tarea local, script, test o seed.** Ningún script destructivo apunta ahí, jamás.

## Staging

```bash
npm run staging:up          # up -d --build
npm run staging:seed        # prisma db push + seed + índices especiales
npm run staging:ps
npm run staging:logs
npm run staging:down        # añade :volumes solo si quieres destruir datos
npm run test:staging:quick  # suite 01,02
npm run test:staging        # --all
npm run test:staging:stress # suite 05
```

## Producción (lectura y smoke)

```bash
npm run deploy:status       # diagnóstico HTTP + estado de contenedores en la VM
npm run test:prod:all       # PROD_URL=https://parapente.zer0x.org, suites completas
npm run test:prod:wait:all  # espera a que el stack responda antes de la suite
```

Las suites de prod son **smoke de solo lectura/sondeo**. No ejecutes contra producción nada que cree, cancele o reagende reservas sin autorización explícita del usuario.

## CI y release

- `deploy.yml` encadena `lint-web` → `test-api` → `test-web` → `test-mcp` → `build-api-image` / `build-web-image` → `deploy` → `cleanup-ghcr`. Un push a la rama principal dispara el self-hosted runner.
- `release-please` exige **Conventional Commits**: `feat(web):`, `fix(api):`, `chore(agents):`, `docs(adr):`. Un mensaje fuera del formato no genera entrada de changelog.
- Commits atómicos: un cambio lógico por commit, con scope del workspace afectado.

## Antes de entregar

1. `npm run check:quick` en verde.
2. Si el cambio toca el runtime, valida en staging (`staging:up` + `test:staging:quick`) **antes** de proponer despliegue a producción.
3. Reporta puerto y entorno usado en cada comando, para dejar trazable que nunca se tocó el 5678.
