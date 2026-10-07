import { FastifyRequest, FastifyReply } from 'fastify';
import { pilotosService } from '../services/pilotos.service';
import { logAudit } from '../services/auditoria.service';
import { PilotoSchema } from '@parapente/shared';

export class PilotosController {
  async getAll(req: FastifyRequest<{ Querystring: Record<string, string | undefined> }>, reply: FastifyReply) {
    const pilotos = await pilotosService.getAll(req.query);
    return reply.send(pilotos);
  }

  async getDisponibilidad(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { id } = req.params;
    const disponibilidad = await pilotosService.getDisponibilidad(Number(id));
    if (!disponibilidad) {
      return reply.code(404).send({ error: 'Piloto no encontrado' });
    }
    return reply.send(disponibilidad);
  }

  async create(req: FastifyRequest, reply: FastifyReply) {
    const data = PilotoSchema.parse(req.body);
    const nuevoPiloto = await pilotosService.create(data);
    await logAudit(req, {
      accion: 'CREAR',
      entidad: 'PILOTO',
      entidadId: nuevoPiloto.id,
      descripcion: `Piloto ${nuevoPiloto.nombre} registrado`,
    });
    return reply.code(201).send(nuevoPiloto);
  }

  async update(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { id } = req.params;
    const data = PilotoSchema.partial().parse(req.body);
    const pilotoActualizado = await pilotosService.update(Number(id), data);
    await logAudit(req, {
      accion: 'EDITAR',
      entidad: 'PILOTO',
      entidadId: id,
      descripcion: `Piloto #${id} modificado${pilotoActualizado?.nombre ? ` (${pilotoActualizado.nombre})` : ''}`,
    });
    return reply.send(pilotoActualizado);
  }

  async toggleDisponibilidad(req: FastifyRequest<{ Params: { id: string }, Body: { fecha: string } }>, reply: FastifyReply) {
    const { id } = req.params;
    const { fecha } = req.body;
    const result = await pilotosService.toggleDisponibilidad(Number(id), fecha);
    await logAudit(req, {
      accion: 'EDITAR',
      entidad: 'PILOTO',
      entidadId: id,
      descripcion: `Disponibilidad del piloto #${id} modificada para el ${fecha}`,
    });
    return reply.send(result);
  }

  async resetDisponibilidad(
    req: FastifyRequest<{ Params: { id: string }; Querystring: { desde?: string; hasta?: string } }>,
    reply: FastifyReply,
  ) {
    const { id } = req.params;
    const { desde, hasta } = req.query ?? {};
    const formatoFecha = /^\d{4}-\d{2}-\d{2}$/;
    if (desde != null && !formatoFecha.test(desde)) {
      return reply.status(400).send({ error: 'Formato "desde" inválido. Use YYYY-MM-DD.' });
    }
    if (hasta != null && !formatoFecha.test(hasta)) {
      return reply.status(400).send({ error: 'Formato "hasta" inválido. Use YYYY-MM-DD.' });
    }
    if (desde && hasta && desde > hasta) {
      return reply.status(400).send({ error: '"desde" debe ser anterior o igual a "hasta"' });
    }
    const result = await pilotosService.resetDisponibilidad(Number(id), desde, hasta);
    await logAudit(req, {
      accion: 'EDITAR',
      entidad: 'PILOTO',
      entidadId: id,
      descripcion:
        desde || hasta
          ? `Disponibilidad del piloto #${id} limpiada (${desde ?? '…'} → ${hasta ?? '…'})`
          : `Disponibilidad del piloto #${id} restablecida`,
    });
    return reply.send(result);
  }

  async getBloquesDisponibilidad(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { id } = req.params;
    const result = await pilotosService.getBloquesDisponibilidad(Number(id));
    return reply.send(result);
  }

  async setBloquesDisponibilidad(req: FastifyRequest<{ Params: { id: string }, Body: { fecha: string; bloques: { horaInicio: string; horaFin: string }[] } }>, reply: FastifyReply) {
    const { id } = req.params;
    const { fecha, bloques } = req.body;
    if (!fecha) {
      return reply.code(400).send({ error: 'El campo fecha es obligatorio' });
    }
    const result = await pilotosService.setBloquesDisponibilidad(Number(id), fecha, bloques || []);
    await logAudit(req, {
      accion: 'EDITAR',
      entidad: 'PILOTO',
      entidadId: id,
      descripcion: `Disponibilidad por bloques del piloto #${id} actualizada para ${fecha}`,
    });
    return reply.send(result);
  }

  async saveDisponibilidad(req: FastifyRequest<{ Params: { id: string }, Body: { version: number; fechas: { fecha: string; disponible: boolean; bloques: { horaInicio: string; horaFin: string }[] }[] } }>, reply: FastifyReply) {
    const { id } = req.params;
    const { version, fechas } = req.body;
    const result = await pilotosService.saveDisponibilidad(Number(id), version, fechas || []);
    if (result.conflict) {
      return reply.code(409).send({
        statusCode: 409,
        error: 'Conflicto',
        message: 'Los datos de disponibilidad cambiaron en otro dispositivo. Recarga e intenta de nuevo.',
      });
    }
    await logAudit(req, {
      accion: 'EDITAR',
      entidad: 'PILOTO',
      entidadId: id,
      descripcion: `Disponibilidad del piloto #${id} guardada (${fechas.length} fechas)`,
    });
    return reply.send(result);
  }

  async sugerirPiloto(req: FastifyRequest<{ Body: { fechaHora: string; pesoPasajero?: number; pasajeroId?: number } }>, reply: FastifyReply) {
    const { fechaHora, pesoPasajero, pasajeroId } = req.body;
    if (!fechaHora) {
      return reply.code(400).send({ error: 'El campo fechaHora es obligatorio' });
    }
    const resultado = await pilotosService.sugerirPiloto({ fechaHora, pesoPasajero, pasajeroId });
    return reply.send(resultado);
  }

  async delete(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { id } = req.params;
    await pilotosService.delete(Number(id));
    await logAudit(req, {
      accion: 'ELIMINAR',
      entidad: 'PILOTO',
      entidadId: id,
      descripcion: `Piloto #${id} eliminado`,
    });
    return reply.send({ success: true, message: 'Piloto eliminado correctamente' });
  }
}

export const pilotosController = new PilotosController();
