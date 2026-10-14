import 'dotenv/config';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

// Inicializar OpenTelemetry (Trazas) solo fuera de producción o si se habilita explícitamente
let sdk: NodeSDK | null = null;
if (process.env.NODE_ENV !== 'production' && process.env.ENABLE_OTEL_CONSOLE === 'true') {
  sdk = new NodeSDK({
    traceExporter: new (require('@opentelemetry/sdk-trace-base').ConsoleSpanExporter)(),
    instrumentations: [getNodeAutoInstrumentations()],
  });
  sdk.start();
}
import { buildApp } from './app';
import { config } from './config';
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
    // Sampler de condiciones de pista vía Open-Meteo: barrido inicial + ciclo cada 15 min
    // Notificaciones automatizadas 24h/2h: barrido inicial + ciclo cada 60 min
    // Reconciliación de Google Calendar: barrido inicial + ciclo cada 60 min
    // Cierre contable de reservas históricas (>7 días): barrido inicial + ciclo diario 04:00 UTC
    const stopSchedulers = [
      iniciarHigieneBloques(),
      iniciarMeteoScheduler(),
      iniciarNotificacionesScheduler(),
      iniciarCalendarScheduler(),
      iniciarCierreContableScheduler(),
    ];

    // Graceful Shutdown
    let shuttingDown = false;
    const shutdown = async (signal: string) => {
      if (shuttingDown) return;
      shuttingDown = true;
      console.log(`\n[Server] Recibida señal ${signal}. Iniciando apagado ordenado...`);
      try {
        stopSchedulers.forEach((stop) => stop());
        await app.close();
        if (sdk) {
          await sdk.shutdown();
        }
        console.log('[Server] Apagado ordenado finalizado.');
        process.exit(0);
      } catch (err) {
        console.error('[Server] Error durante el apagado:', err);
        process.exit(1);
      }
    };
    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT', () => void shutdown('SIGINT'));
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

start();
