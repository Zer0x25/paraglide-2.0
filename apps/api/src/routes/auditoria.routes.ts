import { FastifyPluginAsync } from 'fastify';
import { auditoriaController } from '../controllers/auditoria.controller';

const auditoriaRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { preHandler: fastify.authorize(['ADMIN']) }, auditoriaController.getLogs);
};

export default auditoriaRoutes;
