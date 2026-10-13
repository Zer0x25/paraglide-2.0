import { FastifyPluginAsync, RouteShorthandOptions } from 'fastify';
import { plantillasController } from '../controllers/plantillas.controller';

const plantillasRoutes: FastifyPluginAsync = async (fastify) => {
  const onlyAdmin: RouteShorthandOptions<any, any, any, any> =
    typeof fastify.authorize === 'function' ? { preHandler: fastify.authorize(['ADMIN']) } : {};
  const adminOrRecepcion: RouteShorthandOptions<any, any, any, any> =
    typeof fastify.authorize === 'function'
      ? { preHandler: fastify.authorize(['ADMIN', 'RECEPCION']) }
      : {};

  fastify.get('/', plantillasController.getAll);
  fastify.get('/:id', plantillasController.getById);
  fastify.post('/', onlyAdmin, plantillasController.create);
  fastify.put('/:id', onlyAdmin, plantillasController.update);
  fastify.delete('/:id', onlyAdmin, plantillasController.delete);
  fastify.post('/render', adminOrRecepcion, plantillasController.render);
};

export default plantillasRoutes;
