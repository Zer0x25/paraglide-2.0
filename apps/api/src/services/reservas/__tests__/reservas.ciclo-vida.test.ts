import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reabrirReservaContable } from '../reservas.ciclo-vida';
import { Prisma } from '@prisma/client';
import { ConflictError } from '../../concurrencia.service';

vi.mock('../../../plugins/prisma', () => {
  const mockPrisma: any = {
    $transaction: vi.fn((cb) => cb(mockPrisma)),
    $queryRaw: vi.fn().mockResolvedValue([]),
    reserva: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  };
  return { prisma: mockPrisma };
});

vi.mock('../../eventos.service', () => ({
  broadcastDatos: vi.fn(),
}));

import { prisma } from '../../../plugins/prisma';
import { broadcastDatos } from '../../eventos.service';

describe('reservas.ciclo-vida - reabrirReservaContable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('debe rechazar si el motivo está vacío', async () => {
    await expect(reabrirReservaContable(1, '')).rejects.toThrow(/motivo de reapertura es obligatorio/i);
    await expect(reabrirReservaContable(1, '   ')).rejects.toThrow(/motivo de reapertura es obligatorio/i);
  });

  it('debe lanzar error si la reserva no es encontrada', async () => {
    (prisma.reserva.findFirst as any).mockResolvedValue(null);

    await expect(reabrirReservaContable(1, 'Motivo válido')).rejects.toThrow(/Reserva no encontrada/i);
  });

  it('debe lanzar ConflictError si la versión no coincide', async () => {
    (prisma.reserva.findFirst as any).mockResolvedValue({
      id: 1,
      version: 2,
      cerradaAt: new Date(),
    });

    await expect(reabrirReservaContable(1, 'Motivo válido', 1)).rejects.toThrow(ConflictError);
  });

  it('debe lanzar error si la reserva no está cerrada contablemente', async () => {
    (prisma.reserva.findFirst as any).mockResolvedValue({
      id: 1,
      version: 2,
      cerradaAt: null, // No cerrada
    });

    await expect(reabrirReservaContable(1, 'Motivo válido')).rejects.toThrow(/La reserva no está cerrada contablemente/i);
  });

  it('debe reabrir exitosamente, quitar cerradaAt, resetear snapshotJson e incrementar versión', async () => {
    const mockReserva = {
      id: 1,
      version: 2,
      cerradaAt: new Date(),
    };

    const mockReabierta = {
      ...mockReserva,
      cerradaAt: null,
      snapshotJson: Prisma.DbNull,
      version: 3,
    };

    (prisma.reserva.findFirst as any).mockResolvedValue(mockReserva);
    (prisma.reserva.update as any).mockResolvedValue(mockReabierta);

    const result = await reabrirReservaContable(1, 'Motivo válido auditoría', 2);

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.reserva.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1, deletedAt: null },
      })
    );
    expect(prisma.reserva.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({
          cerradaAt: null,
          snapshotJson: Prisma.DbNull,
          version: { increment: 1 },
        }),
      })
    );
    expect(broadcastDatos).toHaveBeenCalledWith('reserva', 'actualizar');
    expect(result).toEqual(mockReabierta);
  });
});
