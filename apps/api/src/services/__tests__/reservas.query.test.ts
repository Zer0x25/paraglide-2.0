import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAllReservas, getReservaById } from '../reservas/reservas.query';
import { prisma } from '../../plugins/prisma';

vi.mock('../../plugins/prisma', () => {
  return {
    prisma: {
      reserva: {
        findMany: vi.fn(),
        count: vi.fn(),
        findFirst: vi.fn(),
      },
    },
  };
});

describe('reservas.query', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAllReservas', () => {
    it('should query with deletedAt: null and default fallback orderBy', async () => {
      (prisma.reserva.findMany as any).mockResolvedValue([]);
      (prisma.reserva.count as any).mockResolvedValue(0);

      await getAllReservas();

      expect(prisma.reserva.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { AND: [{ deletedAt: null }] },
          orderBy: { createdAt: 'desc' },
        })
      );
    });

    it('should handle cursor properly', async () => {
      (prisma.reserva.findMany as any).mockResolvedValue([]);
      (prisma.reserva.count as any).mockResolvedValue(0);

      await getAllReservas({ cursor: '10' });

      expect(prisma.reserva.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { AND: [{ deletedAt: null }, { id: { lt: 10 } }] },
        })
      );
    });

    it('should ignore invalid cursor', async () => {
      (prisma.reserva.findMany as any).mockResolvedValue([]);
      (prisma.reserva.count as any).mockResolvedValue(0);

      await getAllReservas({ cursor: 'invalid' });

      expect(prisma.reserva.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { AND: [{ deletedAt: null }] },
        })
      );
    });

    it('should handle search query (q)', async () => {
      (prisma.reserva.findMany as any).mockResolvedValue([]);
      (prisma.reserva.count as any).mockResolvedValue(0);

      await getAllReservas({ q: ' search_term ' });

      const expectedOr = {
        OR: [
          { nombreTitular: { contains: 'search_term', mode: 'insensitive' } },
          { rutDniTitular: { contains: 'search_term', mode: 'insensitive' } },
          { email: { contains: 'search_term', mode: 'insensitive' } },
          { telefono: { contains: 'search_term', mode: 'insensitive' } },
          { numeroReserva: { contains: 'search_term', mode: 'insensitive' } },
          { pasajeros: { some: { nombre: { contains: 'search_term', mode: 'insensitive' } } } },
          { pasajeros: { some: { rutDni: { contains: 'search_term', mode: 'insensitive' } } } },
        ],
      };

      expect(prisma.reserva.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { AND: [{ deletedAt: null }, expectedOr] },
        })
      );
    });

    it('should handle estado filter', async () => {
      (prisma.reserva.findMany as any).mockResolvedValue([]);
      (prisma.reserva.count as any).mockResolvedValue(0);

      await getAllReservas({ estado: 'PAGADO' });

      expect(prisma.reserva.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { AND: [{ deletedAt: null }, { estadoPago: 'PAGADO' }] },
        })
      );
    });

    it('should handle date range filters (desde, sin hasta, PROXIMAS)', async () => {
      (prisma.reserva.findMany as any).mockResolvedValue([]);
      (prisma.reserva.count as any).mockResolvedValue(0);

      const desde = '2023-01-01T00:00:00Z';
      await getAllReservas({ desde });

      const expectedDateCond = { gte: new Date(desde) };

      expect(prisma.reserva.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              { deletedAt: null },
              {
                OR: [
                  { fechaAgenda: expectedDateCond },
                  {
                    pasajeros: {
                      some: {
                        deletedAt: null,
                        vuelos: {
                          some: {
                            deletedAt: null,
                            fechaHora: expectedDateCond,
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
              },
            ],
          },
          orderBy: { fechaAgenda: { sort: 'asc', nulls: 'last' } },
        })
      );
    });

    it('should handle date range filters (hasta, sin desde, PASADAS)', async () => {
      (prisma.reserva.findMany as any).mockResolvedValue([]);
      (prisma.reserva.count as any).mockResolvedValue(0);

      const hasta = '2023-12-31T23:59:59Z';
      await getAllReservas({ hasta });

      const expectedDateCond = { lte: new Date(hasta) };

      expect(prisma.reserva.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              { deletedAt: null },
              {
                OR: [
                  { fechaAgenda: expectedDateCond },
                  { estado: 'COMPLETADA' },
                ],
              },
            ],
          },
          orderBy: { fechaAgenda: { sort: 'desc', nulls: 'last' } },
        })
      );
    });

    it('should handle both desde and hasta date range filters', async () => {
      (prisma.reserva.findMany as any).mockResolvedValue([]);
      (prisma.reserva.count as any).mockResolvedValue(0);

      const desde = '2023-01-01T00:00:00Z';
      const hasta = '2023-12-31T23:59:59Z';
      await getAllReservas({ desde, hasta });

      expect(prisma.reserva.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              { deletedAt: null },
              { fechaAgenda: { gte: new Date(desde), lte: new Date(hasta) } },
            ],
          },
          orderBy: { createdAt: 'desc' }, // default fallback when both or neither provided
        })
      );
    });

    it('should handle sort', async () => {
      (prisma.reserva.findMany as any).mockResolvedValue([]);
      (prisma.reserva.count as any).mockResolvedValue(0);

      await getAllReservas({ sort: 'fechaAgenda.asc' });

      expect(prisma.reserva.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { fechaAgenda: { sort: 'asc', nulls: 'last' } },
        })
      );
    });

    it('should handle sort for other fields', async () => {
      (prisma.reserva.findMany as any).mockResolvedValue([]);
      (prisma.reserva.count as any).mockResolvedValue(0);

      await getAllReservas({ sort: 'nombreTitular.desc' });

      expect(prisma.reserva.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { nombreTitular: 'desc' },
        })
      );
    });

    it('should catch errors and return empty array fallback', async () => {
      (prisma.reserva.findMany as any).mockRejectedValue(new Error('DB Error'));
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await getAllReservas();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Advertencia DB en ReservasService.getAll, retornando arreglo vacío:',
        expect.any(Error)
      );
      expect(result).toEqual({
        data: [],
        pagination: { page: 1, pageSize: 100, total: 0, totalPages: 0, hasMore: false },
      });

      consoleWarnSpy.mockRestore();
    });
  });

  describe('getReservaById', () => {
    it('should return reserva by id', async () => {
      const mockReserva = { id: 1, nombreTitular: 'Test' };
      (prisma.reserva.findFirst as any).mockResolvedValue(mockReserva);

      const result = await getReservaById(1);

      expect(prisma.reserva.findFirst).toHaveBeenCalledWith({
        where: { id: 1, deletedAt: null },
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
      expect(result).toEqual(mockReserva);
    });
  });
});
