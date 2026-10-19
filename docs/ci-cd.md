# CI por PR y staging por Release Candidate

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

## Publicar una RC

Release Please crea o actualiza un PR con versión y changelog. Su configuración
está en modo prerelease: `versioning: prerelease`, `prerelease-type: rc.1` y
`prerelease: true`. La siguiente versión parte de la última publicada; no se
modifica a mano `.release-please-manifest.json` para simular una publicación.

1. Revisar y fusionar el PR de release cuando se quiera preparar una candidata.
2. Release Please publica `vX.Y.Z-rc.N` como prerelease e invoca explícitamente
   `RC → Staging`. Esto funciona con `GITHUB_TOKEN`, cuyos eventos automáticos
   no disparan otros workflows. El CI del PR del bot también se solicita por
   `workflow_dispatch`, sin pedir un token personal.
3. Se comprueba que la prerelease está publicada, que el tag pertenece a `main`
   y que coincide con la versión del commit. Se valida ese commit completo.
4. Se construyen API y Web para `linux/amd64`, con caché y sin emulación QEMU.
   No se mueve `latest`. Los digests y el commit quedan en `rc-manifest.json`,
   adjunto a la prerelease antes del despliegue.
5. El runner descarga esas imágenes, prepara el esquema y los datos mínimos de
   staging antes de iniciar la aplicación. Verifica el commit reportado por la
   API y ejecuta las suites HTTP 01–07 más Playwright contra staging.
6. Solo si todo pasa se adjunta `staging-verification.json`, con los mismos
   digests, commit y enlace a la ejecución. Los fallos conservan logs y capturas.

Una RC fallida no queda aprobada. Si requiere cambiar código, hacer otro PR y
publicar otra RC. Para reintentar una RC existente, ejecutar `RC → Staging` desde
Actions con su `rc_tag`; reutiliza las imágenes del manifiesto registrado.
Publicar manualmente una prerelease también activa el flujo, con las mismas
comprobaciones. No editar ni mover tags RC ya publicados.

La concurrencia serializa cada ciclo completo de RC para evitar despliegues
durante las pruebas de otra candidata. GitHub conserva una ejecución pendiente;
una solicitud nueva puede reemplazar otra que todavía no comenzó.

## Preparación del runner de staging

- Runner Linux con las etiquetas existentes `self-hosted` y `srv-hp-vm`.
- Docker, Compose v2 con soporte de `--wait` y acceso al daemon.
- Node 22 se configura en el workflow. Deben estar instaladas las bibliotecas
  nativas de Chromium; preparar una vez con `npx playwright install-deps chromium`
  si faltan. El workflow descarga el navegador y aprovecha su caché local.
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

La promoción futura deberá comprobar la evidencia de staging y desplegar los
digests de `rc-manifest.json`, sin construir imágenes nuevas. También habrá que
definir aprobación, metadatos de versión final, backups, cambios de esquema y
recuperación. No se presupone que revertir una imagen revierta la base de datos.
