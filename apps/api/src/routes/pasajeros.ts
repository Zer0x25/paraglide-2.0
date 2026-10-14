import { FastifyPluginAsync, RouteShorthandOptions } from 'fastify';
import { pasajerosController } from '../controllers/pasajeros.controller';

const pasajerosRoutes: FastifyPluginAsync = async (fastify) => {
  const onlyAdmin: RouteShorthandOptions<any, any, any, any> =
    typeof fastify.authorize === 'function' ? { preHandler: fastify.authorize(['ADMIN']) } : {};
  const adminOrRecepcion: RouteShorthandOptions<any, any, any, any> =
    typeof fastify.authorize === 'function'
      ? { preHandler: fastify.authorize(['ADMIN', 'RECEPCION']) }
      : {};

  fastify.get('/', pasajerosController.getAll);
  fastify.get('/:id', pasajerosController.getById);
  fastify.post('/', adminOrRecepcion, pasajerosController.create);
  fastify.patch('/', adminOrRecepcion, pasajerosController.update);
  fastify.post('/:id/firma', pasajerosController.guardarFirma);
  fastify.delete('/:id', onlyAdmin, pasajerosController.delete);
};

export default pasajerosRoutes;
