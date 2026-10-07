import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { pasajerosService } from '../services/pasajeros.service';
import { logAudit } from '../services/auditoria.service';
import { PasajeroSchema, FirmaDeslindePayloadSchema } from '@parapente/shared';

export class PasajerosController {
  async getAll(req: FastifyRequest<{ Querystring: Record<string, string | undefined> }>, reply: FastifyReply) {
    const pasajeros = await pasajerosService.getAll(req.query || {});
    return reply.send(pasajeros);
  }

  async getById(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { id } = req.params;
    const pasajero = await pasajerosService.getById(Number(id));
    if (!pasajero) {
      return reply.status(404).send({ statusCode: 404, message: 'Pasajero no encontrado' });
    }
    return reply.send(pasajero);
  }

  async create(req: FastifyRequest, reply: FastifyReply) {
    const data = PasajeroSchema.parse(req.body);
    const nuevoPasajero = await pasajerosService.create(data);
    await logAudit(req, {
      accion: 'CREAR',
      entidad: 'PASAJERO',
      entidadId: nuevoPasajero.id,
      descripcion: `Pasajero #${nuevoPasajero.id} creado (${nuevoPasajero.nombre})`,
    });
    return reply.code(201).send(nuevoPasajero);
  }

  async update(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { id } = req.params;
    const data = PasajeroSchema.partial().parse(req.body);
    const pasajeroActualizado = await pasajerosService.update(Number(id), data);
    await logAudit(req, {
      accion: 'EDITAR',
      entidad: 'PASAJERO',
      entidadId: id,
      descripcion: `Pasajero #${id} modificado${pasajeroActualizado?.nombre ? ` (${pasajeroActualizado.nombre})` : ''}`,
    });
    return reply.send(pasajeroActualizado);
  }

  async guardarFirma(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { id } = req.params;
    try {
      const data = FirmaDeslindePayloadSchema.parse(req.body);
      const pasajeroActualizado = await pasajerosService.guardarFirma(Number(id), data);
      await logAudit(req, {
        accion: 'EDITAR',
        entidad: 'PASAJERO',
        entidadId: id,
        descripcion: `Firma de deslinde guardada para el pasajero #${id}`,
      });
      return reply.send(pasajeroActualizado);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Payload inválido', detalles: error.flatten() });
      }
      const msg = String(error?.message ?? '').toLowerCase();
      if (msg.includes('no encontrada') || msg.includes('no encontrado')) {
        return reply.status(404).send({ error: error.message });
      }
      if (msg.includes('cancelada') || msg.includes('cerrada') || msg.includes('no se puede')) {
        return reply.status(400).send({ error: error.message });
      }
      if (msg.includes('otro dispositivo') || msg.includes('versión')) {
        return reply.status(409).send({ error: error.message });
      }
      return reply.status(500).send({ error: error?.message || 'Error al guardar firma' });
    }
  }

  async delete(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { id } = req.params;
    await pasajerosService.delete(Number(id));
    await logAudit(req, {
      accion: 'ELIMINAR',
      entidad: 'PASAJERO',
      entidadId: id,
      descripcion: `Pasajero #${id} eliminado`,
    });
    return reply.send({ success: true, message: 'Pasajero eliminado correctamente' });
  }
}

export const pasajerosController = new PasajerosController();
