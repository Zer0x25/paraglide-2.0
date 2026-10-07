import { FastifyPluginAsync } from 'fastify';
import { vuelosController } from '../controllers/vuelos.controller';

const vuelosRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', vuelosController.getAll);
  fastify.post('/', vuelosController.create);
  fastify.put('/:id', vuelosController.update);
  fastify.post('/asignacion-automatica', vuelosController.autoAssign);
  fastify.post('/agendamiento-grupo', vuelosController.agendarGrupo);
  fastify.patch('/:id/estado', vuelosController.updateEstado);
  fastify.delete('/:id', vuelosController.delete);
};

export default vuelosRoutes;