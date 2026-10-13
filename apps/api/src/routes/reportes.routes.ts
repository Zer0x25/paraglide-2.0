import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { reportesController } from '../controllers/reportes.controller';

const ManifiestoQuerySchema = z.object({
  fecha: z.string().optional(), // YYYY-MM-DD
});

const LiquidacionQuerySchema = z.object({
  mes: z.coerce.number().min(0).max(11).optional(),
  year: z.coerce.number().min(2000).max(2100).optional(),
  pilotoId: z.coerce.number().optional(),
});

const reportesRoutes: FastifyPluginAsync = async (fastify) => {
  const onlyAdmin =
    typeof fastify.authorize === 'function' ? { preHandler: fastify.authorize(['ADMIN']) } : {};
  const adminOrRecepcion =
    typeof fastify.authorize === 'function'
      ? { preHandler: fastify.authorize(['ADMIN', 'RECEPCION']) }
      : {};

  // 1. Manifiesto Diario de Vuelo (JSON)
  fastify.get('/manifiesto', adminOrRecepcion, async (request, reply) => {
    const query = ManifiestoQuerySchema.parse(request.query || {});
    return reportesController.getManifiesto({ ...request, query } as any, reply);
  });

  // 2. Liquidaciones de Pilotos (JSON) — exclusivo ADMIN
  fastify.get('/liquidaciones', onlyAdmin, async (request, reply) => {
    const query = LiquidacionQuerySchema.parse(request.query || {});
    return reportesController.getLiquidaciones({ ...request, query } as any, reply);
  });

  // 3. Manifiesto Diario en PDF
  fastify.get('/manifiesto/pdf', adminOrRecepcion, async (request, reply) => {
    const query = ManifiestoQuerySchema.parse(request.query || {});
    return reportesController.getManifiestoPdf({ ...request, query } as any, reply);
  });

  // 4. Exportar Liquidaciones a CSV para Excel (legacy) — exclusivo ADMIN
  fastify.get('/liquidaciones/csv', onlyAdmin, async (request, reply) => {
    const query = LiquidacionQuerySchema.parse(request.query || {});
    return reportesController.getLiquidacionesCsv({ ...request, query } as any, reply);
  });

  // 5. Exportar Liquidaciones a Excel .xlsx (formato nativo con estilos) — exclusivo ADMIN
  fastify.get('/liquidaciones/xlsx', onlyAdmin, async (request, reply) => {
    const query = LiquidacionQuerySchema.parse(request.query || {});
    return reportesController.getLiquidacionesXlsx({ ...request, query } as any, reply);
  });
};

export default reportesRoutes;
