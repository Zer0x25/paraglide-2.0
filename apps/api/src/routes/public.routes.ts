import { FastifyPluginAsync } from 'fastify';
import { publicController } from '../controllers/public.controller';
import { APP_VERSION, resolveAppVersion } from '../services/public.service';

export { APP_VERSION, resolveAppVersion };

const publicRoutes: FastifyPluginAsync = async (fastify) => {
  // Mitigación de enumeración de IDs secuenciales en vistas públicas (ADR 005
  // pide identificadores no secuenciales: tokenPublico/shortId): rate limit por
  // IP sobre los endpoints que resuelven IDs numéricos y sobre la firma.
  const lecturaPublica = { config: { rateLimit: { max: 60, timeWindow: '1 minute' as const } } };
  const escrituraFirma = { config: { rateLimit: { max: 10, timeWindow: '1 minute' as const } } };

  // Healthcheck con metadatos para monitoreo, readiness y verificación de deploy (GitOps)
  fastify.get('/health', async (request, reply) => {
    return publicController.getHealth(request, reply);
  });

  // Deslinde activo (módulo Configuración). Sin versiones activas → 200 con null (no 404)
  fastify.get('/deslinde-activo', async (request, reply) => {
    return publicController.getDeslindeActivo(request, reply);
  });

  // Ficha pública de la empresa (Fase 2). Sin fila → 200 null (no 404).
  fastify.get('/empresa', async (request, reply) => {
    return publicController.getEmpresa(request, reply);
  });

  // FAQs públicas (solo publica:true, orden ascendente)
  fastify.get('/faqs', async (request, reply) => {
    return publicController.getFaqs(request, reply);
  });

  // Reglas operativas públicas (configuración no sensible: punto de encuentro, etc.)
  fastify.get('/reglas-operativas', async (request, reply) => {
    return publicController.getReglasOperativas(request, reply);
  });

  // Obtener datos públicos de la reserva y sus pasajeros para el deslinde
  fastify.get('/reservas/:id', lecturaPublica, async (request, reply) => {
    return publicController.getReserva(request as any, reply);
  });

  // Descarga directa de voucher en PDF (sin window.print)
  fastify.get('/voucher/:id/pdf', lecturaPublica, async (request, reply) => {
    return publicController.getVoucherPdf(request as any, reply);
  });

  // Alias para compatibilidad: /reservas/:id/pdf
  fastify.get('/reservas/:id/pdf', lecturaPublica, async (request, reply) => {
    return publicController.getVoucherPdf(request as any, reply);
  });

  // Guardar firma de deslinde pública (validada con Zod + rate limit estricto)
  fastify.post('/pasajeros/:id/firma', escrituraFirma, async (request, reply) => {
    return publicController.postFirmaDeslinde(request as any, reply);
  });

  // Pantalla de Sala de Espera / Check-in TV en vivo
  fastify.get('/pantalla', async (request, reply) => {
    return publicController.getPantalla(request as any, reply);
  });
};

export default publicRoutes;
