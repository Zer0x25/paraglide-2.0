import { FastifyPluginAsync } from 'fastify';
import { reservasController } from '../controllers/reservas.controller';
import { calcularValor } from '../services/reservas.service';
import { CalcularValorPayloadSchema } from '@parapente/shared';

const reservasRoutes: FastifyPluginAsync = async (fastify) => {
  // Fase 2: cálculo de valor (lectura pura). Registrado ANTES de /:id para que
  // Fastify no lo interprete como parámetro de ruta.
  fastify.post(
    '/calcular-valor',
    { preHandler: fastify.authorize(['ADMIN', 'RECEPCION']) },
    async (request, reply) => {
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
    },
  );

  fastify.get('/', reservasController.getAll);
  fastify.get('/:id', reservasController.getById);
  fastify.post('/', reservasController.create);
  fastify.patch('/:id', reservasController.update);
  fastify.post('/:id/pagos', reservasController.addPago);
  fastify.delete('/:id/pagos/:pagoId', reservasController.deletePago);
  fastify.post('/:id/devoluciones', reservasController.addDevolucion);
  fastify.delete('/:id/devoluciones/:devolucionId', reservasController.deleteDevolucion);
  fastify.put('/:id/estado-pasajeros', reservasController.actualizarEstadoPasajeros);
  fastify.post('/:id/cancelar', reservasController.cancelar);
  fastify.post('/:id/desagendar', reservasController.desagendar);
  fastify.post('/:id/cerrar', { preHandler: fastify.authorize(['ADMIN']) }, reservasController.cerrarContable);
  fastify.post('/:id/reabrir', { preHandler: fastify.authorize(['ADMIN']) }, reservasController.reabrirContable);
  fastify.delete('/:id', reservasController.delete);
};

export default reservasRoutes;
