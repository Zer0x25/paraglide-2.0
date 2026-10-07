import { FastifyPluginAsync } from 'fastify';
import { meteorologiaController } from '../controllers/meteorologia.controller';

const meteorologiaRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/estado-actual', meteorologiaController.getUltimoEstado);
  fastify.get('/historial', meteorologiaController.getHistorial);
  fastify.post('/registro', meteorologiaController.registrar);
  fastify.get('/pronostico-openmeteo', meteorologiaController.pronosticoOpenMeteo);
  fastify.post('/refrescar-openmeteo', meteorologiaController.refrescarOpenMeteo);
};

export default meteorologiaRoutes;
