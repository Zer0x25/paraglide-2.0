# Probar imágenes RC antes de actualizar la VM

- El workflow anterior ejecutaba pruebas completas en el runner self-hosted después de actualizar staging. Automatizaba la prueba de la VM real, pero consumía CPU local y detectaba errores después de reemplazar la candidata local.
- HTTP/E2E se trasladan a un runner hospedado por GitHub, con DB temporal. El job local depende del éxito de ese job y recibe su manifiesto aprobado por artefacto del mismo run. Rechaza otra ejecución, commit, digests, pruebas incompletas o aprobación de un runner local antes de iniciar pulls.
- La aprobación de imágenes (`rc-verification.json`) y el despliegue local (`staging-deployment.json`) son evidencias distintas. La VM solo despliega y comprueba salud/commit. Las pruebas en DB nueva no sustituyen esa comprobación del entorno persistente.
