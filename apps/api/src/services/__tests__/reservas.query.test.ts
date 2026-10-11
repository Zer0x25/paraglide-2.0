import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAllReservas, getReservaById } from '../reservas/reservas.query';
import { prisma } from '../../plugins/prisma';

vi.mock('../../plugins/prisma', () => ({
  prisma: {
    reserva: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

describe('Reservas Query Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAllReservas', () => {
    it('debería consultar reservas por defecto (sin filtros)', async () => {
      (prisma.reserva.findMany as any).mockResolvedValue([{ id: 1 }]);
      (prisma.reserva.count as any).mockResolvedValue(1);

      const result = await getAllReservas();

      expect(result.data).toEqual([{ id: 1 }]);
      expect(result.pagination.total).toBe(1);

      expect(prisma.reserva.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { AND: [{ deletedAt: null }] },
          orderBy: { createdAt: 'desc' },
        })
      );
    });

    it('debería aplicar filtro por cursor', async () => {
      (prisma.reserva.findMany as any).mockResolvedValue([]);
      (prisma.reserva.count as any).mockResolvedValue(0);

      await getAllReservas({ cursor: '10' });

      expect(prisma.reserva.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { AND: [{ deletedAt: null }, { id: { lt: 10 } }] },
        })
      );
    });

    it('debería ignorar cursor si no es un número válido', async () => {
      (prisma.reserva.findMany as any).mockResolvedValue([]);
      (prisma.reserva.count as any).mockResolvedValue(0);

      await getAllReservas({ cursor: 'invalid' });

      expect(prisma.reserva.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { AND: [{ deletedAt: null }] }, // Without lt check
        })
      );
    });

    it('debería aplicar filtro por estado', async () => {
      (prisma.reserva.findMany as any).mockResolvedValue([]);
      (prisma.reserva.count as any).mockResolvedValue(0);

      await getAllReservas({ estado: 'PAGADO' });

      expect(prisma.reserva.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { AND: [{ deletedAt: null }, { estadoPago: 'PAGADO' }] },
        })
      );
    });

    it('debería aplicar filtro de búsqueda (q)', async () => {
      (prisma.reserva.findMany as any).mockResolvedValue([]);
      (prisma.reserva.count as any).mockResolvedValue(0);

      await getAllReservas({ q: ' juan ' });

      expect(prisma.reserva.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              { deletedAt: null },
              {
                OR: [
                  { nombreTitular: { contains: 'juan', mode: 'insensitive' } },
                  { rutDniTitular: { contains: 'juan', mode: 'insensitive' } },
                  { email: { contains: 'juan', mode: 'insensitive' } },
                  { telefono: { contains: 'juan', mode: 'insensitive' } },
                  { numeroReserva: { contains: 'juan', mode: 'insensitive' } },
                  { pasajeros: { some: { nombre: { contains: 'juan', mode: 'insensitive' } } } },
                  { pasajeros: { some: { rutDni: { contains: 'juan', mode: 'insensitive' } } } },
                ],
              },
            ],
          },
        })
      );
    });

    it('debería aplicar filtro de proximas (solo desde)', async () => {
      (prisma.reserva.findMany as any).mockResolvedValue([]);
      (prisma.reserva.count as any).mockResolvedValue(0);

      const desde = '2025-01-01T00:00:00.000Z';
      await getAllReservas({ desde });

      expect(prisma.reserva.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              { deletedAt: null },
              {
                OR: [
                  { fechaAgenda: { gte: new Date(desde) } },
                  {
                    pasajeros: {
                      some: {
                        deletedAt: null,
                        vuelos: {
                          some: {
                            deletedAt: null,
                            fechaHora: { gte: new Date(desde) },
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

    it('debería aplicar filtro de pasadas (solo hasta)', async () => {
      (prisma.reserva.findMany as any).mockResolvedValue([]);
      (prisma.reserva.count as any).mockResolvedValue(0);

      const hasta = '2025-01-01T00:00:00.000Z';
      await getAllReservas({ hasta });

      expect(prisma.reserva.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              { deletedAt: null },
              {
                OR: [
                  { fechaAgenda: { lte: new Date(hasta) } },
                  { estado: 'COMPLETADA' },
                ],
              },
            ],
          },
          orderBy: { fechaAgenda: { sort: 'desc', nulls: 'last' } },
        })
      );
    });

    it('debería aplicar filtro por rango (desde y hasta)', async () => {
      (prisma.reserva.findMany as any).mockResolvedValue([]);
      (prisma.reserva.count as any).mockResolvedValue(0);

      const desde = '2025-01-01T00:00:00.000Z';
      const hasta = '2025-12-31T23:59:59.999Z';
      await getAllReservas({ desde, hasta });

      expect(prisma.reserva.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              { deletedAt: null },
              { fechaAgenda: { gte: new Date(desde), lte: new Date(hasta) } },
            ],
          },
          orderBy: { createdAt: 'desc' },
        })
      );
    });

    it('debería ordenar por parámetro sort válido (fechaAgenda)', async () => {
      (prisma.reserva.findMany as any).mockResolvedValue([]);
      (prisma.reserva.count as any).mockResolvedValue(0);

      await getAllReservas({ sort: 'fechaAgenda.asc' });

      expect(prisma.reserva.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { fechaAgenda: { sort: 'asc', nulls: 'last' } },
        })
      );
    });

    it('debería ordenar por parámetro sort válido (nombreTitular)', async () => {
      (prisma.reserva.findMany as any).mockResolvedValue([]);
      (prisma.reserva.count as any).mockResolvedValue(0);

      await getAllReservas({ sort: 'nombreTitular.asc' });

      expect(prisma.reserva.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { nombreTitular: 'asc' },
        })
      );
    });

    it('debería capturar errores y retornar un valor por defecto seguro', async () => {
      (prisma.reserva.findMany as any).mockRejectedValue(new Error('DB Error'));

      const result = await getAllReservas();

      expect(result.data).toEqual([]);
      expect(result.pagination).toEqual({
        page: 1,
        pageSize: 100,
        total: 0,
        totalPages: 0,
        hasMore: false,
      });
    });
  });

  describe('getReservaById', () => {
    it('debería buscar una reserva por id', async () => {
      (prisma.reserva.findFirst as any).mockResolvedValue({ id: 5 });

      const result = await getReservaById(5);

      expect(result).toEqual({ id: 5 });
      expect(prisma.reserva.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 5, deletedAt: null },
          include: expect.any(Object), // verifies include exists without being brittle to specific relation lists
        })
      );
    });
  });
});
