import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  actualizarEstadoPasajerosReserva,
} from '../reservas/reservas.ciclo-vida';
import { prisma } from '../../plugins/prisma';
import { broadcastDatos } from '../eventos.service';
import { checkVersion } from '../concurrencia.service';

vi.mock('../../plugins/prisma', () => {
  return {
    prisma: {
      $transaction: vi.fn((cb) => cb({
        $queryRaw: vi.fn(),
        reserva: {
          findFirst: vi.fn(),
          update: vi.fn(),
        },
        pasajero: {
          findMany: vi.fn(),
          update: vi.fn(),
        },
        vuelo: {
          updateMany: vi.fn(),
        },
        pago: {
          aggregate: vi.fn(),
          count: vi.fn(),
        },
      })),
    },
  };
});

vi.mock('../eventos.service', () => ({
  broadcastDatos: vi.fn(),
}));

vi.mock('../concurrencia.service', () => ({
  checkVersion: vi.fn(),
}));

vi.mock('../google-calendar.service', () => ({
  googleCalendarService: {
    syncReservaVuelosDeleted: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock dependencias the function uses for deriving states
vi.mock('@parapente/shared', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as any),
    derivarEstadoReservaPorPasajeros: vi.fn().mockReturnValue('COMPLETADA'), // Or we test it implicitly if we don't mock it
  };
});


describe('actualizarEstadoPasajerosReserva', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('debería fallar si la reserva no se encuentra', async () => {
    const mockTx = {
      $queryRaw: vi.fn(),
      reserva: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };

    (prisma.$transaction as any).mockImplementation(async (cb: any) => cb(mockTx));

    await expect(
      actualizarEstadoPasajerosReserva(1, { pasajeros: [{ id: 1, estado: 'VUELO_COMPLETADO' }] })
    ).rejects.toThrow('Reserva no encontrada');
  });

  it('debería fallar si la reserva está cerrada contablemente', async () => {
    const mockTx = {
      $queryRaw: vi.fn(),
      reserva: {
        findFirst: vi.fn().mockResolvedValue({ id: 1, cerradaAt: new Date() }),
      },
    };

    (prisma.$transaction as any).mockImplementation(async (cb: any) => cb(mockTx));

    await expect(
      actualizarEstadoPasajerosReserva(1, { pasajeros: [{ id: 1, estado: 'VUELO_COMPLETADO' }] })
    ).rejects.toThrow('No se pueden modificar los pasajeros de una reserva cerrada contablemente');
  });

  it('debería fallar si la reserva ya está CANCELADA o COMPLETADA', async () => {
    const mockTx = {
      $queryRaw: vi.fn(),
      reserva: {
        findFirst: vi.fn().mockResolvedValue({ id: 1, estado: 'CANCELADA' }),
      },
    };

    (prisma.$transaction as any).mockImplementation(async (cb: any) => cb(mockTx));

    await expect(
      actualizarEstadoPasajerosReserva(1, { pasajeros: [{ id: 1, estado: 'VUELO_COMPLETADO' }] })
    ).rejects.toThrow('No se puede marcar el estado de vuelo de una reserva cancelada o completada');
  });

  it('debería llamar a checkVersion con las versiones correctas', async () => {
     const mockTx = {
      $queryRaw: vi.fn(),
      reserva: {
        findFirst: vi.fn().mockResolvedValue({ id: 1, version: 5, estado: 'CONFIRMADA' }),
      },
      pasajero: {
         findMany: vi.fn().mockResolvedValue([{ id: 10 }]),
      }
    };

    (prisma.$transaction as any).mockImplementation(async (cb: any) => {
        try {
            await cb(mockTx);
        } catch(e) {
            // expected to throw Uno o más pasajeros no pertenecen a la reserva or continue if mocked enough
        }
    });

    try {
        await actualizarEstadoPasajerosReserva(1, { version: 4, pasajeros: [{ id: 10, estado: 'VUELO_COMPLETADO' }] });
    } catch(e) {}

    expect(checkVersion).toHaveBeenCalledWith(5, 4, expect.any(String));
  });

  it('debería fallar si los pasajeros proporcionados no pertenecen a la reserva', async () => {
    const mockTx = {
      $queryRaw: vi.fn(),
      reserva: {
        findFirst: vi.fn().mockResolvedValue({ id: 1, version: 1, estado: 'CONFIRMADA' }),
      },
      pasajero: {
        findMany: vi.fn().mockResolvedValue([{ id: 10 }]), // Return only 1 of 2
      },
    };

    (prisma.$transaction as any).mockImplementation(async (cb: any) => cb(mockTx));

    await expect(
      actualizarEstadoPasajerosReserva(1, {
        version: 1,
        pasajeros: [{ id: 10, estado: 'VUELO_COMPLETADO' }, { id: 11, estado: 'CANCELADO' }]
      })
    ).rejects.toThrow('Uno o más pasajeros no pertenecen a la reserva');
  });

  it('debería actualizar exitosamente el estado de los pasajeros, sincronizar vuelos y notificar', async () => {
    const mockTx = {
      $queryRaw: vi.fn(),
      reserva: {
        findFirst: vi.fn().mockResolvedValue({
            id: 1, version: 1, estado: 'CONFIRMADA', valorTotal: 0, estadoPago: 'PAGADO'
        }),
        update: vi.fn().mockResolvedValue({ id: 1, estado: 'CONFIRMADA' }),
      },
      pasajero: {
        findMany: vi.fn()
           // First call: check belonging
           .mockResolvedValueOnce([{ id: 10 }, { id: 11 }])
           // Second call: check final states for derivations
           .mockResolvedValueOnce([{ estado: 'VUELO_COMPLETADO' }, { estado: 'POR_VOLAR' }]),
        update: vi.fn(),
      },
      vuelo: {
        updateMany: vi.fn(),
      },
      pago: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { monto: 0 } }),
        count: vi.fn().mockResolvedValue(0),
      }
    };

    (prisma.$transaction as any).mockImplementation(async (cb: any) => cb(mockTx));

    const data = {
      version: 1,
      pasajeros: [
        { id: 10, estado: 'VUELO_COMPLETADO' as const },
        { id: 11, estado: 'CANCELADO' as const }
      ]
    };

    const res = await actualizarEstadoPasajerosReserva(1, data);

    // Assertions
    expect(mockTx.pasajero.update).toHaveBeenCalledTimes(2);
    expect(mockTx.pasajero.update).toHaveBeenCalledWith({ where: { id: 10 }, data: { estado: 'VUELO_COMPLETADO' } });
    expect(mockTx.pasajero.update).toHaveBeenCalledWith({ where: { id: 11 }, data: { estado: 'CANCELADO' } });

    expect(mockTx.vuelo.updateMany).toHaveBeenCalledWith({
      where: {
        pasajeroId: { in: [10] },
        deletedAt: null,
        estado: { not: 'CANCELADO' },
      },
      data: { estado: 'COMPLETADO', version: { increment: 1 } },
    });

    expect(mockTx.vuelo.updateMany).toHaveBeenCalledWith({
        where: {
          pasajeroId: { in: [11] },
          deletedAt: null,
          estado: { not: 'COMPLETADO' },
        },
        data: { estado: 'CANCELADO', version: { increment: 1 } },
    });

    expect(mockTx.reserva.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({ version: { increment: 1 } }),
      include: expect.any(Object),
    });

    expect(broadcastDatos).toHaveBeenCalledWith('vuelo', 'actualizar');
    expect(broadcastDatos).toHaveBeenCalledWith('reserva', 'actualizar');
  });

  it('debería fallar si todos volaron pero hay un saldo pendiente sin respaldo', async () => {
    const mockTx = {
      $queryRaw: vi.fn(),
      reserva: {
        findFirst: vi.fn().mockResolvedValue({
            id: 1, version: 1, estado: 'CONFIRMADA', valorTotal: 10000, estadoPago: 'ABONADO'
        }),
      },
      pasajero: {
        findMany: vi.fn()
           // First call: check belonging
           .mockResolvedValueOnce([{ id: 10 }])
           // Second call: check final states for derivations
           .mockResolvedValueOnce([{ estado: 'VUELO_COMPLETADO' }]),
        update: vi.fn(),
      },
      vuelo: {
        updateMany: vi.fn(),
      },
      pago: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { monto: 5000 } }), // Saldo 5000
        count: vi.fn().mockResolvedValue(1),
      }
    };

    (prisma.$transaction as any).mockImplementation(async (cb: any) => cb(mockTx));

    await expect(
        actualizarEstadoPasajerosReserva(1, { pasajeros: [{ id: 10, estado: 'VUELO_COMPLETADO' }] })
    ).rejects.toThrow('No se puede completar la reserva: el saldo debe ser $0 y debe existir respaldo en el historial de pagos');
  });
});
