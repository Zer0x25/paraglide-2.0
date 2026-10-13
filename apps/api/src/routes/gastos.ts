import { FastifyPluginAsync, RouteShorthandOptions } from 'fastify';
import { gastosController } from '../controllers/gastos.controller';

const gastosRoutes: FastifyPluginAsync = async (fastify) => {
  const onlyAdmin: RouteShorthandOptions<any, any, any, any> =
    typeof fastify.authorize === 'function' ? { preHandler: fastify.authorize(['ADMIN']) } : {};
  const adminOrRecepcion: RouteShorthandOptions<any, any, any, any> =
    typeof fastify.authorize === 'function'
      ? { preHandler: fastify.authorize(['ADMIN', 'RECEPCION']) }
      : {};

  fastify.get('/', adminOrRecepcion, gastosController.getAll);
  fastify.post('/', adminOrRecepcion, gastosController.create);
  fastify.delete('/:id', onlyAdmin, gastosController.delete);
};

export default gastosRoutes;
