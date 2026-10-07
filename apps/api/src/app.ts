import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import prismaPlugin from './plugins/prisma';
import authPlugin from './plugins/auth';
import idempotenciaPlugin from './plugins/idempotencia.plugin';
import pilotosRoutes from './routes/pilotos';
import pasajerosRoutes from './routes/pasajeros';
import vuelosRoutes from './routes/vuelos';
import reservasRoutes from './routes/reservas';
import configuracionBloquesRoutes from './routes/configuracionBloques';
import gastosRoutes from './routes/gastos';
import dashboardRoutes from './routes/dashboard.routes';
import metricasRoutes from './routes/metricas.routes';
import reportesRoutes from './routes/reportes.routes';
import equiposRoutes from './routes/equipos.routes';
import meteorologiaRoutes from './routes/meteorologia.routes';
import auditoriaRoutes from './routes/auditoria.routes';
import tarifasRoutes from './routes/tarifas';
import promocionesRoutes from './routes/promociones';
import faqsRoutes from './routes/faqs';
import deslindesRoutes from './routes/deslindes';
import reglasOperativasRoutes from './routes/reglasOperativas';
import empresaRoutes from './routes/empresa';
import plantillasRoutes from './routes/plantillas.routes';
import notificacionesRoutes from './routes/notificaciones.routes';
import usersRoutes from './routes/users.routes';
import pantallaRoutes from './routes/pantalla.routes';
import publicRoutes from './routes/public.routes';
import { calendarProtectedRoutes, calendarPublicRoutes } from './routes/calendar.routes';
import devRoutes from './routes/dev.routes';
import eventosRoutes from './routes/eventos.routes';
import { modulesRoutes } from './routes/modules.routes';
import { config } from './config';

// Inicializar Sentry (Simulado si no hay DSN)
Sentry.init({
  dsn: config.sentryDsn,
  integrations: [
    nodeProfilingIntegration(),
  ],
  tracesSampleRate: 1.0,
  profilesSampleRate: 1.0,
});

export async function buildApp() {
  const app = Fastify({
    logger: config.nodeEnv !== 'test' ? {
      transport: config.nodeEnv === 'development' ? {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      } : undefined,
    } : false,
  });

  // Serializa Prisma.Decimal como número (no como string) en todas las respuestas JSON
  const decimalToNumber = (v: any): any => {
    if (v === null || v === undefined) return v;
    if (Prisma.Decimal.isDecimal(v) || (typeof v === 'object' && v.constructor?.name === 'Decimal' && typeof v.toNumber === 'function')) return v.toNumber();
    if (Array.isArray(v)) return v.map(decimalToNumber);
    if (v instanceof Date) return v;
    if (typeof v === 'object') {
      const out: Record<string, any> = {};
      for (const k of Object.keys(v)) out[k] = decimalToNumber(v[k]);
      return out;
    }
    return v;
  };
  app.setReplySerializer(function (payload: any) {
    if (payload === undefined || payload === null) return payload as unknown as string;
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(payload)) return payload as unknown as string;
    if (typeof payload === 'string') return payload;
    // Fastify puede pasar Uint8Array / ArrayBuffer para binarios (xlsx)
    if (payload instanceof Uint8Array) return payload as unknown as string;
    if (payload instanceof ArrayBuffer) return Buffer.from(payload) as unknown as string;
    return JSON.stringify(decimalToNumber(payload));
  });

  app.setErrorHandler((error: any, request, reply) => {
    // @parapente/shared empaqueta su propia copia de Zod en dist/ (tsup), por lo que
    // `error instanceof ZodError` falla al cruzar el límite del paquete y los fallos de
    // validación terminaban como 500 en producción. Detectamos por nombre además de
    // instanceof para cubrir ambos casos.
    const isZod =
      error instanceof ZodError ||
      (typeof error === 'object' &&
        error !== null &&
        (error as { name?: string }).name === 'ZodError');

    if (isZod) {
      // Ignorar para Sentry
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Error de validación',
        details: error.errors
      });
    }

    if (error.statusCode) {
      if (error.statusCode === 409) {
        // Conflicto: optimizar log, ignorar en Sentry
        app.log.info({ err: error, reqId: request.id }, 'Conflict Error (409)');
      } else if (error.statusCode >= 500) {
        // Solo enviar errores 500
        Sentry.withScope((scope) => {
          scope.setTag('reqId', request.id);
          scope.setExtra('body', request.body);
          scope.setExtra('query', request.query);
          Sentry.captureException(error);
        });
      }
      return reply.status(error.statusCode).send({
        statusCode: error.statusCode,
        error: error.name,
        message: error.message
      });
    }

    // Reportar errores inesperados (500) a Sentry
    Sentry.withScope((scope) => {
      scope.setTag('reqId', request.id);
      scope.setExtra('body', request.body);
      scope.setExtra('query', request.query);
      Sentry.captureException(error);
    });
    app.log.error({ err: error, reqId: request.id }, 'Unhandled Server Error');
    
    return reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: config.nodeEnv === 'development' ? error.message : 'Ha ocurrido un error inesperado'
    });
  });

  // Plugins
  await app.register(helmet, {
    global: true,
    // Se puede ajustar CSP según necesidades del frontend si el API sirve vistas, pero aquí es solo JSON
  });

  await app.register(rateLimit, {
    max: config.nodeEnv === 'development' ? 10000 : 1000,
    timeWindow: '1 minute'
  });

  await app.register(cors, {
    // En desarrollo se permite todo (origen nulo y cualquier origin).
    // En producción solo se permiten los orígenes de ALLOWED_ORIGINS
    // (p.ej. el dominio público de la web); peticiones sin Origin
    // (curl, proxy server-to-server, mismo origen) siguen pasando.
    origin: (origin, cb) => {
      const allowed =
        config.nodeEnv !== 'production' ||
        !origin ||
        config.allowedOrigins.includes(origin);
      cb(allowed ? null : new Error('Not allowed by CORS'), allowed);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  
  // Auth Plugin
  await app.register(authPlugin);
  
  // DB Plugin
  await app.register(prismaPlugin);

  // Broadcast Plugin — auto-emits SSE events for mutation routes (Pilar 6)
  await app.register(import('./plugins/broadcast.plugin'));

  // Observability Plugin (Pilar 7)
  await app.register(import('./plugins/observability.plugin'));

  // Routes
  app.register(import('./routes/auth.routes'), { prefix: '/api/auth' });
  app.register(publicRoutes, { prefix: '/api/public' });
  app.register(calendarPublicRoutes, { prefix: '/api/public/calendar' });
  app.register(eventosRoutes, { prefix: '/api' });
  app.register(modulesRoutes, { prefix: '/api' });
  
  app.register(async (protectedApp) => {
    protectedApp.addHook('onRequest', protectedApp.authenticate);

    // ADR 009: idempotencia del outbox — dedupe de mutaciones reenviadas
    // con X-Client-Id (debe correr tras authenticate: solo rutas privadas).
    protectedApp.register(idempotenciaPlugin);

    protectedApp.register(pilotosRoutes, { prefix: '/pilotos' });
    protectedApp.register(pasajerosRoutes, { prefix: '/pasajeros' });
    protectedApp.register(vuelosRoutes, { prefix: '/vuelos' });
    protectedApp.register(reservasRoutes, { prefix: '/reservas' });
    protectedApp.register(configuracionBloquesRoutes, { prefix: '/configuracion-bloques' });
    protectedApp.register(gastosRoutes, { prefix: '/gastos' });
    protectedApp.register(dashboardRoutes, { prefix: '/dashboard' });
    protectedApp.register(metricasRoutes, { prefix: '/metricas' });
    protectedApp.register(reportesRoutes, { prefix: '/reportes' });
    protectedApp.register(equiposRoutes, { prefix: '/equipos' });
    protectedApp.register(meteorologiaRoutes, { prefix: '/meteorologia' });
    protectedApp.register(auditoriaRoutes, { prefix: '/auditoria' });
    protectedApp.register(tarifasRoutes, { prefix: '/tarifas' });
    protectedApp.register(promocionesRoutes, { prefix: '/promociones' });
    protectedApp.register(faqsRoutes, { prefix: '/faqs' });
    protectedApp.register(deslindesRoutes, { prefix: '/deslindes' });
    protectedApp.register(reglasOperativasRoutes, { prefix: '/reglas-operativas' });
    protectedApp.register(empresaRoutes, { prefix: '/empresa' });
    protectedApp.register(plantillasRoutes, { prefix: '/plantillas' });
    protectedApp.register(notificacionesRoutes, { prefix: '/notificaciones' });
    protectedApp.register(usersRoutes, { prefix: '/users' });
    protectedApp.register(pantallaRoutes, { prefix: '/pantalla' });
    protectedApp.register(calendarProtectedRoutes, { prefix: '/calendar' });
    
    // Dev Tools (solo fuera de producción, requiere sesión ADMIN)
    if (config.nodeEnv !== 'production') {
      protectedApp.register(devRoutes, { prefix: '/dev' });
    }
  }, { prefix: '/api' });
  
  return app;
}
