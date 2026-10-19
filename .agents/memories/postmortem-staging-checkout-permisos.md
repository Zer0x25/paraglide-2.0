# Checkout de staging y resultados con propietario root

- Señal: checkout intentaba borrar el directorio persistente y terminaba con `--local can only be used inside a git repository`. En checkout v4 la retirada de credenciales en `finally` puede ocultar el fallo original de limpieza cuando `.git` ya desapareció. Las pruebas Playwright montaban el checkout escribible sin `--user`; se reprodujo localmente `EACCES` al intentar borrar sus resultados como usuario del runner.
- Corrección: recuperar antes de checkout solamente los resultados con UID 0 de `test-results/` y `apps/web/test-results/`, sin seguir enlaces; ejecutar las pruebas con el UID/GID del runner, HOME y cache temporal escribibles. El diagnóstico de aplicación requiere checkout y Node exitosos para no añadir un fallo secundario.
- Regla: todo contenedor de herramientas que escriba en un bind mount del runner debe usar su UID/GID. Verificar también que el host pueda borrar los resultados, además del éxito de las pruebas.

La recuperación se prueba sobre la RC existente con su manifiesto por digest; no requiere cambiar el tag ni reconstruir imágenes. La confirmación en el runner real queda en el PR del arreglo.

El reintento manual #48 terminó correctamente usando la definición del workflow del PR y el código inmutable de RC3. Fue una comprobación operativa; no evidencia sobre código nuevo de la aplicación. Los reintentos ahora identifican el tag en su título y el commit candidato en el resumen para distinguir ambos contextos.
