# CI por PR y staging por Release Candidate

## Dónde se ejecuta cada paso

| Paso | Máquina | Resultado |
| :-- | :-- | :-- |
| CI del PR | GitHub (`ubuntu-latest`) | Tipos/lint/unitarios por módulos, o comprobación ligera de evidencia/documentación |
| Build API y Web | Dos runners de GitHub en paralelo | Imágenes RC en GHCR y manifiesto por digest |
| HTTP 01–07 y Playwright E2E | GitHub (`ubuntu-24.04`) | Aprobación de imágenes con DB temporal; se elimina al terminar |
| Despliegue de staging | VM, runner `srv-hp-vm-runner` | Descarga de digests aprobados, preparación del esquema y comprobación de salud/commit |

La VM no ejecuta las suites del workflow ni compila imágenes. Staging queda
encendido para pruebas manuales después del despliegue; producción sigue con
su versión anterior hasta que se defina y ejecute una promoción a Stable.

## Trabajo diario

1. Crear una rama corta desde `main` y abrir un PR.
2. Esperar `CI Quality Gate ✅`: tipos del monorepo y pruebas de los módulos
   afectados; lint si cambia Web. Shared, dependencias o infraestructura validan
   todas las aplicaciones. Documentación no instala dependencias.
3. Actualizar la rama si `main` avanzó y fusionar con un título Conventional
   Commits (`fix(api): ...`, `feat(web): ...`). No se construyen imágenes aquí.

CI corre por `pull_request`, sin una segunda ejecución por push. Los nuevos
commits cancelan las validaciones anteriores del mismo PR. Un fallo de detección,
tipos, lint o pruebas falla el propio check, y una cancelación no lo aprueba.
El nombre `CI Quality Gate ✅` se conserva aunque reutilice evidencia: consultar
el resumen y los pasos ejecutados para distinguir comprobaciones de suites.
Un PR exclusivamente documental mantiene el check sin instalar dependencias ni
construir imágenes ni ejecutar HTTP/E2E.

Al aprobar las suites, CI conserva durante 30 días un artefacto con la huella
del contenido probado y las suites ejecutadas. Esa huella incluye código,
dependencias (también integridades del lockfile), scripts, workflows y modos de
archivo. Omite documentación y solo normaliza los campos de versión que cambia
Release Please. Un cambio de dependencias o de definición de CI invalida la
evidencia anterior.

Un commit posterior que solo cambia documentación sobre un PR ya aprobado
reutiliza la evidencia del mismo contenido. En un PR normal no se ignoran
cambios de versión para esta comparación: esa excepción exige la validación de
metadatos del PR de release o una comprobación manual explícita.

## Publicar una RC

Release Please crea o actualiza un PR con versión y changelog. Su configuración
está en modo prerelease: `versioning: prerelease`, `prerelease-type: rc.1` y
`prerelease: true`. La siguiente versión parte de la última publicada; no se
modifica a mano `.release-please-manifest.json` para simular una publicación.

1. Revisar el PR de release. Su check obligatorio comprueba la coherencia de
   versiones en paquetes, lockfile y manifest, y limita la vía ligera a los
   archivos de release esperados. Reutiliza CI únicamente si encuentra evidencia
   exitosa de ese mismo contenido; verifica el origen del artefacto y recalcula
   la huella desde el commit probado. Si cambia código o dependencias, no hay
   evidencia vigente o no se puede verificar, ejecuta las suites completas.
   Aprobar el workflow del bot si GitHub lo solicita; no se lanza un segundo CI
   por `workflow_dispatch`.
2. Release Please publica `vX.Y.Z-rc.N` como prerelease e invoca explícitamente
   `RC → Staging`. Esto funciona con `GITHUB_TOKEN`, cuyos eventos automáticos
   pueden requerir autorización para ejecutar el workflow del PR del bot. No
   se necesita un PAT adicional.
3. Se comprueba que la prerelease está publicada, que el tag pertenece a `main`
   y que coincide con la versión del commit. Si su contenido ya tiene evidencia
   de CI verificable, no repite tipos, lint y unitarios. Sin esa evidencia,
   valida la candidata completa antes de construir imágenes.
4. Se construyen API y Web en paralelo, en runners independientes, para
   `linux/amd64`, con cachés separadas y sin emulación QEMU. Cada job conserva
   su digest en un artefacto de esta ejecución durante 14 días. Solo cuando
   ambos terminan bien se publica `rc-manifest.json` con los dos digests y el
   commit; si uno falla, no se publica el manifiesto ni se despliega staging.
   No se mueve `latest`. Un reintento con manifiesto previo omite ambos builds.
5. Un runner `ubuntu-24.04` de GitHub descarga las imágenes por digest y levanta
   API, Web y una DB temporal con credenciales propias. Verifica el commit y
   ejecuta las suites HTTP 01–07 más Playwright. El entorno temporal y su DB se
   eliminan al terminar, también cuando hay fallos. Logs y capturas se conservan.
6. Solo si todo pasa se publica `rc-verification.json` y se entrega un artefacto
   con la aprobación y el manifiesto probado. El job de VM depende del éxito de
   las pruebas y valida el commit, los dos digests, el origen GitHub y el run de
   esa aprobación antes de descargar imágenes. Un fallo de pruebas bloquea todo
   el job local y mantiene la versión que ya estaba desplegada.
7. El runner `srv-hp-vm` descarga esos mismos digests, prepara el esquema local y
   actualiza staging. Solo comprueba arranque, salud y commit; no repite HTTP/E2E.
   Publica `staging-deployment.json` para registrar el despliegue. La aprobación
   de tests y el despliegue local quedan como evidencias distintas.

Una RC fallida no queda aprobada. Si requiere cambiar código, hacer otro PR y
publicar otra RC. Para reintentar una RC existente, ejecutar `RC → Staging` desde
Actions con su `rc_tag`; reutiliza las imágenes del manifiesto registrado.
Publicar manualmente una prerelease también activa el flujo, con las mismas
comprobaciones. No editar ni mover tags RC ya publicados.

Los reintentos manuales aparecen como `Reintento manual de RC vX.Y.Z-rc.N`.
El tag indicado elige el código de aplicación, las imágenes y las pruebas;
la rama seleccionada en el formulario solo elige la definición del workflow.
Reintentar una RC publicada no valida código nuevo de un PR. El resumen de
resolución indica siempre el tag, el commit candidato y el evento que lo lanzó.

La concurrencia serializa cada ciclo completo de RC para evitar despliegues
durante las pruebas de otra candidata. GitHub conserva una ejecución pendiente;
una solicitud nueva puede reemplazar otra que todavía no comenzó.

El ciclo habitual es: **PR de código (suites por módulos) → PR de release
(metadatos y evidencia) → RC (build y pruebas de imágenes en GitHub) → VM
(despliegue de imágenes aprobadas)**. Las pruebas de imágenes se ejecutan una vez
por intento de RC y no repiten las pruebas unitarias del PR. Un reintento con
imágenes ya registradas omite CI/build, pero vuelve a probarlas en GitHub antes
de actualizar la VM.

El dispatch manual de CI sigue disponible para diagnósticos: por defecto ejecuta
las suites completas. La opción explícita `reuse` permite comprobar la evidencia
del contenido seleccionado; si no puede verificarla, ejecuta CI completo.

## Evidencias y recuperación de fallos

| Evidencia | Qué acredita | Dónde se guarda |
| :-- | :-- | :-- |
| `ci-evidence-<huella>` | Contenido y suites aprobadas en un PR | Artefacto de CI durante 30 días |
| `rc-manifest.json` | Tag, commit y digests API/Web | Prerelease |
| `rc-verification.json` | HTTP/E2E aprobados en un runner de GitHub | Prerelease y artefacto `verified-rc-<run_id>` |
| `staging-deployment.json` | Despliegue y salud/commit en la VM | Prerelease |

Los artefactos de digests, aprobación para la VM y resultados de pruebas duran
14 días. Las evidencias adjuntas a la prerelease permanecen. La VM consume la
aprobación del artefacto de su misma ejecución; un JSON histórico en la release
no sustituye ese paso. `staging-verification.json`, presente en RC anteriores,
pertenece al flujo histórico que probaba directamente en la VM.

- **Fallo de CI:** corregir el PR; no publicar una candidata sin validación.
- **Fallo de un build:** usar `Re-run failed jobs`; conserva el digest del otro
  build dentro del mismo run mientras exista su artefacto. No se publica el
  manifiesto completo ni se despliega con una sola imagen.
- **Fallo de HTTP/E2E:** revisar logs/capturas en `rc-test-results-<tag>`. La VM
  no empieza su job. Un cambio de código exige un PR y una RC nuevos.
- **Fallo del despliegue local:** revisar el job de VM y su diagnóstico. No hay
  rollback automático. Se puede reintentar ese job sin repetir las pruebas si
  conserva el artefacto aprobado de la misma ejecución.
- **Artefacto expirado o ausente:** reintentar el workflow completo con el mismo
  `rc_tag`. El manifiesto publicado evita reconstruir imágenes, pero las pruebas
  se vuelven a ejecutar en GitHub para generar una aprobación nueva.

## Preparación del runner de staging

- Runner Linux con las etiquetas existentes `self-hosted` y `srv-hp-vm`.
- Docker, Compose v2 con soporte de `--wait` y acceso al daemon.
- Node 22 se configura en el workflow. La VM ejecuta scripts sin dependencias de
  npm para el despliegue y usa un checkout propio en `rc-deploy/`. No instala
  dependencias de pruebas ni Chromium. Las pruebas HTTP/E2E y su contenedor
  Playwright se ejecutan en GitHub, con el UID/GID del runner hospedado.
- Puertos de staging disponibles: Web `3200`, API `3201`, DB `5680`. Todos
  escuchan solo en loopback. El proyecto Compose es `paraglide-staging`.
- Las credenciales se generan con aleatoriedad criptográfica y se conservan con
  permisos privados en `~/.local/state/paraglide-staging/credentials.json` y
  `rc.env`, bajo el usuario del runner. No se leen secretos ni URLs de producción.
  Mantener esos archivos mientras se conserve la DB de staging.
- El volumen `paraglide_rc_staging_data` es propio de este flujo. El volumen
  anterior de staging no se borra ni se adopta con credenciales distintas.
- El entorno GitHub `staging` puede crearse automáticamente en el primer run.
  No necesita secretos de producción ni un PAT adicional.

Los scripts operativos `staging:up`, `staging:down`, `staging:ps` y
`staging:logs` requieren una copia privada de `rc.env` en `.env.staging` en su
directorio de trabajo. Ese archivo está ignorado por Git. `staging:up` usa
`--no-build`; el workflow prepara esquema, índices y usuario administrativo.

Para pruebas manuales desde otro equipo, usar un túnel SSH al servidor:

```bash
ssh -L 3200:127.0.0.1:3200 usuario@servidor
```

Abrir `http://localhost:3200`. El usuario administrativo y su clave están en el
archivo privado `credentials.json` del runner. La DB contiene datos de prueba;
no se copia la DB productiva ni se configuran credenciales de Calendar o correo.

## Protección de main

En GitHub, configurar una regla para `main` con:

- PR obligatorio; cero aprobaciones requeridas para permitir trabajo individual.
- Check requerido **`CI Quality Gate ✅`**, con rama actualizada antes del merge.
- Resolución de conversaciones pendientes.
- Aplicación de la regla también a administradores, sin bypass habitual.
- Force-push y borrado de la rama deshabilitados.

Los YAML no activan esta protección: requiere permisos administrativos de la
integración o configuración en Settings → Branches / Rulesets. Sin la regla, el
workflow valida PRs pero GitHub todavía permite pushes directos a `main`.

## Stable: siguiente etapa

Este cambio termina en RC validada en staging. Se eliminan los despliegues de
producción por push, tag, marcadores de commit y merge de release. No se publica
Stable ni se modifica la instalación productiva con este flujo.

La promoción futura deberá comprobar `rc-verification.json`, la evidencia del
despliegue local y los digests de `rc-manifest.json`, sin construir imágenes
nuevas. También habrá que
definir aprobación, metadatos de versión final, backups, cambios de esquema y
recuperación. No se presupone que revertir una imagen revierta la base de datos.
