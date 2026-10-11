import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cancelarReserva } from '../reservas/reservas.ciclo-vida';
import { prisma } from '../../plugins/prisma';
import { checkVersion } from '../concurrencia.service';
import { broadcastDatos } from '../eventos.service';
import { googleCalendarService } from '../google-calendar.service';

vi.mock('../../plugins/prisma', () => {
  const mockTx = {
    $queryRaw: vi.fn(),
    reserva: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    vuelo: {
      updateMany: vi.fn(),
    },
    pasajero: {
      updateMany: vi.fn(),
    },
    devolucion: {
      create: vi.fn(),
      aggregate: vi.fn(),
    },
    pago: {
      aggregate: vi.fn(),
    },
  };

  return {
    prisma: {
      $transaction: vi.fn(async (cb) => cb(mockTx)),
    },
    mockTx,
  };
});

vi.mock('../concurrencia.service', () => ({
  checkVersion: vi.fn(),
}));

vi.mock('../eventos.service', () => ({
  broadcastDatos: vi.fn(),
}));

vi.mock('../google-calendar.service', () => ({
  googleCalendarService: {
    syncReservaVuelosDeleted: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('Reservas Ciclo Vida - cancelarReserva', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('debe cancelar exitosamente una reserva (happy path)', async () => {
    let capturedTx: any;
    (prisma.$transaction as any).mockImplementationOnce(async (cb: any) => {
      capturedTx = {
        $queryRaw: vi.fn(),
        reserva: {
          findFirst: vi.fn().mockResolvedValue({
            id: 1,
            version: 1,
            estado: 'AGENDADA',
            estadoPago: 'PENDIENTE',
            pasajeros: [{ id: 10 }, { id: 11 }],
          }),
          update: vi.fn().mockResolvedValue({
            id: 1,
            estado: 'CANCELADA',
          }),
        },
        vuelo: {
          updateMany: vi.fn(),
        },
        pasajero: {
          updateMany: vi.fn(),
        },
        devolucion: {
          create: vi.fn(),
          aggregate: vi.fn(),
        },
        pago: {
          aggregate: vi.fn(),
        },
      };
      return cb(capturedTx);
    });

    const result = await cancelarReserva(1, { motivo: 'Motivo de prueba', version: 1 });

    expect(capturedTx.reserva.findFirst).toHaveBeenCalledWith({
      where: { id: 1, deletedAt: null },
      include: expect.any(Object),
    });

    expect(capturedTx.vuelo.updateMany).toHaveBeenCalledWith({
      where: { reservaId: 1, deletedAt: null, estado: { not: 'COMPLETADO' } },
      data: { estado: 'CANCELADO', deletedAt: expect.any(Date), version: { increment: 1 } },
    });

    expect(capturedTx.pasajero.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [10, 11] }, deletedAt: null, estado: { not: 'VUELO_COMPLETADO' } },
      data: { estado: 'CANCELADO' },
    });

    expect(capturedTx.reserva.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        estado: 'CANCELADA',
        motivoCancelacion: 'Motivo de prueba',
        fechaCancelacion: expect.any(Date),
      }),
      include: expect.any(Object),
    });

    expect(checkVersion).toHaveBeenCalledWith(1, 1, expect.any(String));
    expect(broadcastDatos).toHaveBeenCalledWith('vuelo', 'actualizar');
    expect(googleCalendarService.syncReservaVuelosDeleted).toHaveBeenCalledWith(1);
    expect(result.estado).toBe('CANCELADA');
  });

  it('debe cancelar y generar devolucion si se envía en el payload', async () => {
    let capturedTx: any;
    (prisma.$transaction as any).mockImplementationOnce(async (cb: any) => {
      capturedTx = {
        $queryRaw: vi.fn(),
        reserva: {
          findFirst: vi.fn().mockResolvedValue({
            id: 2,
            version: 1,
            estado: 'AGENDADA',
            estadoPago: 'PAGADO',
            valorTotal: 50000,
            montoDevuelto: 0,
            pasajeros: [],
          }),
          update: vi.fn().mockResolvedValue({
            id: 2,
            estado: 'CANCELADA',
            estadoPago: 'DEVUELTO',
            montoDevuelto: 50000,
          }),
        },
        vuelo: {
          updateMany: vi.fn(),
        },
        pasajero: {
          updateMany: vi.fn(),
        },
        devolucion: {
          create: vi.fn().mockResolvedValue({ id: 100 }),
          aggregate: vi.fn().mockResolvedValue({ _sum: { monto: 0 } }),
        },
        pago: {
          aggregate: vi.fn().mockResolvedValue({ _sum: { monto: 50000 } }),
        },
      };
      return cb(capturedTx);
    });

    const result = await cancelarReserva(2, {
      motivo: 'Reembolso por mal tiempo',
      version: 1,
      devolucion: {
        monto: 50000,
        metodoPago: 'EFECTIVO',
      },
    });

    expect(capturedTx.devolucion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        reservaId: 2,
        monto: 50000,
        metodoPago: 'EFECTIVO',
      }),
    });

    expect(capturedTx.reserva.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: expect.objectContaining({
        estado: 'CANCELADA',
        montoDevuelto: 50000,
        estadoPago: 'DEVUELTO',
      }),
      include: expect.any(Object),
    });

    expect(result.estado).toBe('CANCELADA');
  });

  it('debe arrojar error si la devolución supera lo pagado', async () => {
    let capturedTx: any;
    (prisma.$transaction as any).mockImplementationOnce(async (cb: any) => {
      capturedTx = {
        $queryRaw: vi.fn(),
        reserva: {
          findFirst: vi.fn().mockResolvedValue({
            id: 3,
            version: 1,
            estado: 'AGENDADA',
            estadoPago: 'PAGADO',
            valorTotal: 50000,
            montoDevuelto: 0,
            pasajeros: [],
          }),
        },
        vuelo: {
          updateMany: vi.fn(),
        },
        pasajero: {
          updateMany: vi.fn(),
        },
        devolucion: {
          aggregate: vi.fn().mockResolvedValue({ _sum: { monto: 0 } }),
        },
        pago: {
          aggregate: vi.fn().mockResolvedValue({ _sum: { monto: 30000 } }), // Pagado solo 30000
        },
      };
      return cb(capturedTx);
    });

    await expect(cancelarReserva(3, {
      motivo: 'Reembolso por mal tiempo',
      version: 1,
      devolucion: {
        monto: 50000, // Intentando devolver 50000
        metodoPago: 'EFECTIVO',
      },
    })).rejects.toThrow('No se puede devolver más de lo pagado');
  });

  it('debe arrojar error si la reserva está cerrada contablemente', async () => {
    let capturedTx: any;
    (prisma.$transaction as any).mockImplementationOnce(async (cb: any) => {
      capturedTx = {
        $queryRaw: vi.fn(),
        reserva: {
          findFirst: vi.fn().mockResolvedValue({
            id: 4,
            version: 1,
            cerradaAt: new Date(),
            estado: 'AGENDADA',
            pasajeros: [],
          }),
        },
      };
      return cb(capturedTx);
    });

    await expect(cancelarReserva(4, {
      motivo: 'Motivo',
      version: 1,
    })).rejects.toThrow('No se puede cancelar una reserva cerrada contablemente');
  });

  it('debe arrojar error si la reserva ya está finalizada (CANCELADA o COMPLETADA)', async () => {
    let capturedTx: any;
    (prisma.$transaction as any).mockImplementationOnce(async (cb: any) => {
      capturedTx = {
        $queryRaw: vi.fn(),
        reserva: {
          findFirst: vi.fn().mockResolvedValue({
            id: 5,
            version: 1,
            estado: 'COMPLETADA',
            pasajeros: [],
          }),
        },
      };
      return cb(capturedTx);
    });

    await expect(cancelarReserva(5, {
      motivo: 'Motivo',
      version: 1,
    })).rejects.toThrow('Reserva ya finalizada');
  });
});
