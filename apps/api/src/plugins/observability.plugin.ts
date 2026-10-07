import fp from 'fastify-plugin';
import client from 'prom-client';

export default fp(async (fastify, opts) => {
  // Configuración base de prom-client
  const register = new client.Registry();
  
  // Recolectar métricas default de Node (CPU, memoria, event loop, etc.)
  client.collectDefaultMetrics({ register });

  // Métricas custom
  const httpRequestDurationMicroseconds = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in microseconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
  });

  const sseBroadcastTotal = new client.Counter({
    name: 'sse_broadcast_total',
    help: 'Total number of SSE broadcasts sent',
    labelNames: ['event']
  });

  const outboxQueueSize = new client.Gauge({
    name: 'outbox_queue_size',
    help: 'Current size of the mutation outbox queue'
  });

  register.registerMetric(httpRequestDurationMicroseconds);
  register.registerMetric(sseBroadcastTotal);
  register.registerMetric(outboxQueueSize);

  // Hook para medir latencias de peticiones HTTP
  fastify.addHook('onRequest', (request, reply, done) => {
    (request as any).startTime = process.hrtime();
    done();
  });

  fastify.addHook('onResponse', (request, reply, done) => {
    const start = (request as any).startTime;
    if (start) {
      const hrtime = process.hrtime(start);
      const durationInSeconds = hrtime[0] + hrtime[1] / 1e9;
      httpRequestDurationMicroseconds.labels(
        request.method,
        request.routeOptions.url || request.url,
        reply.statusCode.toString()
      ).observe(durationInSeconds);
    }
    done();
  });

  // Exponer el objeto metrics globalmente para poder actualizar custom metrics
  fastify.decorate('metrics', {
    sseBroadcastTotal,
    outboxQueueSize
  });

  // Endpoint de Prometheus
  fastify.get('/metrics', async (request, reply) => {
    reply.header('Content-Type', register.contentType);
    return register.metrics();
  });
});
