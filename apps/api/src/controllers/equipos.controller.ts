import { FastifyRequest, FastifyReply } from 'fastify';
import { equiposService } from '../services/equipos.service';
import { logAudit } from '../services/auditoria.service';
import { CreateEquipoPayloadSchema, CreateMantenimientoPayloadSchema } from '@parapente/shared';

export class EquiposController {
  async getAll(req: FastifyRequest<{ Querystring: Record<string, string | undefined> }>, reply: FastifyReply) {
    const equipos = await equiposService.getAll(req.query || {});
    return reply.send(equipos);
  }

  async getById(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { id } = req.params;
    const equipo = await equiposService.getById(Number(id));
    if (!equipo) {
      return reply.code(404).send({ error: 'Not Found', message: 'Equipo no encontrado' });
    }
    return reply.send(equipo);
  }

  async create(req: FastifyRequest, reply: FastifyReply) {
    try {
      const data = CreateEquipoPayloadSchema.parse(req.body);
      const nuevoEquipo = await equiposService.create(data);
      await logAudit(req, {
        accion: 'CREAR',
        entidad: 'EQUIPO',
        entidadId: nuevoEquipo.id,
        descripcion: `Equipo ${nuevoEquipo.nombre} (${nuevoEquipo.codigo}) registrado`,
      });
      return reply.code(201).send(nuevoEquipo);
    } catch (error: any) {
      if (error.code === 'P2002') {
        return reply.code(400).send({ error: 'Código duplicado', message: 'Ya existe un equipo con ese código' });
      }
      throw error;
    }
  }

  async update(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    try {
      const { id } = req.params;
      const data = CreateEquipoPayloadSchema.parse(req.body);
      const equipoActualizado = await equiposService.update(Number(id), data);
      await logAudit(req, {
        accion: 'EDITAR',
        entidad: 'EQUIPO',
        entidadId: id,
        descripcion: `Equipo #${id} modificado${equipoActualizado?.nombre ? ` (${equipoActualizado.nombre})` : ''}`,
      });
      return reply.send(equipoActualizado);
    } catch (error: any) {
      if (error.code === 'P2002') {
        return reply.code(400).send({ error: 'Código duplicado', message: 'Ya existe un equipo con ese código' });
      }
      throw error;
    }
  }

  async delete(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { id } = req.params;
    await equiposService.delete(Number(id));
    await logAudit(req, {
      accion: 'ELIMINAR',
      entidad: 'EQUIPO',
      entidadId: id,
      descripcion: `Equipo #${id} eliminado`,
    });
    return reply.send({ success: true, message: 'Equipo eliminado correctamente' });
  }

  async addMantenimiento(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { id } = req.params;
    const data = CreateMantenimientoPayloadSchema.parse(req.body);
    const mantenimiento = await equiposService.addMantenimiento(Number(id), data);
    await logAudit(req, {
      accion: 'MANTENIMIENTO',
      entidad: 'EQUIPO',
      entidadId: id,
      descripcion: `Registro de mantenimiento agregado al equipo #${id}`,
      detalles: JSON.stringify({ tipo: data.tipo, fecha: data.fecha, costo: data.costo ?? null }),
    });
    return reply.code(201).send(mantenimiento);
  }

  async deleteMantenimiento(req: FastifyRequest<{ Params: { id: string; mantenimientoId: string } }>, reply: FastifyReply) {
    const { id, mantenimientoId } = req.params;
    await equiposService.deleteMantenimiento(Number(mantenimientoId));
    await logAudit(req, {
      accion: 'ELIMINAR',
      entidad: 'EQUIPO',
      entidadId: id,
      descripcion: `Registro de mantenimiento #${mantenimientoId} eliminado del equipo #${id}`,
    });
    return reply.send({ success: true, message: 'Registro de mantenimiento eliminado' });
  }
}

export const equiposController = new EquiposController();
