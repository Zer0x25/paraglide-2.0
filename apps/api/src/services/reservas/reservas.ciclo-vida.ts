import { prisma } from '../../plugins/prisma';
import { Prisma } from '@prisma/client';
import { EstadoPasajero, derivarEstadoReservaPorPasajeros, derivarEstadoPago, CancelarReservaPayload } from '@parapente/shared';
import { checkVersion } from '../concurrencia.service';
import { broadcastDatos } from '../eventos.service';
import { toNum } from '../money.util';
import { googleCalendarService } from '../google-calendar.service';

/**
 * Estado de vuelo por pasajero (modal de pagos): marca quién voló.
 * - Campo independiente y editable (no se deriva del vuelo).
 * - Concurrencia optimista con la `version` de la reserva (ADR 004): 409 si stale.
 * - Valida que todos los pasajeros pertenezcan a la reserva (400 si no).
 */
export async function actualizarEstadoPasajerosReserva(
  reservaId: number,
  data: { version?: number; pasajeros: { id: number; estado: EstadoPasajero }[] }
) {
  const reservaActualizada = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Lock atómico (patrón cancelar/cerrar): serializa mutaciones concurrentes y
    // garantiza que el checkVersion de abajo re-lea la versión ya committeada
    // (sin lock, dos transacciones pasaban el check y la segunda pisaba sin 409).
    if (typeof (tx as any).$queryRaw === 'function') {
      await (tx as any).$queryRaw`SELECT id FROM "Reserva" WHERE id = ${reservaId} FOR UPDATE`;
    }
    // findFirst con deletedAt: null (el plugin soft-delete no cubre tx clients, ADR 006)
    const reserva = await tx.reserva.findFirst({
      where: { id: reservaId, deletedAt: null },
    });
    if (!reserva) {
      throw new Error('Reserva no encontrada');
    }
    if (reserva.cerradaAt) {
      throw new Error('No se pueden modificar los pasajeros de una reserva cerrada contablemente');
    }
    // Mismo guard de ciclo de vida que cancelar(): no se marcan vuelos de
    // reservas finalizadas (evita reportes/manifiestos inconsistentes).
    if (reserva.estado === 'CANCELADA' || reserva.estado === 'COMPLETADA') {
      throw new Error('No se puede marcar el estado de vuelo de una reserva cancelada o completada');
    }
    checkVersion(reserva.version, data.version, 'La reserva cambió en otro dispositivo. Recarga e intenta de nuevo.');

    // Validación de pertenencia: todos los pasajeros deben ser de esta reserva
    // y no estar soft-deleted.
    const ids = data.pasajeros.map((p) => p.id);
    const encontrados = await tx.pasajero.findMany({
      where: { id: { in: ids }, reservaId, deletedAt: null },
      select: { id: true },
    });
    if (encontrados.length !== ids.length) {
      throw new Error('Uno o más pasajeros no pertenecen a la reserva');
    }

    for (const p of data.pasajeros) {
      await tx.pasajero.update({
        where: { id: p.id },
        data: { estado: p.estado },
      });
    }

    // Sincronizar estado de los vuelos según los estados de pasajero asignados
    if (tx.vuelo?.updateMany) {
      const completedPaxIds = data.pasajeros.filter((p) => p.estado === 'VUELO_COMPLETADO').map((p) => p.id);
      if (completedPaxIds.length > 0) {
        await tx.vuelo.updateMany({
          where: {
            pasajeroId: { in: completedPaxIds },
            deletedAt: null,
            estado: { not: 'CANCELADO' },
          },
          data: {
            estado: 'COMPLETADO',
            version: { increment: 1 },
          },
        });
      }

      const cancelledPaxIds = data.pasajeros.filter((p) => p.estado === 'CANCELADO').map((p) => p.id);
      if (cancelledPaxIds.length > 0) {
        await tx.vuelo.updateMany({
          where: {
            pasajeroId: { in: cancelledPaxIds },
            deletedAt: null,
            estado: { not: 'COMPLETADO' },
          },
          data: {
            estado: 'CANCELADO',
            version: { increment: 1 },
          },
        });
      }
    }

    const estadosFinales = await tx.pasajero.findMany({
      where: { reservaId, deletedAt: null },
      select: { estado: true },
    });
    const todosVolaron = estadosFinales.length > 0 && estadosFinales.every((p) => p.estado === 'VUELO_COMPLETADO');

    if (todosVolaron) {
      const valorTotal = toNum(reserva.valorTotal);
      if (valorTotal > 0) {
        const [pagoStats, countPagos] = await Promise.all([
          tx.pago.aggregate({
            _sum: { monto: true },
            where: { reservaId, deletedAt: null },
          }),
          tx.pago.count({
            where: { reservaId, deletedAt: null },
          }),
        ]);
        const totalPagado = toNum(pagoStats._sum.monto);
        const saldo = valorTotal - totalPagado;

        if (countPagos === 0 || saldo > 0) {
          throw new Error('No se puede completar la reserva: el saldo debe ser $0 y debe existir respaldo en el historial de pagos');
        }
      }
    }

    const estadoDerivado = derivarEstadoReservaPorPasajeros(
      estadosFinales.map((p) => p.estado as EstadoPasajero),
      reserva.estadoPago as any,
      toNum(reserva.valorTotal)
    );
    const estadoReservaFinal =
      estadoDerivado !== null && estadoDerivado !== reserva.estado ? estadoDerivado : undefined;

    // Si la reserva transiciona a COMPLETADA, garantizar que todos sus vuelos activos queden COMPLETADO
    if (estadoReservaFinal === 'COMPLETADA' && tx.vuelo?.updateMany) {
      await tx.vuelo.updateMany({
        where: {
          reservaId,
          deletedAt: null,
          estado: { not: 'CANCELADO' },
        },
        data: {
          estado: 'COMPLETADO',
          version: { increment: 1 },
        },
      });
    }

    return tx.reserva.update({
      where: { id: reservaId },
      data: {
        ...(estadoReservaFinal !== undefined && { estado: estadoReservaFinal as any }),
        version: { increment: 1 },
      },
      include: {
        pasajeros: { where: { deletedAt: null } },
        pagos: { where: { deletedAt: null }, orderBy: { fecha: 'desc' } },
        devoluciones: { where: { deletedAt: null }, orderBy: { fecha: 'desc' } },
      },
    });
  });

  // Post-commit: emitir SSE para actualizar calendario y listado de reservas
  broadcastDatos('vuelo', 'actualizar');
  broadcastDatos('reserva', 'actualizar');

  return reservaActualizada;
}

/**
 * Cancelación formal de la reserva (ciclo de vida).
 * - Soft-delete de los vuelos activos de sus pasajeros (previamente marcados CANCELADO).
 * - La reserva pasa a CANCELADA con motivo y fecha; `version` incrementa.
 * - Soporta devolución atómica unificada si viene data.devolucion.
 * - Concurrencia optimista vía checkVersion (409 si stale).
 */
export async function cancelarReserva(id: number, data: CancelarReservaPayload) {
  const reservaCancelada = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    if (typeof (tx as any).$queryRaw === 'function') {
      await (tx as any).$queryRaw`SELECT id FROM "Reserva" WHERE id = ${id} FOR UPDATE`;
    }
    // findFirst con deletedAt: null (el plugin soft-delete no cubre tx clients)
    const reserva = await tx.reserva.findFirst({
      where: { id, deletedAt: null },
      include: {
        pasajeros: {
          where: { deletedAt: null },
          select: { id: true },
        },
      },
    });
    if (!reserva) throw new Error('Reserva no encontrada');
    if (reserva.cerradaAt) {
      throw new Error('No se puede cancelar una reserva cerrada contablemente');
    }
    if (reserva.estado === 'CANCELADA' || reserva.estado === 'COMPLETADA') {
      throw new Error('Reserva ya finalizada');
    }
    checkVersion(reserva.version, data.version, 'La reserva cambió en otro dispositivo. Recarga e intenta de nuevo.');

    const pasajeroIds = reserva.pasajeros.map((p) => p.id);

    // 1) Cancelar vuelos activos NO completados (los completados son historial
    // real: ocurrieron y alimentan pagoPiloto/reportes) y 2) soft-delete atómico
    await tx.vuelo.updateMany({
      where: { reservaId: id, deletedAt: null, estado: { not: 'COMPLETADO' } },
      data: { estado: 'CANCELADO', deletedAt: new Date(), version: { increment: 1 } },
    });

    // 2) Cancelar pasajeros que no hayan completado vuelo
    if (pasajeroIds.length > 0 && typeof (tx.pasajero as any)?.updateMany === 'function') {
      await tx.pasajero.updateMany({
        where: { id: { in: pasajeroIds }, deletedAt: null, estado: { not: 'VUELO_COMPLETADO' } },
        data: { estado: 'CANCELADO' },
      });
    }

    // 3) Si se solicitó devolución atómica integrada
    let nuevoDevuelto = toNum(reserva.montoDevuelto);
    let finalEstadoPago = reserva.estadoPago;

    if (data.devolucion && toNum(data.devolucion.monto) > 0) {
      const montoADevolver = toNum(data.devolucion.monto);
      const devolucionesStats = await tx.devolucion.aggregate({
        _sum: { monto: true },
        where: { reservaId: id, deletedAt: null },
      });
      // Tope real: contra la suma de pagos activos (el `abono` denormalizado
      // puede estar desfasado).
      const pagosStats = await tx.pago.aggregate({
        _sum: { monto: true },
        where: { reservaId: id, deletedAt: null },
      });
      const totalPagado = toNum(pagosStats._sum.monto);
      const devueltoPrevio = toNum(devolucionesStats._sum.monto);
      if (devueltoPrevio + montoADevolver > totalPagado) {
        throw new Error('No se puede devolver más de lo pagado');
      }

      await tx.devolucion.create({
        data: {
          reservaId: id,
          monto: data.devolucion.monto,
          metodoPago: data.devolucion.metodoPago || 'TRANSFERENCIA',
          fecha: new Date(),
          comprobante: data.devolucion.comprobante,
          notas: data.devolucion.notas || `Devolución al cancelar: ${data.motivo}`,
        },
      });

      nuevoDevuelto = devueltoPrevio + montoADevolver;
      finalEstadoPago = derivarEstadoPago(toNum(reserva.valorTotal), totalPagado, nuevoDevuelto);
    }

    return tx.reserva.update({
      where: { id },
      data: {
        estado: 'CANCELADA',
        motivoCancelacion: data.motivo,
        fechaCancelacion: new Date(),
        montoDevuelto: nuevoDevuelto,
        estadoPago: finalEstadoPago as any,
        version: { increment: 1 },
      },
      include: {
        pasajeros: { where: { deletedAt: null } },
        pagos: { where: { deletedAt: null }, orderBy: { fecha: 'desc' } },
        devoluciones: { where: { deletedAt: null }, orderBy: { fecha: 'desc' } },
      },
    });
  });

  // El plugin de broadcast solo emite la entidad de la ruta ('reserva');
  // los calendarios de otros clientes también deben invalidar sus vuelos.
  broadcastDatos('vuelo', 'actualizar');

  // Sincronización en tiempo real con Google Calendar (eliminar eventos de la reserva cancelada)
  googleCalendarService.syncReservaVuelosDeleted(id).catch((err) => {
    console.warn('[GoogleCalendar] Error sincronizando cancelación de reserva:', err);
  });

  return reservaCancelada;
}

export async function deleteReserva(id: number) {
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const reserva = await tx.reserva.findFirst({
      where: { id, deletedAt: null },
    });
    if (!reserva) throw new Error('Reserva no encontrada');
    if (reserva.cerradaAt) {
      throw new Error('No se puede eliminar una reserva cerrada contablemente');
    }
    if (reserva.estado === 'CANCELADA' || reserva.estado === 'COMPLETADA') {
      throw new Error('No se puede eliminar una reserva completada o cancelada');
    }
    // Regla de negocio: solo se puede eliminar si no hay dinero retenido.
    // PENDIENTE (sin abono) o DEVUELTO (todo lo cobrado fue devuelto) → permitido.
    // ABONADO / PAGADO → bloqueado (exige devolución previa).
    if (reserva.estadoPago === 'PAGADO' || reserva.estadoPago === 'ABONADO') {
      throw new Error('No se puede eliminar una reserva con pagos registrados. Registra una devolución antes');
    }

    // Libera calendario: soft-delete de todas las agendas/vuelos asociados
    await tx.vuelo.updateMany({
      where: { reservaId: id, deletedAt: null },
      data: { deletedAt: new Date() },
    });

    await tx.pasajero.updateMany({
      where: { reservaId: id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    await tx.pago.updateMany({
      where: { reservaId: id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    await tx.devolucion.updateMany({
      where: { reservaId: id, deletedAt: null },
      data: { deletedAt: new Date() },
    });

    await tx.reserva.update({
      where: { id },
      data: { deletedAt: new Date(), version: { increment: 1 } },
    });
  });

  // Notifica a todos los clientes (calendario y listado)
  broadcastDatos('vuelo', 'actualizar');
  broadcastDatos('reserva', 'actualizar');

  // Sincronización en tiempo real con Google Calendar (eliminar eventos de la reserva borrada)
  googleCalendarService.syncReservaVuelosDeleted(id).catch((err) => {
    console.warn('[GoogleCalendar] Error sincronizando eliminación de reserva:', err);
  });
}

export async function desagendarReserva(
  id: number,
  data?: { version?: number }
) {
  const reservaDesagendada = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Lock atómico (patrón cancelar/cerrar): el checkVersion re-lee bajo lock.
    if (typeof (tx as any).$queryRaw === 'function') {
      await (tx as any).$queryRaw`SELECT id FROM "Reserva" WHERE id = ${id} FOR UPDATE`;
    }
    const reserva = await tx.reserva.findFirst({
      where: { id, deletedAt: null },
      include: {
        pasajeros: {
          where: { deletedAt: null },
          select: { id: true },
        },
      },
    });
    if (!reserva) throw new Error('Reserva no encontrada');
    if (reserva.cerradaAt) {
      throw new Error('No se puede desagendar una reserva cerrada contablemente');
    }
    if (reserva.estado === 'CANCELADA' || reserva.estado === 'COMPLETADA') {
      throw new Error('No se puede desagendar una reserva cancelada o completada');
    }
    if (reserva.estado === 'SIN_AGENDAR') {
      throw new Error('La reserva ya se encuentra sin agendar');
    }
    checkVersion(reserva.version, data?.version, 'La reserva cambió en otro dispositivo. Recarga e intenta de nuevo.');

    const pasajeroIds = reserva.pasajeros.map((p) => p.id);

    // 1) Soft-delete atómico de los vuelos activos no completados
    await tx.vuelo.updateMany({
      where: {
        reservaId: id,
        deletedAt: null,
        estado: { not: 'COMPLETADO' },
      },
      data: {
        deletedAt: new Date(),
        version: { increment: 1 },
      },
    });

    if (pasajeroIds.length > 0) {
      // Restablecer estados de pasajeros que estaban agendados pero no completados a POR_VOLAR
      await tx.pasajero.updateMany({
        where: {
          id: { in: pasajeroIds },
          deletedAt: null,
          estado: { not: 'VUELO_COMPLETADO' },
        },
        data: { estado: 'POR_VOLAR' },
      });
    }

    // 2) Pasar la reserva a SIN_AGENDAR
    return tx.reserva.update({
      where: { id },
      data: {
        estado: 'SIN_AGENDAR',
        fechaAgenda: null,
        horaAgenda: null,
        version: { increment: 1 },
      },
      include: {
        pasajeros: {
          where: { deletedAt: null },
          include: { vuelos: { where: { deletedAt: null } } },
        },
        pagos: { where: { deletedAt: null }, orderBy: { fecha: 'desc' } },
        devoluciones: { where: { deletedAt: null }, orderBy: { fecha: 'desc' } },
      },
    });
  });

  // Notificar clientes de vuelo y de reserva
  broadcastDatos('vuelo', 'actualizar');
  broadcastDatos('reserva', 'actualizar');

  // Sincronización en tiempo real con Google Calendar (eliminar eventos de la reserva desagendada)
  googleCalendarService.syncReservaVuelosDeleted(id).catch((err) => {
    console.warn('[GoogleCalendar] Error sincronizando desagendamiento de reserva:', err);
  });

  return reservaDesagendada;
}

/**
 * Cierre y congelamiento contable de la reserva (Fase 2 y 3: Inmutabilidad).
 * - Genera un snapshot inmutable de auditoría (totales, abonos, pagos, pasajeros).
 * - Sella la reserva con `cerradaAt = new Date()`.
 * - A partir de este momento, cualquier mutación operacional sobre la reserva
 *   o sus vuelos es rechazada por el servidor.
 */
export async function cerrarReservaContable(id: number, version?: number) {
  const reservaCerrada = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    if (typeof (tx as any).$queryRaw === 'function') {
      await (tx as any).$queryRaw`SELECT id FROM "Reserva" WHERE id = ${id} FOR UPDATE`;
    }
    const reserva = await tx.reserva.findFirst({
      where: { id, deletedAt: null },
      include: {
        pasajeros: { where: { deletedAt: null } },
        pagos: { where: { deletedAt: null }, orderBy: { fecha: 'asc' } },
        devoluciones: { where: { deletedAt: null }, orderBy: { fecha: 'asc' } },
        vuelos: { where: { deletedAt: null } },
      },
    });

    if (!reserva) throw new Error('Reserva no encontrada');
    checkVersion(reserva.version, version, 'La reserva cambió en otro dispositivo. Recarga e intenta de nuevo.');

    if (reserva.cerradaAt) {
      return reserva; // Ya se encuentra cerrada
    }

    if (reserva.estado !== 'COMPLETADA' && reserva.estado !== 'CANCELADA') {
      throw new Error('Solo se pueden cerrar contablemente reservas completadas o canceladas');
    }

    const snapshot = {
      fechaCierre: new Date().toISOString(),
      numeroReserva: reserva.numeroReserva,
      nombreTitular: reserva.nombreTitular,
      rutDniTitular: reserva.rutDniTitular,
      email: reserva.email,
      telefono: reserva.telefono,
      valorTotal: toNum(reserva.valorTotal),
      abono: toNum(reserva.abono),
      montoDevuelto: toNum(reserva.montoDevuelto),
      descuento: toNum(reserva.descuento),
      estado: reserva.estado,
      estadoPago: reserva.estadoPago,
      pasajeros: reserva.pasajeros.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        rutDni: p.rutDni,
        peso: p.peso,
        firmaDeslinde: p.firmaDeslinde,
        estado: p.estado,
      })),
      pagos: reserva.pagos.map((p) => ({
        id: p.id,
        monto: toNum(p.monto),
        metodoPago: p.metodoPago,
        fecha: p.fecha,
      })),
      devoluciones: reserva.devoluciones.map((d) => ({
        id: d.id,
        monto: toNum(d.monto),
        metodoPago: d.metodoPago,
        fecha: d.fecha,
      })),
    };

    return tx.reserva.update({
      where: { id },
      data: {
        cerradaAt: new Date(),
        snapshotJson: snapshot,
        version: { increment: 1 },
      },
    });
  });

  broadcastDatos('reserva', 'actualizar');
  return reservaCerrada;
}

/**
 * Reapertura administrativa excepcional de una reserva cerrada (Fase 3).
 * Solo aplicable por administradores, requiere motivo formal de auditoría.
 * Retira temporalmente la bandera cerradaAt y resetea el snapshotJson.
 */
export async function reabrirReservaContable(
  id: number,
  motivo: string,
  version?: number
) {
  if (!motivo || motivo.trim().length === 0) {
    throw new Error('El motivo de reapertura es obligatorio para fines de auditoría');
  }

  const reservaReabierta = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    if (typeof (tx as any).$queryRaw === 'function') {
      await (tx as any).$queryRaw`SELECT id FROM "Reserva" WHERE id = ${id} FOR UPDATE`;
    }
    const reserva = await tx.reserva.findFirst({
      where: { id, deletedAt: null },
    });

    if (!reserva) throw new Error('Reserva no encontrada');
    checkVersion(reserva.version, version, 'La reserva cambió en otro dispositivo. Recarga e intenta de nuevo.');

    if (!reserva.cerradaAt) {
      throw new Error('La reserva no está cerrada contablemente');
    }

    return tx.reserva.update({
      where: { id },
      data: {
        cerradaAt: null,
        snapshotJson: Prisma.DbNull,
        version: { increment: 1 },
      },
      include: {
        pasajeros: { where: { deletedAt: null } },
        pagos: { where: { deletedAt: null } },
        devoluciones: { where: { deletedAt: null } },
        vuelos: { where: { deletedAt: null } },
      },
    });
  });

  broadcastDatos('reserva', 'actualizar');
  return reservaReabierta;
}

