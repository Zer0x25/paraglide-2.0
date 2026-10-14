import 'dotenv/config';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

// Inicializar OpenTelemetry (Trazas) solo fuera de producción o si se habilita explícitamente
// Solo habilitar ConsoleSpanExporter cuando se solicite explícitamente (OTEL_CONSOLE_EXPORTER=true o ENABLE_OTEL_CONSOLE=true)
// para evitar saturar stdout/disco y bloquear el event loop en producción.
let sdk: NodeSDK | null = null;
const enableConsoleTraces =
  process.env.OTEL_CONSOLE_EXPORTER === 'true' ||
  (process.env.NODE_ENV !== 'production' && process.env.ENABLE_OTEL_CONSOLE === 'true');

if (enableConsoleTraces) {
  sdk = new NodeSDK({
    traceExporter: new (require('@opentelemetry/sdk-trace-base').ConsoleSpanExporter)(),
    instrumentations: [getNodeAutoInstrumentations()],
  });
  sdk.start();
}

import { buildApp } from './app';
import { config } from './config';
import { closeAllSseConnections } from './routes/eventos.routes';
import { iniciarHigieneBloques } from './services/higiene.service';
import { iniciarMeteoScheduler } from './services/meteoScheduler.service';
import { iniciarNotificacionesScheduler } from './services/notificacionesScheduler.service';
import { iniciarCalendarScheduler } from './services/calendarScheduler.service';
import { iniciarCierreContableScheduler } from './services/cierreContableScheduler.service';

async function start() {
  try {
    const app = await buildApp();
    // Server boot
    await app.listen({ port: config.port, host: config.host });
    console.log(`API de Fastify escuchando en el puerto ${config.port}`);

    // Higiene de reglas de bloques: barrido inicial + archivado diario 03:00 UTC
    const stopSchedulers = [
      iniciarHigieneBloques(),
      iniciarMeteoScheduler(),
      iniciarNotificacionesScheduler(),
      iniciarCalendarScheduler(),
      iniciarCierreContableScheduler(),
    ];

    let shuttingDown = false;
    const gracefulShutdown = async (signal: string) => {
      if (shuttingDown) return;
      shuttingDown = true;
      console.log(`\n[Server] Recibida señal ${signal}. Iniciando apagado ordenado...`);
      const forceExitTimer = setTimeout(() => {
        console.error('[Server] Tiempo máximo de apagado excedido, forzando salida.');
        process.exit(1);
      }, 8_000);
      forceExitTimer.unref?.();

      try {
        stopSchedulers.forEach((stop) => {
          try {
            stop();
          } catch (e) {
            console.error('[Server] Error deteniendo scheduler:', e);
          }
        });
        closeAllSseConnections();
        await app.close();
        if (sdk) {
          await sdk.shutdown().catch(() => {});
        }
        console.log('[Server] Conexiones HTTP y Prisma cerradas correctamente.');
        process.exit(0);
      } catch (shutdownErr) {
        console.error('[Server] Error durante el apagado ordenado:', shutdownErr);
        process.exit(1);
      }
    };

    process.once('SIGTERM', () => void gracefulShutdown('SIGTERM'));
    process.once('SIGINT', () => void gracefulShutdown('SIGINT'));
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

start();
