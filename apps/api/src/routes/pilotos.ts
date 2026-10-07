import { FastifyPluginAsync } from 'fastify';
import { pilotosController } from '../controllers/pilotos.controller';

const pilotosRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', pilotosController.getAll);
  fastify.get('/:id/disponibilidad', pilotosController.getDisponibilidad);
  fastify.post('/', pilotosController.create);
  fastify.post('/matching', pilotosController.sugerirPiloto);
  fastify.post('/sugerir', pilotosController.sugerirPiloto);
  fastify.patch('/:id', pilotosController.update);
  fastify.post('/:id/disponibilidad/toggle', pilotosController.toggleDisponibilidad);
  fastify.delete('/:id/disponibilidad/reset', pilotosController.resetDisponibilidad);
  fastify.get('/:id/disponibilidad/bloques', pilotosController.getBloquesDisponibilidad);
  fastify.post('/:id/disponibilidad/bloques', pilotosController.setBloquesDisponibilidad);
  fastify.put('/:id/disponibilidad', pilotosController.saveDisponibilidad);
  fastify.delete('/:id', pilotosController.delete);
};

export default pilotosRoutes;