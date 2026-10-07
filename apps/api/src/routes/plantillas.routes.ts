import { FastifyPluginAsync } from 'fastify';
import { plantillasController } from '../controllers/plantillas.controller';

const plantillasRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', plantillasController.getAll);
  fastify.get('/:id', plantillasController.getById);
  fastify.post('/', plantillasController.create);
  fastify.put('/:id', plantillasController.update);
  fastify.delete('/:id', plantillasController.delete);
  fastify.post('/render', plantillasController.render);
};

export default plantillasRoutes;
