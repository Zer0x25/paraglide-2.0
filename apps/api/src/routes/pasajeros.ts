import { FastifyPluginAsync } from 'fastify';
import { pasajerosController } from '../controllers/pasajeros.controller';

const pasajerosRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', pasajerosController.getAll);
  fastify.get('/:id', pasajerosController.getById);
  fastify.post('/', pasajerosController.create);
  fastify.patch('/:id', pasajerosController.update);
  fastify.post('/:id/firma', pasajerosController.guardarFirma);
  fastify.delete('/:id', pasajerosController.delete);
};

export default pasajerosRoutes;