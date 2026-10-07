import { prisma } from '../../plugins/prisma';
import { CreateVueloPayload, horaLocalHHMM } from '@parapente/shared';
import { checkVersion } from '../concurrencia.service';
import { listar, parseSort, ListQuery } from '../pagination.util';
import { broadcastDatos } from '../eventos.service';
import { validateWeightAndConflict } from './vuelos.matching';
import { googleCalendarService } from '../google-calendar.service';

const SORT_FIELDS = ['fechaHora', 'createdAt'] as const;

export async function getAllVuelos(
  opts: ListQuery & { desde?: string; hasta?: string; estado?: string; sort?: string; campos?: string } = {},
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
    console.warn('Advertencia DB en VuelosService.getAll, retornando arreglo vacío:', err);
    return { data: [], pagination: { page: 1, pageSize: 100, total: 0, totalPages: 0, hasMore: false } };
  }
}

export async function createVuelo(data: CreateVueloPayload) {
  await validateWeightAndConflict(data.pilotoId, data.pasajeroId, data.fechaHora as string);

  const pasajero = await prisma.pasajero.findUnique({
    where: { id: data.pasajeroId, deletedAt: null },
    select: { reservaId: true },
  });
  const reservaId = data.reservaId ?? pasajero?.reservaId;
  if (!reservaId) {
    throw new Error('No se encontró la reserva asociada al pasajero');
  }

  const reservaExistente = await prisma.reserva.findFirst({
    where: { id: reservaId, deletedAt: null },
    select: { cerradaAt: true },
  });
  if (reservaExistente?.cerradaAt) {
    throw new Error('La reserva se encuentra cerrada contablemente y no admite nuevos vuelos');
  }

  const piloto = await prisma.piloto.findUnique({ where: { id: data.pilotoId, deletedAt: null } });
  const pagoPiloto = piloto?.tarifaPorVuelo || 0;

  const vuelo = await prisma.vuelo.create({
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

  // Derivación de estado a AGENDADA y actualización de agenda si corresponde
  try {
    const reserva = await prisma.reserva.findFirst({
      where: { id: reservaId, deletedAt: null },
      select: { estado: true, fechaAgenda: true },
    });
    if (reserva) {
      const targetDate = new Date(data.fechaHora);
      const horaBloque = horaLocalHHMM(targetDate);
      const updateData: any = {
        version: { increment: 1 },
      };
      let shouldUpdate = false;
      if (reserva.estado === 'SIN_AGENDAR') {
        updateData.estado = 'AGENDADA';
        shouldUpdate = true;
      }
      if (!reserva.fechaAgenda) {
        updateData.fechaAgenda = targetDate;
        updateData.horaAgenda = horaBloque;
        shouldUpdate = true;
      }
      if (shouldUpdate) {
        await prisma.reserva.update({
          where: { id: reservaId },
          data: updateData,
        });
        broadcastDatos('reserva', 'actualizar');
      }
    }
  } catch (err) {
    console.warn('Advertencia al derivar estado AGENDADA en vuelos.create:', err);
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
      throw new Error('No se puede modificar un vuelo perteneciente a una reserva cerrada contablemente');
    }
    checkVersion(actual.version, data.version);

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
