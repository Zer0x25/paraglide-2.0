# ADR 011: Observabilidad — Trazas, Métricas y Errores

## Estado
**Implementado** (2026-08-18).

## Fecha
- **Propuesta**: 2026-08-18.

## Contexto
El API (Fastify/pino) ya loguea con `reqId` por request, y el web ya incluye `@sentry/nextjs` en dependencias. Pero no hay **trazas** de extremo a extremo ni **métricas** agregadas: para diagnosticar un problema de rendimiento o una falla intermitente de sincronización (SSE, `409`, outbox del ADR 009) hay que leer logs dispersos a mano, sin correlación entre web y API.

En un despliegue homelab multi-servicio (Postgres, API, web, worker), se necesita una vista unificada de: latencia por endpoint, errores 4xx/5xx, fallos de concurrencia (409), y salud del bus SSE.

## Decisión
Adoptar una capa de observabilidad de tres planos:

1. **Trazas (OTel)**:
   - En el API, instrumentar Fastify con spans por request (petición HTTP → query Prisma → broadcast SSE) usando el OpenTelemetry Node SDK, manteniendo el `reqId` como `trace_id`/correlación.
   - El web inicia el mismo `traceparent` en cada llamada al API (via interceptor axios) para correlacionar web↔API sin infraestructura nueva.
2. **Métricas (Prometheus)**:
   - Exponer `/metrics` en el API (sin auth, o restringido a red interna del homelab) con: latencia p50/p95/p99 por ruta, contadores de `status_code` (incluidos `409`), throughput del bus SSE (`datos-cambios`, `modulos-cambios`), y tamaño de la cola de mutaciones del outbox (ADR 009).
   - Grafana en el homelab como dashboard (ya es el patrón del deploy Docker).
3. **Errores (Sentry)**:
   - Activar/consolidar `@sentry/nextjs` en el web y añadir `@sentry/node` al API para capturar excepciones no manejadas con contexto (`reqId`, entidad, `version`).
   - Tipar los errores de negocio (409, validación Zod) para que Sentry los clasifique y no se mezclen con los 500.

### Alcance
- Primera iteración: latencia por ruta + errores 5xx/409 + salud SSE en el API; Sentry en API. Web ya tiene Sentry de deps.
- No se añade un collector externo si no hace falta: OTel puede emitir a la consola/pino y Prometheus exponer el endpoint.

## Alternativas consideradas
- **Solo logs estructurados (pino)**: insuficiente para correlación y agregados; los logs ya existen y no bastan.
- **Sentry solo en web**: deja la API (donde está la lógica de negocio y concurrencia) sin telemetría.
- **Jaeger/Tempo standalone**: potente pero infra adicional; el `traceparent` + `reqId` da el 80% del valor sin coste.

## Consecuencias
- Diagnóstico end-to-end: un `reqId`/`trace_id` conecta web, API y DB para el mismo incidente.
- Visibilidad operativa de concurrencia (409) y del bus SSE — directamente relevantes para ADR 004/007/009.
- Coste de instrumentación acotado a un paquete por lado, sin servicios nuevos obligatorios.

## Relaciones
- **ADR 004/007** (Sincronización): métricas de 409 y de SSE.
- **ADR 009** (Offline-first): métricas de la cola de mutaciones.
- **ADR 010** (Cliente tipado): errores tipados alimentan la clasificación en Sentry.

## Referencias
- `apps/api/src/app.ts` — logging pino con `reqId`.
- `apps/web/package.json` — `@sentry/nextjs` ya presente.