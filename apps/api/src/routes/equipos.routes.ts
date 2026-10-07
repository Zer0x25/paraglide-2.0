import { FastifyPluginAsync } from 'fastify';
import { equiposController } from '../controllers/equipos.controller';

const equiposRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', equiposController.getAll);
  fastify.get('/:id', equiposController.getById);
  fastify.post('/', equiposController.create);
  fastify.put('/:id', equiposController.update);
  fastify.delete('/:id', equiposController.delete);
  
  // Mantenimiento
  fastify.post('/:id/mantenimientos', equiposController.addMantenimiento);
  fastify.delete('/:id/mantenimientos/:mantenimientoId', equiposController.deleteMantenimiento);
};

export default equiposRoutes;
