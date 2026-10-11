import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getReservaById } from '../reservas/reservas.query';
import { prisma } from '../../plugins/prisma';

vi.mock('../../plugins/prisma', () => {
  return {
    prisma: {
      reserva: {
        findFirst: vi.fn(),
      },
    },
  };
});

describe('Reservas Query - getReservaById', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('debería retornar una reserva por su ID con todas las relaciones incluidas y filtros de deletedAt: null', async () => {
    const mockReserva = { id: 1, nombreTitular: 'Prueba' };
    (prisma.reserva.findFirst as any).mockResolvedValue(mockReserva);

    const result = await getReservaById(1);

    expect(result).toEqual(mockReserva);
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
  });

  it('debería retornar null si la reserva no existe', async () => {
    (prisma.reserva.findFirst as any).mockResolvedValue(null);

    const result = await getReservaById(999);

    expect(result).toBeNull();
    expect(prisma.reserva.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 999, deletedAt: null },
      })
    );
  });
});
