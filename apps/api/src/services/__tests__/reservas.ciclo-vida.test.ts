import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cerrarReservaContable } from '../reservas/reservas.ciclo-vida';
import { Prisma } from '@prisma/client';

// Mock Prisma
vi.mock('../../plugins/prisma', () => {
  const mockPrisma: any = {
    $transaction: vi.fn(async (cb) => {
      return cb(mockPrisma);
    }),
    $queryRaw: vi.fn().mockResolvedValue([]),
    reserva: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  };
  return { prisma: mockPrisma };
});

// Mock concurrencia
vi.mock('../concurrencia.service', () => ({
  checkVersion: vi.fn(),
}));

// Mock eventos
vi.mock('../eventos.service', () => ({
  broadcastDatos: vi.fn(),
}));

// Mock google calendar service
vi.mock('../google-calendar.service', () => ({
  googleCalendarService: {
    syncReservaVuelosDeleted: vi.fn().mockResolvedValue(null),
  },
}));

import { prisma } from '../../plugins/prisma';
import { broadcastDatos } from '../eventos.service';

describe('reservas.ciclo-vida - cerrarReservaContable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('debe cerrar correctamente una reserva completada y generar el snapshot', async () => {
    const mockReserva = {
      id: 1,
      numeroReserva: 'RES-001',
      nombreTitular: 'Juan Perez',
      rutDniTitular: '12345678-9',
      email: 'juan@example.com',
      telefono: '+56912345678',
      valorTotal: '50000',
      abono: '50000',
      montoDevuelto: '0',
      descuento: '0',
      estado: 'COMPLETADA',
      estadoPago: 'PAGADO',
      version: 1,
      cerradaAt: null,
      pasajeros: [
        { id: 10, nombre: 'Juan Perez', rutDni: '12345678-9', peso: 75, firmaDeslinde: true, estado: 'VUELO_COMPLETADO' }
      ],
      pagos: [
        { id: 20, monto: '50000', metodoPago: 'TRANSFERENCIA', fecha: new Date('2023-01-01T10:00:00Z') }
      ],
      devoluciones: [],
      vuelos: [{ id: 30, estado: 'COMPLETADO' }]
    };

    (prisma.reserva.findFirst as any).mockResolvedValue(mockReserva);
    (prisma.reserva.update as any).mockImplementation(({ data }) => Promise.resolve({ ...mockReserva, ...data }));

    const result = await cerrarReservaContable(1, 1);

    expect(prisma.reserva.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1, deletedAt: null }
      })
    );

    expect(prisma.reserva.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({
          cerradaAt: expect.any(Date),
          snapshotJson: expect.objectContaining({
            numeroReserva: 'RES-001',
            nombreTitular: 'Juan Perez',
            valorTotal: 50000,
            estado: 'COMPLETADA'
          }),
          version: { increment: 1 }
        })
      })
    );

    expect(broadcastDatos).toHaveBeenCalledWith('reserva', 'actualizar');
    expect(result.cerradaAt).toBeDefined();
    expect(result.snapshotJson).toBeDefined();
  });

  it('debe retornar la reserva sin cambios si ya esta cerrada', async () => {
    const mockReserva = {
      id: 2,
      cerradaAt: new Date(),
      estado: 'COMPLETADA',
      version: 1
    };

    (prisma.reserva.findFirst as any).mockResolvedValue(mockReserva);

    const result = await cerrarReservaContable(2, 1);

    expect(prisma.reserva.update).not.toHaveBeenCalled();
    expect(result).toEqual(mockReserva);
  });

  it('debe lanzar error si la reserva no existe', async () => {
    (prisma.reserva.findFirst as any).mockResolvedValue(null);

    await expect(cerrarReservaContable(999)).rejects.toThrow('Reserva no encontrada');
  });

  it('debe lanzar error si el estado no es COMPLETADA ni CANCELADA', async () => {
    const mockReserva = {
      id: 3,
      estado: 'AGENDADA',
      cerradaAt: null,
      version: 1
    };

    (prisma.reserva.findFirst as any).mockResolvedValue(mockReserva);

    await expect(cerrarReservaContable(3, 1)).rejects.toThrow('Solo se pueden cerrar contablemente reservas completadas o canceladas');
  });
});
