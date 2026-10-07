import { FastifyRequest, FastifyReply } from 'fastify';
import { reservasService } from '../services/reservas.service';
import { logAudit } from '../services/auditoria.service';
import { ConflictError } from '../services/concurrencia.service';
import { CreateReservaPayloadSchema, UpdateReservaPayloadSchema, CreatePagoPayloadSchema, CreateDevolucionPayloadSchema, ActualizarEstadoPasajerosPayloadSchema, CancelarReservaPayloadSchema } from '@parapente/shared';
import { z } from 'zod';

export class ReservasController {
  async getAll(req: FastifyRequest<{ Querystring: Record<string, string | undefined> }>, reply: FastifyReply) {
    const reservas = await reservasService.getAll(req.query);
    return reply.send(reservas);
  }

  async getById(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { id } = req.params;
    const reserva = await reservasService.getById(Number(id));
    if (!reserva) {
      return reply.code(404).send({ error: 'Reserva no encontrada' });
    }
    return reply.send(reserva);
  }

  async create(req: FastifyRequest, reply: FastifyReply) {
    const data = CreateReservaPayloadSchema.parse(req.body);
    const nuevaReserva = await reservasService.create(data);
    await logAudit(req, {
      accion: 'CREAR',
      entidad: 'RESERVA',
      entidadId: nuevaReserva.id,
      descripcion: `Reserva ${nuevaReserva.numeroReserva} creada: ${nuevaReserva.nombreTitular}`,
      detalles: JSON.stringify({ valorTotal: nuevaReserva.valorTotal, abono: nuevaReserva.abono, estadoPago: nuevaReserva.estadoPago }),
    });
    return reply.code(201).send(nuevaReserva);
  }

  async update(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { id } = req.params;
    // Punto 3: los importes derivados no se aceptan en la edición. Rechazo explícito
    // (400) en vez de silenciarlos para que un cliente desalineado no "guarde" un
    // abono que el servidor ignora. El abono cambia solo vía pagos/devoluciones.
    const cuerpo = req.body as Record<string, unknown> | null;
    if (cuerpo && typeof cuerpo === 'object' && ('abono' in cuerpo || 'montoDevuelto' in cuerpo)) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'El abono y el monto devuelto no se editan directamente: se derivan de los pagos y devoluciones registrados.',
      });
    }
    const data = UpdateReservaPayloadSchema.parse(req.body);
    try {
      const reservaActualizada = await reservasService.update(Number(id), data);
      await logAudit(req, {
        accion: 'EDITAR',
        entidad: 'RESERVA',
        entidadId: id,
        descripcion: `Reserva #${id} modificada${reservaActualizada?.nombreTitular ? ` (${reservaActualizada.nombreTitular})` : ''}`,
      });
      return reply.send(reservaActualizada);
    } catch (error: any) {
      const msg = String(error?.message ?? '').toLowerCase();
      if (msg.includes('cambió en otro dispositivo') || msg.includes('cerrada contablemente')) {
        return reply.code(409).send({ error: 'Conflicto', message: String(error.message) });
      }
      if (
        msg.includes('no se puede editar') ||
        msg.includes('se deriva automáticamente') ||
        msg.includes('no encontrada')
      ) {
        const code = msg.includes('no encontrada') ? 404 : 400;
        return reply.code(code).send({ error: code === 404 ? 'Not Found' : 'Bad Request', message: String(error.message) });
      }
      throw error;
    }
  }

  async desagendar(req: FastifyRequest<{ Params: { id: string }; Body: { version?: number } }>, reply: FastifyReply) {
    const { id } = req.params;
    try {
      const rawVersion = (req.body as any)?.version;
      const version = rawVersion !== undefined && rawVersion !== null ? Number(rawVersion) : undefined;
      const reservaDesagendada = await reservasService.desagendar(Number(id), { version });
      await logAudit(req, {
        accion: 'DESAGENDAR',
        entidad: 'RESERVA',
        entidadId: id,
        descripcion: `Reserva #${id} desagendada (vuelve a SIN_AGENDAR)`,
      });
      return reply.send(reservaDesagendada);
    } catch (error: any) {
      const msg = String(error?.message ?? '').toLowerCase();
      if (msg.includes('cambió en otro dispositivo') || msg.includes('cerrada contablemente')) {
        return reply.code(409).send({ error: 'Conflicto', message: String(error.message) });
      }
      if (
        msg.includes('no se puede desagendar') ||
        msg.includes('ya se encuentra sin agendar') ||
        msg.includes('no encontrada')
      ) {
        const code = msg.includes('no encontrada') ? 404 : 400;
        return reply.code(code).send({ error: code === 404 ? 'Not Found' : 'Bad Request', message: String(error.message) });
      }
      throw error;
    }
  }

  async addPago(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { id } = req.params;
    try {
      const raw = req.body as any;
      const data = CreatePagoPayloadSchema.parse(req.body);
      const version = raw?.version !== undefined ? Number(raw.version) : undefined;
      const reservaActualizada = await reservasService.addPago(Number(id), { ...data, version } as any);
      await logAudit(req, {
        accion: 'REGISTRAR_PAGO',
        entidad: 'PAGO',
        entidadId: id,
        descripcion: `Abono de $${data.monto} CLP registrado en la reserva #${id}`,
        detalles: JSON.stringify({ metodoPago: data.metodoPago, fecha: data.fecha || new Date().toISOString() }),
      });
      return reply.code(201).send(reservaActualizada);
    } catch (error: any) {
      const msg = String(error?.message ?? '').toLowerCase();
      if (error instanceof ConflictError || error?.statusCode === 409 || msg.includes('cambió en otro dispositivo') || msg.includes('cerrada contablemente')) {
        return reply.code(409).send({ error: 'Conflicto', message: String(error.message) });
      }
      if (msg.includes('cancelada')) {
        return reply.code(400).send({ error: 'Bad Request', message: String(error.message) });
      }
      if (msg.includes('no encontrada')) {
        return reply.code(404).send({ error: 'Not Found', message: String(error.message) });
      }
      throw error;
    }
  }

  async deletePago(req: FastifyRequest<{ Params: { id: string; pagoId: string }, Querystring: { version?: string } }>, reply: FastifyReply) {
    const { id, pagoId } = req.params;
    const version = req.query.version !== undefined ? Number(req.query.version) : undefined;
    try {
      const reservaActualizada = await reservasService.deletePago(Number(id), Number(pagoId), version);
      await logAudit(req, {
        accion: 'ANULAR_PAGO',
        entidad: 'PAGO',
        entidadId: pagoId,
        descripcion: `Pago #${pagoId} anulado de la reserva #${id}`,
      });
      return reply.send(reservaActualizada);
    } catch (error: any) {
      const msg = String(error?.message ?? '').toLowerCase();
      if (error instanceof ConflictError || error?.statusCode === 409 || msg.includes('cambió en otro dispositivo') || msg.includes('cerrada contablemente')) {
        return reply.code(409).send({ error: 'Conflicto', message: String(error.message) });
      }
      if (msg.includes('no se puede anular')) {
        return reply.code(400).send({ error: 'Bad Request', message: String(error.message) });
      }
      if (msg.includes('no encontrada')) {
        return reply.code(404).send({ error: 'Not Found', message: String(error.message) });
      }
      throw error;
    }
  }

  /**
   * Fase 2 (ciclo de vida): registra una devolución en una reserva CANCELADA o
   * INCOMPLETA. Payload validado por `CreateDevolucionPayloadSchema` (Zod, 400).
   * Concurrencia optimista con la `version` de la reserva: 409 si stale.
   */
  async addDevolucion(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { id } = req.params;
    try {
      const raw = req.body as any;
      const data = CreateDevolucionPayloadSchema.parse(req.body);
      const version = raw?.version !== undefined ? Number(raw.version) : undefined;
      const reservaActualizada = await reservasService.addDevolucion(Number(id), { ...data, version } as any);
      await logAudit(req, {
        accion: 'REGISTRAR_DEVOLUCION',
        entidad: 'DEVOLUCION',
        entidadId: id,
        descripcion: `Devolución de $${data.monto} CLP registrada en la reserva #${id}`,
        detalles: JSON.stringify({ metodoPago: data.metodoPago, fecha: data.fecha || new Date().toISOString() }),
      });
      return reply.code(201).send(reservaActualizada);
    } catch (error: any) {
      const msg = String(error?.message ?? '').toLowerCase();
      if (msg.includes('cambió en otro dispositivo')) {
        return reply.code(409).send({ error: 'Conflicto de concurrencia', message: String(error.message) });
      }
      if (
        msg.includes('no se puede') ||
        msg.includes('no se permiten') ||
        msg.includes('cerrada') ||
        msg.includes('canceladas') ||
        msg.includes('más de lo pagado')
      ) {
        return reply.code(400).send({ error: 'Bad Request', message: String(error.message) });
      }
      if (msg.includes('no encontrada')) {
        return reply.code(404).send({ error: 'Not Found', message: String(error.message) });
      }
      throw error;
    }
  }

  /**
   * Fase 2 (ciclo de vida): anula (soft-delete) una devolución y recalcula
   * `montoDevuelto`/`estadoPago`. `version` llega por query (como en eliminarPago).
   */
  async deleteDevolucion(req: FastifyRequest<{ Params: { id: string; devolucionId: string }, Querystring: { version?: string } }>, reply: FastifyReply) {
    const { id, devolucionId } = req.params;
    const version = req.query.version !== undefined ? Number(req.query.version) : undefined;
    try {
      const reservaActualizada = await reservasService.deleteDevolucion(Number(id), Number(devolucionId), version);
      await logAudit(req, {
        accion: 'ANULAR_DEVOLUCION',
        entidad: 'DEVOLUCION',
        entidadId: devolucionId,
        descripcion: `Devolución #${devolucionId} anulada de la reserva #${id}`,
      });
      return reply.send(reservaActualizada);
    } catch (error: any) {
      const msg = String(error?.message ?? '').toLowerCase();
      if (msg.includes('cambió en otro dispositivo')) {
        return reply.code(409).send({ error: 'Conflicto de concurrencia', message: String(error.message) });
      }
      if (
        msg.includes('cerrada') ||
        msg.includes('no se pueden') ||
        msg.includes('no se puede')
      ) {
        return reply.code(400).send({ error: 'Bad Request', message: String(error.message) });
      }
      if (msg.includes('no encontrada')) {
        return reply.code(404).send({ error: 'Not Found', message: String(error.message) });
      }
      throw error;
    }
  }

  /**
   * Marca el estado de vuelo de los pasajeros de una reserva (modal de pagos).
   * - Payload validado por `ActualizarEstadoPasajerosPayloadSchema` (Zod, 400).
   * - Concurrencia optimista con la `version` de la reserva: 409 si stale.
   * - 404 si la reserva no existe; 400 si algún pasajero no pertenece a ella
   *   o la reserva ya está CANCELADA/COMPLETADA.
   */
  async actualizarEstadoPasajeros(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { id } = req.params;
    const data = ActualizarEstadoPasajerosPayloadSchema.parse(req.body);

    try {
      const reservaActualizada = await reservasService.actualizarEstadoPasajeros(Number(id), data);
      await logAudit(req, {
        accion: 'ACTUALIZAR_ESTADO_PASAJEROS',
        entidad: 'RESERVA',
        entidadId: id,
        descripcion: `Estados de vuelo actualizados en la reserva #${id}`,
        detalles: JSON.stringify(data.pasajeros),
      });
      return reply.send(reservaActualizada);
    } catch (error: any) {
      const msg = String(error?.message ?? '').toLowerCase();
      if (msg.includes('cambió en otro dispositivo') || msg.includes('cerrada contablemente')) {
        return reply.code(409).send({ error: 'Conflicto', message: String(error.message) });
      }
      if (msg.includes('no pertenecen a la reserva') || msg.includes('cancelada o completada') || msg.includes('no se puede completar') || msg.includes('historial de pagos')) {
        return reply.code(400).send({ error: 'Bad Request', message: String(error.message) });
      }
      if (msg.includes('no encontrada')) {
        return reply.code(404).send({ error: 'Not Found', message: String(error.message) });
      }
      throw error;
    }
  }

  async cancelar(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { id } = req.params;
    try {
      const data = CancelarReservaPayloadSchema.parse(req.body);

      const reservaCancelada = await reservasService.cancelar(Number(id), data);

      await logAudit(req, {
        accion: 'CANCELAR_RESERVA',
        entidad: 'RESERVA',
        entidadId: id,
        descripcion: `Reserva #${id} cancelada${reservaCancelada?.nombreTitular ? ` (${reservaCancelada.nombreTitular})` : ''}${data.devolucion ? ` con devolución de $${data.devolucion.monto}` : ''}`,
        detalles: JSON.stringify({
          motivo: data.motivo,
          fechaCancelacion: new Date().toISOString(),
          devolucion: data.devolucion,
        }),
      });
      return reply.send(reservaCancelada);
    } catch (error: any) {
      const msg = String(error?.message ?? '').toLowerCase();
      if (msg.includes('cambió en otro dispositivo') || msg.includes('cerrada contablemente')) {
        return reply.code(409).send({ error: 'Conflicto', message: String(error.message) });
      }
      if (
        msg.includes('no encontrada') ||
        msg.includes('ya finalizada') ||
        msg.includes('obligatorio') ||
        msg.includes('se deriva automáticamente') ||
        msg.includes('no se puede devolver')
      ) {
        return reply.code(400).send({ error: 'Bad Request', message: String(error.message) });
      }
      throw error;
    }
  }

  async delete(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { id } = req.params;
    try {
      await reservasService.delete(Number(id));
      await logAudit(req, {
        accion: 'ELIMINAR',
        entidad: 'RESERVA',
        entidadId: id,
        descripcion: `Reserva #${id} eliminada junto a sus pasajeros y vuelos asociados`,
      });
      return reply.send({ message: 'Reserva y vuelos asociados eliminados con éxito' });
    } catch (error: any) {
      const msg = String(error?.message ?? '').toLowerCase();
      if (msg.includes('cerrada contablemente')) {
        return reply.code(409).send({ error: 'Conflicto', message: String(error.message) });
      }
      if (msg.includes('no se puede eliminar')) {
        return reply.code(400).send({ error: 'Bad Request', message: String(error.message) });
      }
      if (msg.includes('no encontrada')) {
        return reply.code(404).send({ error: 'Not Found', message: String(error.message) });
      }
      throw error;
    }
  }

  async cerrarContable(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    try {
      const version = (req.body as any)?.version !== undefined ? Number((req.body as any).version) : undefined;
      const reservaCerrada = await reservasService.cerrarContable(Number(id), version);
      await logAudit(req, {
        accion: 'CERRAR_CONTABLE',
        entidad: 'RESERVA',
        entidadId: id,
        descripcion: `Reserva #${id} sellada y congelada con snapshot inmutable`,
      });
      return reply.send(reservaCerrada);
    } catch (error: any) {
      const msg = String(error?.message ?? '');
      if (error instanceof ConflictError || error?.statusCode === 409 || msg.toLowerCase().includes('cambi')) {
        return reply.code(409).send({ error: 'Conflicto de concurrencia', message: msg });
      }
      if (msg.includes('no encontrada')) {
        return reply.code(404).send({ error: 'Not Found', message: msg });
      }
      return reply.code(400).send({ error: 'Bad Request', message: msg });
    }
  }

  async reabrirContable(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    try {
      const { motivo, version } = (req.body as any) || {};
      const versionNum = version !== undefined && version !== null ? Number(version) : undefined;
      const reservaReabierta = await reservasService.reabrirContable(Number(id), motivo, versionNum);
      await logAudit(req, {
        accion: 'REABRIR_CONTABLE',
        entidad: 'RESERVA',
        entidadId: id,
        descripcion: `Reserva #${id} reabierta por administración: ${motivo}`,
        detalles: JSON.stringify({ motivo }),
      });
      return reply.send(reservaReabierta);
    } catch (error: any) {
      const msg = String(error?.message ?? '');
      if (error instanceof ConflictError || error?.statusCode === 409 || msg.toLowerCase().includes('cambi')) {
        return reply.code(409).send({ error: 'Conflicto de concurrencia', message: msg });
      }
      if (msg.includes('no encontrada')) {
        return reply.code(404).send({ error: 'Not Found', message: msg });
      }
      return reply.code(400).send({ error: 'Bad Request', message: msg });
    }
  }
}

export const reservasController = new ReservasController();
