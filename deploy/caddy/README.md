# Exponer la app por HTTPS (Caddy, infra-core)

El servidor de producción usa **Caddy** como ingress sobre la red externa
compartida `proxy_net`. La app ya está lista para servirse por HTTPS: el
navegador usa `NEXT_PUBLIC_API_URL=/api` (mismo origen, Next hace proxy de
`/api` hacia el contenedor `api`), y la API deduce el protocolo real de los
headers `x-forwarded-*` de Caddy (no depende de `PUBLIC_WEB_URL`, que es solo
fallback para links compartidos).

## Pasos

1. **DNS**: apuntar un dominio (p.ej. `parapente.midominio.com`) a la IP
   pública del servidor (registro A).

2. **Site block en Caddy**: añadir al Caddyfile de infra-core del servidor el
   bloque de `deploy/caddy/Caddyfile.example` con el dominio real. Alternativa
   con `caddy-docker-proxy`: añadir labels al servicio `web` del compose:
   ```yaml
   labels:
     caddy: parapente.midominio.com
     caddy.reverse_proxy: "{{upstreams 3000}}"
   ```

3. **Recargar Caddy**: `caddy reload` (o reiniciar el contenedor de Caddy).
   Emite y renueva el certificado Let's Encrypt automáticamente.

4. **Variables de entorno del servidor** (`.env` del deploy):
   - `PUBLIC_WEB_URL=https://parapente.midominio.com` — para que los links
     compartidos (pantalla/plantillas) usen la URL https.
   - `ALLOWED_ORIGINS=https://parapente.midominio.com` — solo si se expone la
     API directamente en otro origen; con proxy por el mismo origen no hace
     falta.

5. **Aplicar**: `docker compose up -d` (recrea `web` con el entorno nuevo) o
   `git pull && docker compose up -d --build` para recargar desde el repo.

## Verificación

```bash
curl -sI https://parapente.midominio.com/login     # 200
curl -s https://parapente.midominio.com/api/public/health   # {"status":"ok"}
```

## Notas

- El container `web` ya está en la red `proxy_net`, así que Caddy resuelve
  `parapente_web:3000` por DNS de Docker sin cambios en el compose.
- El health check del workflow de deploy sigue comprobando `localhost:3100`
  en el servidor; añadir https no lo rompe.
- `crypto.randomUUID` (fix `045da0c`) deja de ser un problema por https,
  porque https SÍ es contexto seguro; el fallback a `getRandomValues` sigue
  protegiendo el acceso por IP LAN http.
