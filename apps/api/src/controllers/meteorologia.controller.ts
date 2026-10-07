import { FastifyRequest, FastifyReply } from 'fastify';
import { meteorologiaService } from '../services/meteorologia.service';
import { logAudit } from '../services/auditoria.service';
import { CreateCondicionPistaPayloadSchema } from '@parapente/shared';

export class MeteorologiaController {
  async getUltimoEstado(req: FastifyRequest, reply: FastifyReply) {
    const estado = await meteorologiaService.getUltimoEstado();
    return reply.send(estado);
  }

  async getHistorial(req: FastifyRequest<{ Querystring: { limit?: string } }>, reply: FastifyReply) {
    const limit = req.query.limit ? Number(req.query.limit) : 30;
    const historial = await meteorologiaService.getHistorial(limit);
    return reply.send(historial);
  }

  async registrar(req: FastifyRequest, reply: FastifyReply) {
    const data = CreateCondicionPistaPayloadSchema.parse(req.body);
    const nuevoRegistro = await meteorologiaService.registrar(data);
    await logAudit(req, {
      accion: 'CAMBIAR_ESTADO_PISTA',
      entidad: 'CLIMA',
      entidadId: nuevoRegistro.id,
      descripcion: `Estado de pista registrado: ${nuevoRegistro.estadoPista}${data.velocidadViento != null ? ` (viento ${data.velocidadViento} km/h)` : ''}`,
      detalles: JSON.stringify({
        estadoPista: data.estadoPista,
        velocidadViento: data.velocidadViento,
        rachaViento: data.rachaViento,
        temperatura: data.temperatura,
        visibilidad: data.visibilidad,
      }),
    });
    return reply.code(201).send(nuevoRegistro);
  }

  async pronosticoOpenMeteo(req: FastifyRequest, reply: FastifyReply) {
    const pronostico = await meteorologiaService.obtenerPronosticoOpenMeteo();
    if (!pronostico) {
      return reply.code(503).send({
        error: 'No se pudo obtener el pronóstico de Open-Meteo en este momento.',
      });
    }
    return reply.send(pronostico);
  }

  async refrescarOpenMeteo(req: FastifyRequest, reply: FastifyReply) {
    try {
      const payload = await meteorologiaService.obtenerPronosticoOpenMeteo();
      const registro = await meteorologiaService.registrar(payload);
      await logAudit(req, {
        accion: 'CAMBIAR_ESTADO_PISTA',
        entidad: 'CLIMA',
        entidadId: registro.id,
        descripcion: `Pronóstico Open-Meteo publicado (viento ${payload.velocidadViento ?? '?'} km/h, ${payload.direccionViento ?? '?'})`,
        detalles: JSON.stringify({
          estadoPista: payload.estadoPista,
          velocidadViento: payload.velocidadViento,
          rachaViento: payload.rachaViento,
          temperatura: payload.temperatura,
          visibilidad: payload.visibilidad,
        }),
      });
      return reply.code(201).send(registro);
    } catch (err) {
      console.warn('[meteorologia] Fallo al refrescar Open-Meteo:', err);
      return reply.code(503).send({
        error: 'No se pudo obtener el pronóstico de Open-Meteo en este momento.',
      });
    }
  }
}

export const meteorologiaController = new MeteorologiaController();
