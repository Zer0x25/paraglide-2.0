import { FastifyPluginAsync, RouteShorthandOptions } from 'fastify';
import { pilotosController } from '../controllers/pilotos.controller';

const pilotosRoutes: FastifyPluginAsync = async (fastify) => {
  const onlyAdmin: RouteShorthandOptions<any, any, any, any> =
    typeof fastify.authorize === 'function' ? { preHandler: fastify.authorize(['ADMIN']) } : {};
  const adminOrRecepcion: RouteShorthandOptions<any, any, any, any> =
    typeof fastify.authorize === 'function'
      ? { preHandler: fastify.authorize(['ADMIN', 'RECEPCION']) }
      : {};

  fastify.get('/', pilotosController.getAll);
  fastify.get('/:id/disponibilidad', pilotosController.getDisponibilidad);
  fastify.post('/', onlyAdmin, pilotosController.create);
  fastify.post('/matching', adminOrRecepcion, pilotosController.sugerirPiloto);
  fastify.post('/sugerir', adminOrRecepcion, pilotosController.sugerirPiloto);
  fastify.patch('/:id', onlyAdmin, pilotosController.update);
  fastify.post('/:id/disponibilidad/toggle', pilotosController.toggleDisponibilidad);
  fastify.delete('/:id/disponibilidad/reset', pilotosController.resetDisponibilidad);
  fastify.get('/:id/disponibilidad/bloques', pilotosController.getBloquesDisponibilidad);
  fastify.post('/:id/disponibilidad/bloques', pilotosController.setBloquesDisponibilidad);
  fastify.put('/:id/disponibilidad', pilotosController.saveDisponibilidad);
  fastify.delete('/:id', onlyAdmin, pilotosController.delete);
};

export default pilotosRoutes;
