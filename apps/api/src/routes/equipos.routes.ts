import { FastifyPluginAsync, RouteShorthandOptions } from 'fastify';
import { equiposController } from '../controllers/equipos.controller';

const equiposRoutes: FastifyPluginAsync = async (fastify) => {
  const onlyAdmin: RouteShorthandOptions<any, any, any, any> =
    typeof fastify.authorize === 'function' ? { preHandler: fastify.authorize(['ADMIN']) } : {};
  const adminOrRecepcion: RouteShorthandOptions<any, any, any, any> =
    typeof fastify.authorize === 'function'
      ? { preHandler: fastify.authorize(['ADMIN', 'RECEPCION']) }
      : {};

  fastify.get('/', equiposController.getAll);
  fastify.get('/:id', equiposController.getById);
  fastify.post('/', adminOrRecepcion, equiposController.create);
  fastify.put('/:id', adminOrRecepcion, equiposController.update);
  fastify.delete('/:id', onlyAdmin, equiposController.delete);

  // Mantenimiento
  fastify.post('/:id/mantenimientos', adminOrRecepcion, equiposController.addMantenimiento);
  fastify.delete(
    '/:id/mantenimientos/:mantenimientoId',
    onlyAdmin,
    equiposController.deleteMantenimiento,
  );
};

export default equiposRoutes;
