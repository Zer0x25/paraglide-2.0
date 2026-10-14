import { prisma } from '../../plugins/prisma';
import { CreateVueloPayload, horaLocalHHMM, esFechaHoraPasada } from '@parapente/shared';
import { checkVersion } from '../concurrencia.service';
import { listar, parseSort, ListQuery } from '../pagination.util';
import { broadcastDatos } from '../eventos.service';
import { validateWeightAndConflict } from './vuelos.matching';
import { googleCalendarService } from '../google-calendar.service';

const SORT_FIELDS = ['fechaHora', 'createdAt'] as const;

export async function getAllVuelos(
  opts: ListQuery & {
    desde?: string;
    hasta?: string;
    estado?: string;
    sort?: string;
    campos?: string;
  } = {},
) {
  try {
    const where: any = { deletedAt: null };
    if (opts.desde || opts.hasta) {
      where.fechaHora = {};
      if (opts.desde) where.fechaHora.gte = new Date(opts.desde);
      if (opts.hasta) where.fechaHora.lte = new Date(opts.hasta);
    }
    if (opts.estado) where.estado = opts.estado;
    const orderBy = parseSort(opts.sort, SORT_FIELDS, { fechaHora: 'asc' });

    // Proyección optimizada si campos === 'vista-calendario'
    const base: any = { where, orderBy };
    if (opts.campos === 'vista-calendario') {
      base.select = {
        id: true,
        fechaHora: true,
        estado: true,
        valorPactado: true,
        version: true,
        pilotoId: true,
        pasajeroId: true,
        reservaId: true,
        piloto: { select: { id: true, nombre: true } },
        pasajero: { select: { id: true, nombre: true, reservaId: true } },
        reserva: {
          select: {
            id: true,
            numeroReserva: true,
            estado: true,
            estadoPago: true,
            abono: true,
            valorTotal: true,
            cerradaAt: true,
          },
        },
      };
    } else {
      base.include = { piloto: true, pasajero: true };
    }
    // await obligatorio: sin él el rechazo no entra en el catch y el
    // fallback de arreglo vacío sería código muerto (500 en cascada).
    return await listar(
      opts,
      ({ skip, take }) =>
        prisma.vuelo.findMany({
          ...base,
          skip,
          take,
        }),
      () => prisma.vuelo.count({ where }),
    );
  } catch (err) {
    console.error('Error DB en VuelosService.getAll:', err);
    throw err;
  }
}

export async function createVuelo(data: CreateVueloPayload) {
  if (esFechaHoraPasada(data.fechaHora as string)) {
    throw new Error('No se puede crear un vuelo en una fecha u hora pasada');
  }
  await validateWeightAndConflict(data.pilotoId, data.pasajeroId, data.fechaHora as string);

  const pasajero = await prisma.pasajero.findUnique({
    where: { id: data.pasajeroId, deletedAt: null },
    select: { reservaId: true },
  });
  const reservaId = data.reservaId ?? pasajero?.reservaId;
  if (!reservaId) {
    throw new Error('No se encontró la reserva asociada al pasajero');
  }

  const piloto = await prisma.piloto.findUnique({ where: { id: data.pilotoId, deletedAt: null } });
  const pagoPiloto = piloto?.tarifaPorVuelo || 0;

  const { vuelo, reservaActualizada } = await prisma.$transaction(async (tx) => {
    if (typeof (tx as any).$queryRaw === 'function') {
      await (tx as any).$queryRaw`SELECT id FROM "Reserva" WHERE id = ${reservaId} FOR UPDATE`;
    }
    const reservaExistente = await tx.reserva.findFirst({
      where: { id: reservaId, deletedAt: null },
      select: { cerradaAt: true, estado: true, fechaAgenda: true },
    });
    if (!reservaExistente) throw new Error('Reserva no encontrada');
    if (reservaExistente.cerradaAt) {
      throw new Error('La reserva se encuentra cerrada contablemente y no admite nuevos vuelos');
    }

    // Si el pasajero ya tenía un vuelo agendado previo, hacer soft-delete para no duplicar
    const vueloPrevio = await tx.vuelo.findFirst({
      where: { pasajeroId: data.pasajeroId, deletedAt: null, estado: { not: 'COMPLETADO' } },
    });
    if (vueloPrevio) {
      await tx.vuelo.update({
        where: { id: vueloPrevio.id },
        data: { deletedAt: new Date(), version: { increment: 1 } },
      });
    }

    const nuevoVuelo = await tx.vuelo.create({
      data: {
        fechaHora: new Date(data.fechaHora),
        valorPactado: data.valorPactado,
        pagoPiloto,
        reservaId,
        pilotoId: data.pilotoId,
        pasajeroId: data.pasajeroId,
        equipoId: data.equipoId ?? null,
      },
      include: {
        piloto: true,
        pasajero: true,
      },
    });

    const targetDate = new Date(data.fechaHora);
    const horaBloque = horaLocalHHMM(targetDate);
    const updateData: any = { version: { increment: 1 } };
    let shouldUpdate = false;
    if (reservaExistente.estado === 'SIN_AGENDAR') {
      updateData.estado = 'AGENDADA';
      shouldUpdate = true;
    }
    if (!reservaExistente.fechaAgenda) {
      updateData.fechaAgenda = targetDate;
      updateData.horaAgenda = horaBloque;
      shouldUpdate = true;
    }
    if (shouldUpdate) {
      await tx.reserva.update({ where: { id: reservaId }, data: updateData });
    }
    return { vuelo: nuevoVuelo, reservaActualizada: shouldUpdate };
  });

  if (reservaActualizada) {
    broadcastDatos('reserva', 'actualizar');
  }

  // Sincronización en tiempo real con Google Calendar (asíncrona y no bloqueante)
  googleCalendarService.syncVueloCreated(vuelo.id).catch((err) => {
    console.warn('[GoogleCalendar] Error en syncVueloCreated:', err);
  });

  return vuelo;
}

export async function updateVuelo(id: number, data: CreateVueloPayload & { version?: number }) {
  await validateWeightAndConflict(data.pilotoId, data.pasajeroId, data.fechaHora as string, id);

  const piloto = await prisma.piloto.findUnique({ where: { id: data.pilotoId, deletedAt: null } });
  const pagoPiloto = piloto?.tarifaPorVuelo || 0;

  const vueloActualizado = await prisma.$transaction(async (tx) => {
    if (data.version !== undefined && typeof (tx as any).$queryRaw === 'function') {
      await (tx as any).$queryRaw`SELECT id FROM "Vuelo" WHERE id = ${id} FOR UPDATE`;
    }
    const actual = await tx.vuelo.findUnique({
      where: { id, deletedAt: null },
      include: { reserva: { select: { cerradaAt: true } } },
    });
    if (!actual) throw new Error('Vuelo no encontrado');
    if (actual.reserva?.cerradaAt) {
      throw new Error(
        'No se puede modificar un vuelo perteneciente a una reserva cerrada contablemente',
      );
    }
    checkVersion(actual.version, data.version);

    if (data.fechaHora) {
      const fechaAnterior = new Date(actual.fechaHora).getTime();
      const fechaNueva = new Date(data.fechaHora).getTime();
      if (fechaAnterior !== fechaNueva && esFechaHoraPasada(data.fechaHora as string)) {
        throw new Error('No se puede reprogramar un vuelo a una fecha u hora pasada');
      }
    }

    return tx.vuelo.update({
      where: { id },
      data: {
        fechaHora: new Date(data.fechaHora),
        valorPactado: data.valorPactado,
        pagoPiloto,
        pilotoId: data.pilotoId,
        pasajeroId: data.pasajeroId,
        version: { increment: 1 },
      },
      include: { piloto: true, pasajero: true },
    });
  });

  // Sincronización en tiempo real con Google Calendar (post-commit)
  googleCalendarService.syncVueloUpdated(id).catch((err) => {
    console.warn('[GoogleCalendar] Error en syncVueloUpdated:', err);
  });

  return vueloActualizado;
}
