import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GastosService } from '../gastos.service';

vi.mock('../../plugins/prisma', () => {
  return {
    prisma: {
      $transaction: vi.fn((cb) => cb({
        gasto: {
          findUnique: vi.fn(),
          update: vi.fn(),
        },
      })),
      gasto: {
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
      },
    },
  };
});

import { prisma } from '../../plugins/prisma';
import { ConflictError } from '../concurrencia.service';

describe('Gastos Service (Unit Tests)', () => {
  let service: GastosService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new GastosService();
  });

  it('delete debería lanzar ConflictError (409) si la version del gasto no coincide', async () => {
    const mockTx = {
      gasto: {
        findUnique: vi.fn().mockResolvedValue({ id: 1, version: 5, deletedAt: null }),
        update: vi.fn(),
      },
    };

    (prisma.$transaction as any).mockImplementation((cb: any) => cb(mockTx));

    await expect(service.delete(1, 3)).rejects.toThrow(ConflictError);

    // Verifica el statusCode mapeado por el controller a 409
    try {
      await service.delete(1, 3);
    } catch (error: any) {
      expect(error.statusCode).toBe(409);
    }

    expect(mockTx.gasto.update).not.toHaveBeenCalled();
  });

  it('delete con version coincidente debería hacer soft-delete e incrementar la version', async () => {
    const mockTx = {
      gasto: {
        findUnique: vi.fn().mockResolvedValue({ id: 1, version: 5, deletedAt: null }),
        update: vi.fn().mockResolvedValue({ id: 1, deletedAt: new Date(), version: 6 }),
      },
    };

    (prisma.$transaction as any).mockImplementation((cb: any) => cb(mockTx));

    await service.delete(1, 5);

    expect(mockTx.gasto.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({
          deletedAt: expect.any(Date),
          version: { increment: 1 },
        }),
      })
    );
  });

  it('delete debería lanzar error 404 ("Gasto no encontrado") si el gasto no existe', async () => {
    const mockTx = {
      gasto: {
        findUnique: vi.fn().mockResolvedValue(null),
        update: vi.fn(),
      },
    };

    (prisma.$transaction as any).mockImplementation((cb: any) => cb(mockTx));

    // Regresión (ADR 009): el error debe llevar statusCode 404 para que el
    // controller responda Not Found en vez de 500 genérico.
    let capturado: any;
    try {
      await service.delete(999, 5);
    } catch (e) {
      capturado = e;
    }
    expect(capturado.message).toBe('Gasto no encontrado');
    expect(capturado.statusCode).toBe(404);

    expect(mockTx.gasto.update).not.toHaveBeenCalled();
  });

  it('create debería delegar en prisma.gasto.create convirtiendo fecha a Date', async () => {
    (prisma.gasto.create as any).mockResolvedValue({
      id: 7,
      fecha: new Date('2026-08-25T12:00:00.000Z'),
      categoria: 'COMBUSTIBLE',
      monto: 1500,
    });

    await service.create({
      fecha: '2026-08-25T12:00:00.000Z',
      categoria: 'COMBUSTIBLE',
      monto: 1500,
      descripcion: 'Nafta de la camioneta',
    });

    expect(prisma.gasto.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fecha: expect.any(Date),
          categoria: 'COMBUSTIBLE',
          monto: 1500,
        }),
      })
    );
  });
});
