import { FastifyRequest, FastifyReply } from 'fastify';
import { vuelosService } from '../services/vuelos.service';
import { logAudit } from '../services/auditoria.service';
import { CreateVueloPayloadSchema } from '@parapente/shared';

export class VuelosController {
  async getAll(req: FastifyRequest<{ Querystring: Record<string, string | undefined> }>, reply: FastifyReply) {
    const vuelos = await vuelosService.getAll(req.query);
    return reply.send(vuelos);
  }

  async create(req: FastifyRequest, reply: FastifyReply) {
    try {
      const data = CreateVueloPayloadSchema.parse(req.body);
      const nuevoVuelo = await vuelosService.create(data);
      await logAudit(req, {
        accion: 'CREAR',
        entidad: 'VUELO',
        entidadId: nuevoVuelo.id,
        descripcion: `Vuelo agendado: ${nuevoVuelo.pasajero?.nombre || 'Pasajero'} con piloto ${nuevoVuelo.piloto?.nombre || nuevoVuelo.pilotoId}`,
        detalles: JSON.stringify({ fechaHora: nuevoVuelo.fechaHora, valorPactado: nuevoVuelo.valorPactado }),
      });
      return reply.code(201).send(nuevoVuelo);
    } catch (error: any) {
      if (error.code === 'P2002') {
        return reply.code(400).send({ error: 'Conflicto de horario', message: 'El piloto ya tiene un vuelo asignado a esa misma hora.' });
      }
      if (error.message?.includes('cerrada contablemente')) {
        return reply.code(409).send({ error: 'Conflicto de inmutabilidad', message: error.message });
      }
      if (error.message?.includes('Límite de peso') || error.message?.includes('Conflicto de horario')) {
        return reply.code(400).send({ error: error.message, message: error.message });
      }
      throw error;
    }
  }

  async update(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    try {
      const { id } = req.params;
      const data = CreateVueloPayloadSchema.parse(req.body);
      const vueloActualizado = await vuelosService.update(Number(id), data);
      await logAudit(req, {
        accion: 'EDITAR',
        entidad: 'VUELO',
        entidadId: id,
        descripcion: `Vuelo #${id} modificado: ${vueloActualizado.pasajero?.nombre || 'Pasajero'} con piloto ${vueloActualizado.piloto?.nombre || vueloActualizado.pilotoId}`,
        detalles: JSON.stringify({ fechaHora: vueloActualizado.fechaHora, valorPactado: vueloActualizado.valorPactado }),
      });
      return reply.send(vueloActualizado);
    } catch (error: any) {
      if (error.code === 'P2002') {
        return reply.code(400).send({ error: 'Conflicto de horario', message: 'El piloto ya tiene un vuelo asignado a esa misma hora.' });
      }
      if (error.message?.includes('cerrada contablemente')) {
        return reply.code(409).send({ error: 'Conflicto de inmutabilidad', message: error.message });
      }
      if (error.message?.includes('Límite de peso') || error.message?.includes('Conflicto de horario')) {
        return reply.code(400).send({ error: error.message, message: error.message });
      }
      throw error;
    }
  }

  async autoAssign(req: FastifyRequest<{ Body: { fechaHora: string; pasajeros: { id: number; peso: number }[] } }>, reply: FastifyReply) {
    const { fechaHora, pasajeros } = req.body;
    const asignaciones = await vuelosService.autoAssign(fechaHora, pasajeros);
    await logAudit(req, {
      accion: 'ASIGNAR_VUELO',
      entidad: 'VUELO',
      descripcion: `Asignación automática de ${Object.keys(asignaciones).length} pilotos para ${fechaHora}`,
      detalles: JSON.stringify(asignaciones),
    });
    return reply.send({ asignaciones });
  }

  async agendarGrupo(req: FastifyRequest<{ Body: { reservaId: number; fechaHora: string; asignaciones?: Record<number, number>; valorPactadoPorPasajero?: number; version?: number } }>, reply: FastifyReply) {
    try {
      const vuelos = await vuelosService.agendarGrupo(req.body);
      await logAudit(req, {
        accion: 'ASIGNAR_VUELO',
        entidad: 'VUELO',
        entidadId: req.body.reservaId,
        descripcion: `Vuelos de grupo agendados para la reserva #${req.body.reservaId} (${vuelos.length} pasajeros)`,
      });
      return reply.code(201).send({ success: true, vuelos });
    } catch (error: any) {
      const isCerrada = error.message?.includes('cerrada contablemente');
      const status = isCerrada ? 409 : (error?.statusCode || 400);
      return reply.code(status).send({ error: status === 409 ? 'Conflicto de inmutabilidad' : 'Error al agendar grupo', message: error.message });
    }
  }

  async updateEstado(req: FastifyRequest<{ Params: { id: string }; Body: { estado: string; version?: number } }>, reply: FastifyReply) {
    const { id } = req.params;
    const { estado, version } = req.body;
    try {
      const vueloActualizado = await vuelosService.updateEstado(Number(id), estado, version);
      await logAudit(req, {
        accion: 'CAMBIAR_ESTADO',
        entidad: 'VUELO',
        entidadId: id,
        descripcion: `Estado del vuelo #${id} cambiado a ${estado}`,
      });
      return reply.send(vueloActualizado);
    } catch (error: any) {
      const msg = String(error?.message ?? '');
      if (msg.includes('cambió en otro dispositivo') || msg.includes('cerrada contablemente')) {
        return reply.code(409).send({ error: 'Conflicto', message: msg });
      }
      if (msg.includes('Transición inválida') || msg.includes('no encontrado')) {
        return reply.code(400).send({ error: 'Bad Request', message: msg });
      }
      throw error;
    }
  }

  async delete(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { id } = req.params;
    try {
      await vuelosService.delete(Number(id));
      await logAudit(req, {
        accion: 'ELIMINAR',
        entidad: 'VUELO',
        entidadId: id,
        descripcion: `Vuelo #${id} cancelado/eliminado`,
      });
      return reply.send({ success: true, message: 'Vuelo eliminado correctamente' });
    } catch (error: any) {
      const msg = String(error?.message ?? '');
      if (msg.includes('cerrada contablemente')) {
        return reply.code(409).send({ error: 'Conflicto de inmutabilidad', message: msg });
      }
      if (msg.includes('no encontrado')) {
        return reply.code(404).send({ error: 'Not Found', message: msg });
      }
      throw error;
    }
  }
}

export const vuelosController = new VuelosController();
