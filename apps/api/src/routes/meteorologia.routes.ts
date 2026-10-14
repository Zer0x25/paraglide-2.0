import { FastifyPluginAsync, RouteShorthandOptions } from 'fastify';
import { meteorologiaController } from '../controllers/meteorologia.controller';

const meteorologiaRoutes: FastifyPluginAsync = async (fastify) => {
  const adminOrRecepcion: RouteShorthandOptions<any, any, any, any> =
    typeof fastify.authorize === 'function'
      ? { preHandler: fastify.authorize(['ADMIN', 'RECEPCION']) }
      : {};

  fastify.get('/estado-actual', meteorologiaController.getUltimoEstado);
  fastify.get('/historial', meteorologiaController.getHistorial);
  fastify.post('/registro', adminOrRecepcion, meteorologiaController.registrar);
  fastify.get('/pronostico-openmeteo', meteorologiaController.pronosticoOpenMeteo);
  fastify.post('/refrescar-openmeteo', adminOrRecepcion, meteorologiaController.refrescarOpenMeteo);
};

export default meteorologiaRoutes;
