import { prisma } from '../../plugins/prisma';
import { Prisma } from '@prisma/client';
import {
  CreatePagoPayload,
  CreateDevolucionPayload,
  derivarEstadoPago,
} from '@parapente/shared';
import { checkVersion, ConflictError } from '../concurrencia.service';
import { toNum } from '../money.util';
import { broadcastDatos } from '../eventos.service';

export async function addPagoReserva(reservaId: number, data: CreatePagoPayload & { version?: number }) {
  const reservaActualizada = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    if (typeof (tx as any).$queryRaw === 'function') {
      await (tx as any).$queryRaw`SELECT id FROM "Reserva" WHERE id = ${reservaId} FOR UPDATE`;
    }
    const reserva = await tx.reserva.findUnique({ where: { id: reservaId, deletedAt: null } });
    if (!reserva) {
      throw new Error('Reserva no encontrada');
    }
    if (reserva.cerradaAt) {
      throw new Error('No se pueden registrar pagos en una reserva cerrada contablemente');
    }
    if (reserva.estado === 'CANCELADA') {
      throw new Error('No se pueden registrar pagos en una reserva cancelada');
    }
    checkVersion(reserva.version, data.version, 'La reserva cambió en otro dispositivo. Recarga e intenta de nuevo.');

    await tx.pago.create({
      data: {
        reservaId,
        monto: data.monto,
        metodoPago: data.metodoPago || 'TRANSFERENCIA',
        fecha: data.fecha ? new Date(data.fecha) : new Date(),
        comprobante: data.comprobante,
        notas: data.notas,
      },
    });

    const pagoStats = await tx.pago.aggregate({
      _sum: { monto: true },
      where: { reservaId, deletedAt: null },
    });
    const nuevoAbono = toNum(pagoStats._sum.monto);
    // Fase 2: DEVUELTO prima — si hay devoluciones, el estado no baja a PAGADO/ABONADO.
    const finalEstadoPago = derivarEstadoPago(toNum(reserva.valorTotal), nuevoAbono, toNum(reserva.montoDevuelto));

    // Regla de negocio simplificada: si pasa a PAGADO y los vuelos ya se realizaron, transicionar a COMPLETADA
    let nuevoEstadoReserva: string | undefined = undefined;
    if (finalEstadoPago === 'PAGADO' && reserva.estado === 'AGENDADA') {
      const pasajeros = await tx.pasajero.findMany({
        where: { reservaId, deletedAt: null },
        select: { id: true, estado: true },
      });
      const pIds = pasajeros.map((p) => p.id);
      if (pIds.length > 0) {
        const [totalActivos, completados, pasajerosConVuelo] = await Promise.all([
          tx.vuelo.count({ where: { pasajeroId: { in: pIds }, deletedAt: null } }),
          tx.vuelo.count({ where: { pasajeroId: { in: pIds }, deletedAt: null, estado: 'COMPLETADO' } }),
          tx.vuelo.groupBy({
            by: ['pasajeroId'],
            where: { pasajeroId: { in: pIds }, deletedAt: null },
          }),
        ]);
        const vuelosFinalizados =
          (pasajerosConVuelo.length === pIds.length && totalActivos > 0 && totalActivos === completados) ||
          pasajeros.every((p) => p.estado === 'VUELO_COMPLETADO');
        if (vuelosFinalizados) {
          nuevoEstadoReserva = 'COMPLETADA';
          await tx.vuelo.updateMany({
            where: { reservaId, deletedAt: null, estado: { not: 'CANCELADO' } },
            data: { estado: 'COMPLETADO', version: { increment: 1 } },
          });
        }
      }
    }

    if (data.version !== undefined && data.version !== null) {
      const updateResult = await tx.reserva.updateMany({
        where: { id: reservaId, version: data.version },
        data: {
          abono: nuevoAbono,
          estadoPago: finalEstadoPago as any,
          ...(nuevoEstadoReserva && { estado: nuevoEstadoReserva as any }),
          version: { increment: 1 },
        },
      });
      if (updateResult.count === 0) {
        throw new ConflictError('La reserva cambió en otro dispositivo. Recarga e intenta de nuevo.');
      }
      return tx.reserva.findUniqueOrThrow({
        where: { id: reservaId, deletedAt: null },
        include: {
          pasajeros: { where: { deletedAt: null } },
          pagos: { where: { deletedAt: null }, orderBy: { fecha: 'desc' } },
        },
      });
    }

    return tx.reserva.update({
      where: { id: reservaId },
      data: {
        abono: nuevoAbono,
        estadoPago: finalEstadoPago as any,
        ...(nuevoEstadoReserva && { estado: nuevoEstadoReserva as any }),
        version: { increment: 1 },
      },
      include: {
        pasajeros: { where: { deletedAt: null } },
        pagos: { where: { deletedAt: null }, orderBy: { fecha: 'desc' } },
      },
    });
  });

  // Post-commit broadcasts
  broadcastDatos('reserva', 'actualizar');
  if (reservaActualizada.estado === 'COMPLETADA') {
    broadcastDatos('vuelo', 'actualizar');
  }

  return reservaActualizada;
}

export async function deletePagoReserva(reservaId: number, pagoId: number, version?: number) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    if (typeof (tx as any).$queryRaw === 'function') {
      await (tx as any).$queryRaw`SELECT id FROM "Reserva" WHERE id = ${reservaId} FOR UPDATE`;
    }
    const reserva = await tx.reserva.findUnique({ where: { id: reservaId, deletedAt: null } });
    if (!reserva) throw new Error('Reserva no encontrada');
    if (reserva.cerradaAt) {
      throw new Error('No se pueden anular pagos de una reserva cerrada contablemente');
    }
    checkVersion(reserva.version, version, 'La reserva cambió en otro dispositivo. Recarga e intenta de nuevo.');

    await tx.pago.update({
      where: { id: pagoId, reservaId, deletedAt: null },
      data: { deletedAt: new Date() },
    });

    const pagoStats = await tx.pago.aggregate({
      _sum: { monto: true },
      where: { reservaId, deletedAt: null },
    });
    const nuevoAbono = toNum(pagoStats._sum.monto);
    // Fase 2: si quedó devuelto más de lo abonado tras borrar un pago, es un
    // estado imposible → se rechaza.
    const devuelto = toNum(reserva.montoDevuelto);
    if (devuelto > nuevoAbono) {
      throw new Error('No se puede anular un pago cuando ya hay devoluciones que lo superan');
    }
    const finalEstadoPago = derivarEstadoPago(toNum(reserva.valorTotal), nuevoAbono, devuelto);

    return tx.reserva.update({
      where: { id: reservaId },
      data: {
        abono: nuevoAbono,
        estadoPago: finalEstadoPago as any,
        version: { increment: 1 },
      },
      include: {
        pasajeros: { where: { deletedAt: null } },
        pagos: { where: { deletedAt: null }, orderBy: { fecha: 'desc' } },
      },
    });
  });
}

/**
 * Fase 2 (ciclo de vida): registra una devolución de dinero al cliente.
 * - Espejo de `addPago` (monto, metodoPago, fecha, comprobante, notas).
 * - Solo en reservas CANCELADA o INCOMPLETA (400 en cualquier otro estado).
 * - Regla de negocio: la suma de devoluciones nunca puede exceder lo pagado
 *   (`montoDevuelto` acumulado <= `abono`).
 * - Si la reserva estaba INCOMPLETA, la devolución cierra el ciclo → COMPLETADA.
 * - `estadoPago` se deriva siempre (DEVUELTO prima si hay devoluciones).
 */
export async function addDevolucionReserva(reservaId: number, data: CreateDevolucionPayload & { version?: number }) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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
      throw new Error('No se pueden registrar devoluciones en una reserva cerrada contablemente');
    }
    // Las devoluciones se permiten en reservas canceladas
    if (reserva.estado !== 'CANCELADA') {
      throw new Error('Las devoluciones solo se permiten en reservas canceladas');
    }
    checkVersion(reserva.version, data.version, 'La reserva cambió en otro dispositivo. Recarga e intenta de nuevo.');

    // Suma de devoluciones actuales (soft-delete excluido) + el nuevo monto.
    const devolucionesStats = await tx.devolucion.aggregate({
      _sum: { monto: true },
      where: { reservaId, deletedAt: null },
    });
    // Tope real: nunca devolver más de lo efectivamente pagado (suma de pagos
    // activos; el `abono` denormalizado puede estar desfasado).
    const pagosStats = await tx.pago.aggregate({
      _sum: { monto: true },
      where: { reservaId, deletedAt: null },
    });
    const totalPagado = toNum(pagosStats._sum.monto);
    const nuevoDevuelto = toNum(devolucionesStats._sum.monto) + toNum(data.monto);
    // Regla de negocio: nunca devolver más de lo que el cliente pagó.
    if (nuevoDevuelto > totalPagado) {
      throw new Error('No se puede devolver más de lo pagado');
    }

    await tx.devolucion.create({
      data: {
        reservaId,
        monto: data.monto,
        metodoPago: data.metodoPago || 'TRANSFERENCIA',
        fecha: data.fecha ? new Date(data.fecha) : new Date(),
        comprobante: data.comprobante,
        notas: data.notas,
      },
    });

    const finalEstadoPago = derivarEstadoPago(toNum(reserva.valorTotal), totalPagado, nuevoDevuelto);

    return tx.reserva.update({
      where: { id: reservaId },
      data: {
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
}

/**
 * Fase 2 (ciclo de vida): anula (soft-delete) una devolución y recalcula
 * `montoDevuelto` + `estadoPago`. NO revierte el estado de la reserva: si el
 * ciclo ya se resolvió (COMPLETADA), se mantiene.
 */
export async function deleteDevolucionReserva(reservaId: number, devolucionId: number, version?: number) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    if (typeof (tx as any).$queryRaw === 'function') {
      await (tx as any).$queryRaw`SELECT id FROM "Reserva" WHERE id = ${reservaId} FOR UPDATE`;
    }
    // findFirst con deletedAt: null (el plugin soft-delete no cubre tx clients, ADR 006)
    const reserva = await tx.reserva.findFirst({
      where: { id: reservaId, deletedAt: null },
    });
    if (!reserva) throw new Error('Reserva no encontrada');
    if (reserva.cerradaAt) {
      throw new Error('No se pueden eliminar devoluciones de una reserva cerrada contablemente');
    }
    checkVersion(reserva.version, version, 'La reserva cambió en otro dispositivo. Recarga e intenta de nuevo.');

    // Soft-delete (ADR 006): la devolución se conserva para auditoría.
    await tx.devolucion.update({
      where: { id: devolucionId, reservaId, deletedAt: null },
      data: { deletedAt: new Date(), version: { increment: 1 } },
    });

    const devolucionesStats = await tx.devolucion.aggregate({
      _sum: { monto: true },
      where: { reservaId, deletedAt: null },
    });
    // Tope/derivación contra lo efectivamente pagado (suma de pagos activos).
    const pagosStats = await tx.pago.aggregate({
      _sum: { monto: true },
      where: { reservaId, deletedAt: null },
    });
    const totalPagado = toNum(pagosStats._sum.monto);
    const nuevoDevuelto = toNum(devolucionesStats._sum.monto);
    const finalEstadoPago = derivarEstadoPago(toNum(reserva.valorTotal), totalPagado, nuevoDevuelto);

    return tx.reserva.update({
      where: { id: reservaId },
      data: {
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
}
