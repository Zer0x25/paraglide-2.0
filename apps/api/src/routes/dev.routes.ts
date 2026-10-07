import { FastifyInstance } from 'fastify';
import { devToolsService } from '../services/devTools.service';

export default async function devRoutes(fastify: FastifyInstance) {
  // DELETE /api/dev/reset-db
  fastify.delete('/reset-db', { preHandler: fastify.authorize(['ADMIN']) }, async (request, reply) => {
    try {
      const result = await devToolsService.resetDb();
      return reply.send(result);
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ success: false, message: error.message });
    }
  });

  // POST /api/dev/create-admin
  fastify.post('/create-admin', { preHandler: fastify.authorize(['ADMIN']) }, async (request, reply) => {
    try {
      const result = await devToolsService.createAdmin();
      return reply.send(result);
    } catch (error: any) {
      if (error.code === 'P2002') {
        return reply.send({ success: false, message: 'El admin ya existe' });
      }
      request.log.error(error);
      return reply.status(500).send({ success: false, message: error.message });
    }
  });

  // POST /api/dev/simulate
  fastify.post<{ Body: { months: number; flightsPerDay: number; pilotsCount?: number } }>(
    '/simulate',
    { preHandler: fastify.authorize(['ADMIN']) },
    async (request, reply) => {
      const { months, flightsPerDay, pilotsCount = 10 } = request.body || {};

      if (!months || !flightsPerDay) {
        return reply.status(400).send({ message: 'Parámetros months y flightsPerDay son requeridos.' });
      }

      try {
        fastify.log.info(`Generando simulación: ${months} meses, ${flightsPerDay} vuelos/día, ${pilotsCount} pilotos.`);
        const result = await devToolsService.simulate({ months, flightsPerDay, pilotsCount });
        return reply.send(result);
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(500).send({ success: false, message: error.message });
      }
    },
  );
}