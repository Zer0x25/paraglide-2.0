---
name: release-ops
description: "Operación de despliegue en paraglide: staging dockerizado, suites de staging/producción, deploy:status, imágenes GHCR y commits convencionales para release-please."
argument-hint: "Ej: revisar aprobación de la RC en GitHub y su despliegue en la VM"
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

Contexto: [operación de RC](../../docs/ci-cd.md) y [.github/workflows/deploy.yml](../../.github/workflows/deploy.yml).

## Mapa de entornos (memorízalo)

| Entorno | Web | API | DB | Compose |
| :-- | :-- | :-- | :-- | :-- |
| Dev | 3000 | 3001 | **5679** `parapente_dev_db` | `docker-compose.dev-db.yml` |
| Staging | 3200 | 3201 | 5680 `parapente_staging_db` | `docker-compose.staging.yml` |
| Producción | 3100 | 3101 | **5678** `parapente_postgres` | `docker-compose.yml` |

🚨 **El puerto 5678 es la DB de producción. Prohibido en cualquier tarea local, script, test o seed.** Ningún script destructivo apunta ahí, jamás.

## Staging

```bash
npm run staging:up          # pull por digest, sin build; requiere .env.staging
npm run staging:ps
npm run staging:logs
npm run staging:down        # añade :volumes solo si quieres destruir datos
npm run test:staging:quick  # suite 01,02
npm run test:staging        # --all
npm run test:staging:stress # suite 05
```

Estos comandos son de operación o diagnóstico manual. El workflow ejecuta las
suites completas en GitHub antes del despliegue; no repetirlas en la VM como
paso automático. `staging:up` requiere `.env.staging` y no prepara por sí solo
el esquema/usuario; seguir la [guía de RC](../../docs/ci-cd.md).

## Producción (lectura y smoke)

```bash
npm run deploy:status       # diagnóstico HTTP + estado de contenedores en la VM
npm run test:prod:all       # PROD_URL=https://parapente.zer0x.org, suites completas
npm run test:prod:wait:all  # espera a que el stack responda antes de la suite
```

Las suites completas pueden crear o modificar datos: no asumir que son smoke de
solo lectura. No ejecutar operaciones de prueba que creen, cancelen o reagenden
reservas en producción sin autorización explícita del usuario. El flujo RC no
actualiza producción.

## CI y release

- `ci.yml` corre por PR hacia `main`, con suites por módulos y check obligatorio `CI Quality Gate ✅`. Solo instala dependencias si necesita ejecutar suites. Conserva evidencia de contenido durante 30 días; versiones coherentes de release o cambios documentales pueden reutilizarla. Si no se verifica, vuelve a ejecutar CI.
- Release Please prepara `vX.Y.Z-rc.N`; su PR recibe un único CI por `pull_request`. Aprobarlo si GitHub pide autorización del workflow del bot; no lanzar un dispatch adicional para el mismo PR. El dispatch manual queda para diagnóstico.
- El merge del PR de release publica la candidata e invoca `deploy.yml`. Verifica tag/commit/versión, reutiliza CI si corresponde y construye API/Web en paralelo. Un manifiesto previo verificado evita repetir CI/build en los reintentos.
- HTTP 01–07 y Playwright se ejecutan en `ubuntu-24.04`, con imágenes por digest y DB/credenciales temporales. Ese entorno y su volumen se eliminan al terminar. Un fallo bloquea el job de la VM.
- Solo con las pruebas aprobadas, `srv-hp-vm` recibe el manifiesto del mismo run, verifica aprobación/commit/digests y actualiza staging. No instala dependencias npm ni ejecuta HTTP/E2E. Usa `rc-deploy/` como checkout; conserva DB y credenciales locales en `~/.local/state/paraglide-staging/`.
- La prerelease conserva `rc-manifest.json` (imágenes), `rc-verification.json` (tests en GitHub) y `staging-deployment.json` (despliegue/salud local). `staging-verification.json` corresponde al flujo histórico anterior a la migración.
- Un reintento manual elige el código por `rc_tag`; la rama seleccionada aporta la definición del workflow. No valida código de aplicación nuevo de un PR.
- La promoción a Stable está pendiente; no hay automatización de producción ni se actualiza `latest`.
- `release-please` exige **Conventional Commits**. Ver `docs/ci-cd.md` para operación, configuración del runner y protección de `main`.

## Antes de entregar

1. `npm run check:quick` en verde.
2. Si el cambio toca el runtime, comprobar la aprobación HTTP/E2E de sus imágenes en GitHub y la salud/commit del despliegue en staging antes de proponer producción. Los diagnósticos manuales no sustituyen la aprobación del workflow.
3. Reporta puerto y entorno usado en cada comando, para dejar trazable que nunca se tocó el 5678.
