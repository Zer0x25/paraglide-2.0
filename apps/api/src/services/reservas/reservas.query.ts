import { prisma } from '../../plugins/prisma';
import { listar, parseSort, ListQuery } from '../pagination.util';

const SORT_FIELDS = ['createdAt', 'fechaAgenda', 'nombreTitular'] as const;

export async function getAllReservas(
  opts: ListQuery & { q?: string; estado?: string; desde?: string; hasta?: string; sort?: string } = {}
) {
  try {
    const andConditions: any[] = [{ deletedAt: null }];

    if (opts.cursor) {
      const cursorId = Number(opts.cursor);
      if (!Number.isNaN(cursorId)) {
        andConditions.push({ id: { lt: cursorId } });
      }
    }

    if (opts.q?.trim()) {
      const q = opts.q.trim();
      andConditions.push({
        OR: [
          { nombreTitular: { contains: q, mode: 'insensitive' } },
          { rutDniTitular: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { telefono: { contains: q, mode: 'insensitive' } },
          { numeroReserva: { contains: q, mode: 'insensitive' } },
          { pasajeros: { some: { nombre: { contains: q, mode: 'insensitive' } } } },
          { pasajeros: { some: { rutDni: { contains: q, mode: 'insensitive' } } } },
        ],
      });
    }

    if (opts.estado) {
      andConditions.push({ estadoPago: opts.estado });
    }

    if (opts.desde || opts.hasta) {
      const fechaCond: any = {};
      if (opts.desde) fechaCond.gte = new Date(opts.desde);
      if (opts.hasta) fechaCond.lte = new Date(opts.hasta);

      if (opts.desde && !opts.hasta) {
        // Tab PROXIMAS: Incluye reservas cuya fechaAgenda >= desde,
        // O que tengan algún vuelo agendado >= desde,
        // O reservas activas abiertas sin fecha (giftcards/sin agendar pendientes de volar)
        andConditions.push({
          OR: [
            { fechaAgenda: fechaCond },
            {
              pasajeros: {
                some: {
                  deletedAt: null,
                  vuelos: {
                    some: {
                      deletedAt: null,
                      fechaHora: fechaCond,
                    },
                  },
                },
              },
            },
            {
              fechaAgenda: null,
              estado: { notIn: ['CANCELADA', 'COMPLETADA'] },
            },
          ],
        });
      } else if (opts.hasta && !opts.desde) {
        // Tab PASADAS: Incluye reservas con fechaAgenda <= hasta,
        // O completadas
        andConditions.push({
          OR: [
            { fechaAgenda: fechaCond },
            { estado: 'COMPLETADA' },
          ],
        });
      } else {
        andConditions.push({ fechaAgenda: fechaCond });
      }
    }

    const where = { AND: andConditions };

    let fallbackOrderBy: any = { createdAt: 'desc' };
    if (opts.desde && !opts.hasta) {
      fallbackOrderBy = { fechaAgenda: { sort: 'asc', nulls: 'last' } };
    } else if (opts.hasta && !opts.desde) {
      fallbackOrderBy = { fechaAgenda: { sort: 'desc', nulls: 'last' } };
    }

    let orderBy: any;
    if (opts.sort) {
      const parsed = parseSort(opts.sort, SORT_FIELDS, { createdAt: 'desc' });
      if ('fechaAgenda' in parsed) {
        orderBy = { fechaAgenda: { sort: parsed.fechaAgenda, nulls: 'last' } };
      } else {
        orderBy = parsed;
      }
    } else {
      orderBy = fallbackOrderBy;
    }

    // await obligatorio: sin él el rechazo no entra en el catch y el
    // fallback de arreglo vacío sería código muerto (500 en cascada).
    return await listar(
      opts,
      ({ skip, take, cursor }) =>
        prisma.reserva.findMany({
          where,
          include: {
            tarifa: true,
            promocion: true,
            pasajeros: {
              where: { deletedAt: null },
              include: {
                vuelos: {
                  where: { deletedAt: null },
                  include: { piloto: true },
                },
              },
            },
            pagos: {
              where: { deletedAt: null },
              orderBy: { fecha: 'desc' },
            },
            devoluciones: {
              where: { deletedAt: null },
              orderBy: { fecha: 'desc' },
            },
          },
          orderBy,
          skip: cursor ? 0 : skip,
          take,
        }),
      () => prisma.reserva.count({ where }),
    );
  } catch (err) {
    console.warn('Advertencia DB en ReservasService.getAll, retornando arreglo vacío:', err);
    return { data: [], pagination: { page: 1, pageSize: 100, total: 0, totalPages: 0, hasMore: false } };
  }
}

export async function getReservaById(id: number) {
  return prisma.reserva.findFirst({
    where: { id, deletedAt: null },
    include: {
      tarifa: true,
      promocion: true,
      pasajeros: {
        where: { deletedAt: null },
        include: {
          vuelos: {
            where: { deletedAt: null },
            include: { piloto: true },
          },
        },
      },
      pagos: {
        where: { deletedAt: null },
        orderBy: { fecha: 'desc' },
      },
      devoluciones: {
        where: { deletedAt: null },
        orderBy: { fecha: 'desc' },
      },
    },
  });
}
