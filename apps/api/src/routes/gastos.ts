import { FastifyPluginAsync } from 'fastify';
import { gastosController } from '../controllers/gastos.controller';

const gastosRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', gastosController.getAll);
  fastify.post('/', gastosController.create);
  fastify.delete('/:id', gastosController.delete);
};

export default gastosRoutes;
