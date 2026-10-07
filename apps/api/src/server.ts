import 'dotenv/config';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

// Inicializar OpenTelemetry (Trazas)
const sdk = new NodeSDK({
  traceExporter: new (require('@opentelemetry/sdk-trace-base').ConsoleSpanExporter)(),
  instrumentations: [getNodeAutoInstrumentations()]
});
sdk.start();
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
    iniciarHigieneBloques();
    // Sampler de condiciones de pista vía Open-Meteo: barrido inicial + ciclo cada 15 min
    iniciarMeteoScheduler();
    // Notificaciones automatizadas 24h/2h (esqueleto Fase 5): barrido inicial + ciclo cada 60 min
    iniciarNotificacionesScheduler();
    // Reconciliación de Google Calendar: barrido inicial + ciclo cada 60 min
    iniciarCalendarScheduler();
    // Cierre contable de reservas históricas (>7 días): barrido inicial + ciclo diario 04:00 UTC
    iniciarCierreContableScheduler();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

start();
