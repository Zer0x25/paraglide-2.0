import { prisma } from '../../plugins/prisma';
import { puedeTransicionarEstadoVuelo, horaLocalHHMM } from '@parapente/shared';
import { checkVersion } from '../concurrencia.service';
import { toNum } from '../money.util';
import { broadcastDatos } from '../eventos.service';
import { autoAssignVuelos } from './vuelos.matching';
import { googleCalendarService } from '../google-calendar.service';

export async function agendarGrupoVuelos(data: {
  reservaId: number;
  fechaHora: string;
  asignaciones?: Record<number, number>;
  valorPactadoPorPasajero?: number;
  version?: number;
}) {
  const targetDate = new Date(data.fechaHora);

  const vuelosCreados = await prisma.$transaction(async (tx) => {
    // Lock + re-lectura atómica (mismo patrón que cancelar/desagendar/updateEstadoVuelo):
    // FOR UPDATE serializa agendamientos concurrentes y la relectura de `version`
    // dentro de la transacción garantiza el 409 ante cambios concurrentes
    // (antes el checkVersion corría fuera de todo lock → lost update silencioso).
    if (typeof (tx as any).$queryRaw === 'function') {
      await (tx as any).$queryRaw`SELECT id FROM "Reserva" WHERE id = ${data.reservaId} FOR UPDATE`;
    }
    // findFirst con deletedAt: null (el plugin soft-delete no cubre tx clients, ADR 006)
    const reserva = await tx.reserva.findFirst({
      where: { id: data.reservaId, deletedAt: null },
      include: {
        pasajeros: {
          where: { deletedAt: null },
        },
      },
    });

    if (!reserva) throw new Error('Reserva no encontrada');
    if (reserva.cerradaAt) {
      throw new Error('La reserva se encuentra cerrada contablemente y no admite agendamiento');
    }
    if (!reserva.pasajeros || reserva.pasajeros.length === 0) {
      throw new Error('La reserva no tiene pasajeros registrados para agendar');
    }

    // Control de concurrencia (re-verificado bajo lock)
    checkVersion(reserva.version, data.version, 'La reserva cambió en otro dispositivo. Recarga e intenta agendar de nuevo.');

    let asignaciones = data.asignaciones;
    if (!asignaciones || Object.keys(asignaciones).length === 0) {
      const paxs = reserva.pasajeros.map(p => ({ id: p.id, peso: p.peso || 75 }));
      asignaciones = await autoAssignVuelos(data.fechaHora, paxs);
    }

    const totalPasajeros = reserva.pasajeros.length;
    // Sin valor pactado ni valorTotal, el vuelo vale 0: nunca inventar dinero
    // (mismo criterio que el tool MCP crear_y_agendar_reserva).
    const valorUnitario = data.valorPactadoPorPasajero ?? (toNum(reserva.valorTotal) > 0 ? (toNum(reserva.valorTotal) / totalPasajeros) : 0);

    const vuelosCreados = [];

    for (const pasajero of reserva.pasajeros) {
      const pilotoId = asignaciones![pasajero.id];
      if (!pilotoId) {
        throw new Error(`No hay piloto disponible para el pasajero ${pasajero.nombre} a las ${data.fechaHora}`);
      }

      const vueloPrevio = await tx.vuelo.findFirst({
        where: { pasajeroId: pasajero.id, deletedAt: null },
      });

      if (vueloPrevio) {
        await tx.vuelo.update({
          where: { id: vueloPrevio.id },
          data: { deletedAt: new Date(), version: { increment: 1 } },
        });
      }

      const piloto = await tx.piloto.findUnique({ where: { id: pilotoId, deletedAt: null } });
      const pagoPiloto = piloto?.tarifaPorVuelo || 0;

      const vuelo = await tx.vuelo.create({
        data: {
          fechaHora: targetDate,
          valorPactado: valorUnitario,
          pagoPiloto,
          reservaId: data.reservaId,
          pilotoId,
          pasajeroId: pasajero.id,
          estado: 'AGENDADO',
        },
        include: {
          piloto: true,
          pasajero: true,
        },
      });

      vuelosCreados.push(vuelo);
    }

    const estadoReservaFinal =
      reserva.estado === 'SIN_AGENDAR' ? 'AGENDADA' : undefined;

    const horaBloque = horaLocalHHMM(targetDate);

    await tx.reserva.update({
      where: { id: data.reservaId },
      data: {
        fechaAgenda: targetDate,
        horaAgenda: horaBloque,
        ...(estadoReservaFinal !== undefined && { estado: estadoReservaFinal as any }),
        version: { increment: 1 },
      },
    });

    return vuelosCreados;
  });

  broadcastDatos('reserva', 'actualizar');
  broadcastDatos('piloto', 'actualizar');

  // Sincronización en tiempo real con Google Calendar (post-commit)
  for (const v of vuelosCreados) {
    googleCalendarService.syncVueloCreated(v.id).catch((err) => {
      console.warn('[GoogleCalendar] Error en syncVueloCreated (grupo):', err);
    });
  }

  return vuelosCreados;
}

export async function updateEstadoVuelo(id: number, estado: string, version?: number) {
  const { vueloActualizado, reservaCompletada } = await prisma.$transaction(async (tx) => {
    if (version !== undefined && typeof (tx as any).$queryRaw === 'function') {
      await (tx as any).$queryRaw`SELECT id FROM "Vuelo" WHERE id = ${id} FOR UPDATE`;
    }
    const actual = await tx.vuelo.findFirst({
      where: { id, deletedAt: null },
      include: { reserva: { select: { cerradaAt: true } } },
    });
    if (!actual) throw new Error('Vuelo no encontrado');
    checkVersion(actual.version, version);

    if (actual.reserva?.cerradaAt) {
      throw new Error('No se puede modificar el estado de un vuelo perteneciente a una reserva cerrada contablemente');
    }

    if (!puedeTransicionarEstadoVuelo(actual.estado as any, estado as any)) {
      throw new Error(`Transición inválida: ${actual.estado} → ${estado}`);
    }

    const vuelo = await tx.vuelo.update({
      where: { id },
      data: { estado: estado as any, version: { increment: 1 } },
      include: { piloto: true, pasajero: true },
    });

    let completada = false;
    if (estado === 'COMPLETADO') {
      if (tx.pasajero?.updateMany) {
        await tx.pasajero.updateMany({
          where: { id: vuelo.pasajeroId, deletedAt: null },
          data: { estado: 'VUELO_COMPLETADO' },
        });
      }

      const pasajero = await tx.pasajero.findUnique({
        where: { id: vuelo.pasajeroId, deletedAt: null },
        select: { id: true, reservaId: true },
      });
      if (pasajero?.reservaId) {
        if (typeof (tx as any).$queryRaw === 'function') {
          await (tx as any).$queryRaw`SELECT id FROM "Reserva" WHERE id = ${pasajero.reservaId} FOR UPDATE`;
        }
        const pasajerosReserva = await tx.pasajero.findMany({
          where: { reservaId: pasajero.reservaId, deletedAt: null },
          select: { id: true },
        });
        const pasajeroIds = pasajerosReserva.map((p) => p.id);
        if (pasajeroIds.length > 0) {
          const [totalActivos, completados, pasajerosConVuelo] = await Promise.all([
            // Los vuelos CANCELADO no cuentan como "activos": si se contaran,
            // totalActivos !== completados para siempre y la reserva nunca
            // pasaría a COMPLETADA automáticamente.
            tx.vuelo.count({ where: { pasajeroId: { in: pasajeroIds }, deletedAt: null, estado: { not: 'CANCELADO' } } }),
            tx.vuelo.count({ where: { pasajeroId: { in: pasajeroIds }, deletedAt: null, estado: 'COMPLETADO' } }),
            tx.vuelo.groupBy({
              by: ['pasajeroId'],
              where: { pasajeroId: { in: pasajeroIds }, deletedAt: null },
            }),
          ]);
          const coberturaCompleta = pasajerosConVuelo.length === pasajeroIds.length;
          if (coberturaCompleta && totalActivos > 0 && totalActivos === completados) {
            const reservaActual = await tx.reserva.findFirst({
              where: { id: pasajero.reservaId, deletedAt: null },
              select: { estadoPago: true, estado: true, valorTotal: true },
            });
            if (reservaActual?.estadoPago === 'PAGADO' && reservaActual?.estado !== 'COMPLETADA') {
              const valorTotalNum = toNum(reservaActual.valorTotal);
              let cumpleHistorial = true;
              if (valorTotalNum > 0) {
                const [pagoStats, countPagos] = await Promise.all([
                  tx.pago.aggregate({
                    _sum: { monto: true },
                    where: { reservaId: pasajero.reservaId, deletedAt: null },
                  }),
                  tx.pago.count({
                    where: { reservaId: pasajero.reservaId, deletedAt: null },
                  }),
                ]);
                const totalPagado = toNum(pagoStats._sum.monto);
                cumpleHistorial = countPagos > 0 && totalPagado >= valorTotalNum;
              }
              if (cumpleHistorial) {
                await tx.reserva.update({
                  where: { id: pasajero.reservaId },
                  data: { estado: 'COMPLETADA', version: { increment: 1 } },
                });
                completada = true;
              }
            }
          }
        }
      }
    }

    return { vueloActualizado: vuelo, reservaCompletada: completada };
  });

  broadcastDatos('vuelo', 'actualizar');
  if (reservaCompletada) {
    broadcastDatos('reserva', 'actualizar');
  }

  // Sincronización en tiempo real con Google Calendar (post-commit)
  if (estado === 'CANCELADO') {
    googleCalendarService.syncVueloDeleted(id).catch((err) => {
      console.warn('[GoogleCalendar] Error en syncVueloDeleted (cancelado):', err);
    });
  } else {
    googleCalendarService.syncVueloUpdated(id).catch((err) => {
      console.warn('[GoogleCalendar] Error en syncVueloUpdated (cambio estado):', err);
    });
  }

  return vueloActualizado;
}

export async function deleteVuelo(id: number) {
  const vuelo = await prisma.vuelo.findUnique({
    where: { id, deletedAt: null },
    include: {
      pasajero: {
        select: { reservaId: true },
      },
      reserva: {
        select: { cerradaAt: true },
      },
    },
  });

  if (!vuelo) throw new Error('Vuelo no encontrado');
  if (vuelo.reserva?.cerradaAt) {
    throw new Error('No se puede eliminar un vuelo perteneciente a una reserva cerrada contablemente');
  }

  await prisma.vuelo.update({
    where: { id },
    data: { deletedAt: new Date(), version: { increment: 1 } },
  });

  // Sincronización en tiempo real con Google Calendar (eliminar evento)
  googleCalendarService.syncVueloDeleted(id, vuelo?.googleEventId || undefined).catch((err) => {
    console.warn('[GoogleCalendar] Error en syncVueloDeleted:', err);
  });

  // Si el vuelo pertenecía a una reserva, revertir estado a SIN_AGENDAR si ya no quedan vuelos activos
  if (vuelo?.pasajero?.reservaId) {
    try {
      const reservaId = vuelo.pasajero.reservaId;
      const reserva = await prisma.reserva.findFirst({
        where: { id: reservaId, deletedAt: null },
        include: {
          pasajeros: {
            where: { deletedAt: null },
            include: {
              vuelos: {
                where: { deletedAt: null, estado: { not: 'CANCELADO' } },
              },
            },
          },
        },
      });

      if (reserva && reserva.estado !== 'CANCELADA') {
        const pasajerosConVuelo = reserva.pasajeros.filter(p => p.vuelos.length > 0).length;
        if (pasajerosConVuelo === 0) {
          await prisma.reserva.update({
            where: { id: reservaId },
            data: { estado: 'SIN_AGENDAR', version: { increment: 1 } },
          });
          broadcastDatos('reserva', 'actualizar');
        }
      }
    } catch (err) {
      console.warn('Advertencia al revertir estado de reserva en vuelos.delete:', err);
    }
  }
}
