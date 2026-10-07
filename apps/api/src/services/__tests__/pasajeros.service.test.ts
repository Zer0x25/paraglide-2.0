import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PasajerosService } from '../pasajeros.service';

vi.mock('../../plugins/prisma', () => {
  return {
    prisma: {
      pasajero: {
        findMany: vi.fn(),
        count: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      deslindeFirma: {
        upsert: vi.fn(),
      },
      $transaction: vi.fn((cb) => cb({
        pasajero: {
          findFirst: vi.fn(),
          update: vi.fn(),
        },
        deslindeFirma: {
          upsert: vi.fn(),
        },
      })),
    },
  };
});

import { prisma } from '../../plugins/prisma';

describe('PasajerosService', () => {
  let service: PasajerosService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PasajerosService();
  });

  describe('getAll', () => {
    it('debe llamar a findMany y count con opciones base cuando no hay filtros', async () => {
      (prisma.pasajero.findMany as any).mockResolvedValue([{ id: 1, nombre: 'Test Pax' }]);
      (prisma.pasajero.count as any).mockResolvedValue(1);

      const result = await service.getAll({});

      expect(prisma.pasajero.findMany).toHaveBeenCalledWith({
        where: { deletedAt: null },
        include: { vuelos: true, reserva: true },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 100,
      });
      expect(prisma.pasajero.count).toHaveBeenCalledWith({
        where: { deletedAt: null },
      });
      expect(result.data).toEqual([{ id: 1, nombre: 'Test Pax' }]);
      expect(result.pagination.total).toBe(1);
    });

    it('debe agregar condiciones OR si se provee el filtro de búsqueda "q"', async () => {
      (prisma.pasajero.findMany as any).mockResolvedValue([]);
      (prisma.pasajero.count as any).mockResolvedValue(0);

      await service.getAll({ q: 'Juan' });

      const expectedWhere = {
        deletedAt: null,
        OR: [
          { nombre: { contains: 'Juan', mode: 'insensitive' } },
          { rutDni: { contains: 'Juan', mode: 'insensitive' } },
        ],
      };

      expect(prisma.pasajero.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expectedWhere,
        })
      );
      expect(prisma.pasajero.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expectedWhere,
        })
      );
    });
  });

  describe('getById', () => {
    it('debe retornar un pasajero si es encontrado y deletedAt es null', async () => {
      const mockPax = { id: 10, nombre: 'Jane Doe' };
      (prisma.pasajero.findUnique as any).mockResolvedValue(mockPax);

      const result = await service.getById(10);

      expect(prisma.pasajero.findUnique).toHaveBeenCalledWith({
        where: { id: 10, deletedAt: null },
        include: { vuelos: { where: { deletedAt: null } }, reserva: true },
      });
      expect(result).toEqual(mockPax);
    });

    it('debe retornar null si no se encuentra el pasajero', async () => {
      (prisma.pasajero.findUnique as any).mockResolvedValue(null);

      const result = await service.getById(99);

      expect(result).toBeNull();
    });
  });
});
