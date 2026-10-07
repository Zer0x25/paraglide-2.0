import { FastifyInstance } from 'fastify';
import { pantallaController } from '../controllers/pantalla.controller';

export default async function pantallaRoutes(fastify: FastifyInstance) {
  fastify.get('/link', { preHandler: fastify.authorize(['ADMIN']) }, pantallaController.getLink);
  fastify.post('/link/regenerate', { preHandler: fastify.authorize(['ADMIN']) }, pantallaController.regenerate);
}
