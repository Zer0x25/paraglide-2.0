import { FastifyPluginAsync, RouteShorthandOptions } from 'fastify';
import { reservasController } from '../controllers/reservas.controller';
import { calcularValor } from '../services/reservas.service';
import { CalcularValorPayloadSchema } from '@parapente/shared';

const reservasRoutes: FastifyPluginAsync = async (fastify) => {
  const onlyAdmin: RouteShorthandOptions<any, any, any, any> =
    typeof fastify.authorize === 'function' ? { preHandler: fastify.authorize(['ADMIN']) } : {};
  const adminOrRecepcion: RouteShorthandOptions<any, any, any, any> =
    typeof fastify.authorize === 'function'
      ? { preHandler: fastify.authorize(['ADMIN', 'RECEPCION']) }
      : {};

  // Fase 2: cálculo de valor (lectura pura). Registrado ANTES de /:id para que
  // Fastify no lo interprete como parámetro de ruta.
  fastify.post('/calcular-valor', adminOrRecepcion, async (request, reply) => {
    const parsed = CalcularValorPayloadSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.errors });
    }
    try {
      const calculo = await calcularValor(parsed.data);
      return reply.send(calculo);
    } catch (err: any) {
      const msg = String(err?.message ?? '');
      if (msg.includes('no encontrada') || msg.includes('vencida') || msg.includes('vigente')) {
        return reply.status(400).send({ error: msg });
      }
      throw err;
    }
  });

  fastify.get('/', reservasController.getAll);
  fastify.get('/:id', reservasController.getById);
  fastify.post('/', adminOrRecepcion, reservasController.create);
  fastify.patch('/:id', adminOrRecepcion, reservasController.update);
  fastify.post('/:id/pagos', adminOrRecepcion, reservasController.addPago);
  fastify.delete('/:id/pagos/:pagoId', adminOrRecepcion, reservasController.deletePago);
  fastify.post('/:id/devoluciones', adminOrRecepcion, reservasController.addDevolucion);
  fastify.delete(
    '/:id/devoluciones/:devolucionId',
    adminOrRecepcion,
    reservasController.deleteDevolucion,
  );
  fastify.put('/:id/estado-pasajeros', reservasController.actualizarEstadoPasajeros);
  fastify.post('/:id/cancelar', adminOrRecepcion, reservasController.cancelar);
  fastify.post('/:id/desagendar', adminOrRecepcion, reservasController.desagendar);
  fastify.post('/:id/cerrar', onlyAdmin, reservasController.cerrarContable);
  fastify.post('/:id/reabrir', onlyAdmin, reservasController.reabrirContable);
  fastify.delete('/:id', onlyAdmin, reservasController.delete);
};

export default reservasRoutes;
