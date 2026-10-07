import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { buscarVuelosProximos, renderPlantilla } from '../services/notificaciones.service';
import { plantillasService } from '../services/plantillas.service';
import { toNum } from '../services/money.util';
import { getNotificacionConfig, updateNotificacionConfig } from '../services/notificacionConfig.service';
import { UpdateNotificacionConfigPayloadSchema } from '@parapente/shared';
import { logAudit } from '../services/auditoria.service';

/**
 * GET /api/notificaciones/pendientes
 * Preview de vuelos que dispararían notificación en próximas 24h (o 2h si se pide).
 * Protegido: ADMIN/RECEPCION (va bajo protectedApp).
 * Útil para tests Fase 5 y validación operativa sin enviar nada.
 */

const PendientesQuerySchema = z.object({
  horas: z.enum(['24', '2']).optional().default('24'),
});

const notificacionesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/pendientes',
    { preHandler: fastify.authorize(['ADMIN', 'RECEPCION']) },
    async (request, reply) => {
      const parsed = PendientesQuerySchema.safeParse(request.query ?? {});
      if (!parsed.success) {
        return reply.code(400).send({ statusCode: 400, message: 'Query inválida', details: parsed.error.errors });
      }
      const horas = Number(parsed.data.horas) as 24 | 2;

      const vuelos = await buscarVuelosProximos(horas);
      const tipoPlantilla = horas === 24 ? 'RECORDATORIO_24H' : 'AVISO_CLIMA_CANCELACION';
      const plantilla = await plantillasService.getByTipo(tipoPlantilla).catch(() => null);
      const cuerpoBase = plantilla?.cuerpo ?? (horas === 24
        ? '¡Hola {{nombre}}! Te recordamos tu vuelo el {{fecha}} a las {{hora}}.'
        : 'Hola {{nombre}}, tu vuelo es hoy {{fecha}}.');

      const pendientes = vuelos.map((v) => {
        const fecha = new Date(v.fechaHora).toLocaleDateString('es-CL');
        const hora = new Date(v.fechaHora).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false });
        // Enlaces públicos solo con identificadores no secuenciales (tokenPublico/shortId).
        const reservaPublicId = v.pasajero.reserva?.tokenPublico
          || (v.pasajero.reserva as { shortId?: string } | null)?.shortId
          || '';
        const vars: Record<string, string> =
          horas === 24
            ? {
                nombre: v.pasajero.nombre,
                fecha,
                hora,
                link_voucher: reservaPublicId ? `/voucher/${reservaPublicId}` : '',
                saldo: String(toNum(v.valorPactado)),
              }
            : { nombre: v.pasajero.nombre, fecha };

        return {
          vueloId: v.id,
          fechaHora: v.fechaHora,
          estado: v.estado,
          version: v.version ?? 0,
          valorPactado: toNum(v.valorPactado),
          piloto: v.piloto,
          pasajero: {
            id: v.pasajero.id,
            nombre: v.pasajero.nombre,
            telefono: v.pasajero.telefono,
            reservaId: v.pasajero.reservaId,
            tokenPublico: v.pasajero.reserva?.tokenPublico ?? null,
            shortId: (v.pasajero.reserva as { shortId?: string } | null)?.shortId ?? null,
          },
          plantilla: { tipo: tipoPlantilla, canal: plantilla?.canal ?? 'WHATSAPP' },
          variables: vars,
          preview: renderPlantilla(cuerpoBase, vars),
        };
      });

      const ahora = new Date();
      const ventanaMs = horas === 24 ? 30 * 60 * 1000 : 15 * 60 * 1000;
      const desde = new Date(ahora.getTime() + horas * 60 * 60 * 1000 - ventanaMs);
      const hasta = new Date(ahora.getTime() + horas * 60 * 60 * 1000 + ventanaMs);

      return reply.send({
        ventanaHoras: horas,
        tipoPlantilla,
        ventana: { desde: desde.toISOString(), hasta: hasta.toISOString() },
        total: pendientes.length,
        pendientes,
      });
    },
  );

  // Configuración de notificaciones automáticas — singleton (id=1).
  // GET/PUT protegidos ADMIN; PUT con version (ADR 004) + auditoría.
  fastify.get(
    '/config',
    { preHandler: fastify.authorize(['ADMIN']) },
    async (_request, reply) => {
      const cfg = await getNotificacionConfig();
      return reply.send(cfg);
    },
  );

  fastify.put(
    '/config',
    { preHandler: fastify.authorize(['ADMIN']) },
    async (request, reply) => {
      const body = (request.body ?? {}) as Record<string, unknown>;
      const parsed = UpdateNotificacionConfigPayloadSchema.safeParse(body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.errors });
      }
      const data = parsed.data;
      if (data.recordatorio24hActivo === undefined && data.avisoClimaActivo === undefined) {
        return reply.status(400).send({ error: 'Datos inválidos', details: ['debe enviar al menos uno de: recordatorio24hActivo, avisoClimaActivo'] });
      }
      try {
        const actualizado = await updateNotificacionConfig(data as { recordatorio24hActivo?: boolean; avisoClimaActivo?: boolean; version: number });
        await logAudit(request as never, {
          accion: 'ACTUALIZAR',
          entidad: 'CONFIGURACION',
          entidadId: actualizado.id,
          descripcion: `Config notificaciones actualizada (v${actualizado.version})`,
        });
        return reply.send(actualizado);
      } catch (e: unknown) {
        const err = e as { code?: string; statusCode?: number };
        if (err?.code === 'VERSION_CONFLICT' || err?.statusCode === 409) {
          return reply.status(409).send({ error: 'version' });
        }
        throw e;
      }
    },
  );
};

export default notificacionesRoutes;
