import { FastifyPluginAsync, RouteShorthandOptions } from 'fastify';
import { vuelosController } from '../controllers/vuelos.controller';

const vuelosRoutes: FastifyPluginAsync = async (fastify) => {
  const adminOrRecepcion: RouteShorthandOptions<any, any, any, any> =
    typeof fastify.authorize === 'function'
      ? { preHandler: fastify.authorize(['ADMIN', 'RECEPCION']) }
      : {};

  fastify.get('/', vuelosController.getAll);
  fastify.post('/', adminOrRecepcion, vuelosController.create);
  fastify.put('/:id', adminOrRecepcion, vuelosController.update);
  fastify.post('/asignacion-automatica', adminOrRecepcion, vuelosController.autoAssign);
  fastify.post('/agendamiento-grupo', adminOrRecepcion, vuelosController.agendarGrupo);
  fastify.patch('/:id/estado', vuelosController.updateEstado);
  fastify.delete('/:id', adminOrRecepcion, vuelosController.delete);
};

export default vuelosRoutes;
