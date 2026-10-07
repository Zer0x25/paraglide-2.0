import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReservasService } from '../reservas.service';
import { VuelosService } from '../vuelos.service';
import { Prisma } from '@prisma/client';

vi.mock('../../plugins/prisma', () => {
  const mockPrisma: any = {
    $transaction: vi.fn((cb) => cb(mockPrisma)),
    $queryRaw: vi.fn().mockResolvedValue([]),
    reserva: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    vuelo: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    pasajero: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    pago: {
      create: vi.fn(),
      aggregate: vi.fn(),
    },
    devolucion: {
      create: vi.fn(),
      aggregate: vi.fn(),
    },
    piloto: {
      findUnique: vi.fn().mockResolvedValue({ id: 1, tarifaPorVuelo: 15000 }),
    },
  };
  return { prisma: mockPrisma };
});

vi.mock('../vuelos/vuelos.matching', () => ({
  validateWeightAndConflict: vi.fn().mockResolvedValue(undefined),
  autoAssignVuelos: vi.fn().mockResolvedValue({}),
}));

vi.mock('../eventos.service', () => ({
  broadcastDatos: vi.fn(),
}));

vi.mock('../google-calendar.service', () => ({
  googleCalendarService: {
    syncVueloCreated: vi.fn().mockResolvedValue(null),
    syncVueloUpdated: vi.fn().mockResolvedValue(null),
    syncVueloDeleted: vi.fn().mockResolvedValue(null),
    syncReservaVuelosDeleted: vi.fn().mockResolvedValue(null),
  },
}));

import { prisma } from '../../plugins/prisma';

describe('Inmutabilidad y Guardrails de Reservas Cerradas (Fase 3)', () => {
  let reservasService: ReservasService;
  let vuelosService: VuelosService;

  beforeEach(() => {
    vi.clearAllMocks();
    reservasService = new ReservasService();
    vuelosService = new VuelosService();
  });

  it('updateReserva debe rechazar modificaciones si la reserva tiene cerradaAt', async () => {
    (prisma.reserva.findUnique as any).mockResolvedValue({
      id: 5,
      numeroReserva: '26091401',
      cerradaAt: new Date('2026-09-01'),
      estado: 'COMPLETADA',
      version: 2,
    });

    await expect(
      reservasService.update(5, { nombreTitular: 'Intento de Cambio' })
    ).rejects.toThrow(/cerrada contablemente/i);
  });

  it('addPago debe rechazar pagos en una reserva cerrada contablemente', async () => {
    (prisma.reserva.findUnique as any).mockResolvedValue({
      id: 5,
      numeroReserva: '26091401',
      cerradaAt: new Date('2026-09-01'),
      estado: 'COMPLETADA',
      version: 2,
    });

    await expect(
      reservasService.addPago(5, { monto: 10000, metodoPago: 'EFECTIVO' })
    ).rejects.toThrow(/cerrada contablemente/i);
  });

  it('cancelar debe rechazar la cancelación si la reserva ya está cerrada contablemente', async () => {
    (prisma.reserva.findFirst as any).mockResolvedValue({
      id: 5,
      cerradaAt: new Date('2026-09-01'),
      estado: 'COMPLETADA',
      version: 2,
    });

    await expect(
      reservasService.cancelar(5, { motivo: 'Cancelación tardía' })
    ).rejects.toThrow(/cerrada contablemente/i);
  });

  it('deleteReserva debe rechazar el borrado de una reserva cerrada', async () => {
    (prisma.reserva.findFirst as any).mockResolvedValue({
      id: 5,
      cerradaAt: new Date('2026-09-01'),
      estado: 'COMPLETADA',
      version: 2,
    });

    await expect(reservasService.delete(5)).rejects.toThrow(/cerrada contablemente/i);
  });

  it('cerrarContable genera snapshotJson y estampa cerradaAt', async () => {
    const mockReserva = {
      id: 10,
      numeroReserva: '26091001',
      nombreTitular: 'Juan Perez',
      rutDniTitular: '12345678-9',
      email: 'juan@test.cl',
      telefono: '+56911111111',
      valorTotal: 75000,
      abono: 75000,
      montoDevuelto: 0,
      descuento: 0,
      estado: 'COMPLETADA',
      estadoPago: 'PAGADO',
      version: 3,
      cerradaAt: null,
      pasajeros: [{ id: 1, nombre: 'Juan Perez', rutDni: '12345678-9', peso: 75, firmaDeslinde: true, estado: 'VUELO_COMPLETADO' }],
      pagos: [{ id: 20, monto: 75000, metodoPago: 'TRANSFERENCIA', fecha: new Date() }],
      devoluciones: [],
      vuelos: [{ id: 30, estado: 'COMPLETADO' }],
    };

    (prisma.reserva.findFirst as any).mockResolvedValue(mockReserva);
    (prisma.reserva.update as any).mockImplementation(({ data }) => Promise.resolve({ ...mockReserva, ...data }));

    const cerrada = await reservasService.cerrarContable(10, 3);

    expect(prisma.reserva.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 10 },
        data: expect.objectContaining({
          cerradaAt: expect.any(Date),
          snapshotJson: expect.objectContaining({
            numeroReserva: '26091001',
            nombreTitular: 'Juan Perez',
            valorTotal: 75000,
            abono: 75000,
            estado: 'COMPLETADA',
          }),
        }),
      })
    );
    expect(cerrada.cerradaAt).toBeDefined();
  });

  it('cerrarContable rechaza reservas en estado AGENDADA o SIN_AGENDAR', async () => {
    (prisma.reserva.findFirst as any).mockResolvedValue({
      id: 11,
      estado: 'AGENDADA',
      cerradaAt: null,
      version: 1,
    });

    await expect(reservasService.cerrarContable(11)).rejects.toThrow(/Solo se pueden cerrar contablemente reservas completadas o canceladas/i);
  });

  it('reabrirContable exige motivo de auditoría y retira cerradaAt', async () => {
    const mockReserva = {
      id: 12,
      cerradaAt: new Date(),
      snapshotJson: { some: 'snapshot' },
      version: 4,
    };

    (prisma.reserva.findFirst as any).mockResolvedValue(mockReserva);
    (prisma.reserva.update as any).mockImplementation(({ data }) => Promise.resolve({ ...mockReserva, ...data }));

    await expect(reservasService.reabrirContable(12, '')).rejects.toThrow(/motivo de reapertura es obligatorio/i);

    const reabierta = await reservasService.reabrirContable(12, 'Ajuste contable solicitado por tesorería', 4);

    expect(prisma.reserva.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 12 },
        data: expect.objectContaining({
          cerradaAt: null,
          snapshotJson: Prisma.DbNull,
        }),
      })
    );
    expect(reabierta.cerradaAt).toBeNull();
  });

  it('vuelosService.update rechaza modificar vuelo de reserva cerrada', async () => {
    (prisma.vuelo.findUnique as any).mockResolvedValue({
      id: 99,
      version: 1,
      reserva: { cerradaAt: new Date() },
    });

    await expect(
      vuelosService.update(99, {
        fechaHora: '2026-09-14T15:00:00.000Z',
        pilotoId: 1,
        pasajeroId: 1,
        valorPactado: 75000,
      })
    ).rejects.toThrow(/cerrada contablemente/i);
  });

  it('vuelosService.delete rechaza eliminar vuelo de reserva cerrada', async () => {
    (prisma.vuelo.findUnique as any).mockResolvedValue({
      id: 99,
      version: 1,
      pasajero: { reservaId: 10 },
      reserva: { cerradaAt: new Date() },
    });

    await expect(vuelosService.delete(99)).rejects.toThrow(/cerrada contablemente/i);
  });

  it('tickCierreContable busca y congela reservas completadas con más de 7 días', async () => {
    const { tickCierreContable } = await import('../cierreContableScheduler.service');

    (prisma.reserva.findMany as any).mockResolvedValue([
      { id: 101, version: 1, numeroReserva: '26090101' },
      { id: 102, version: 2, numeroReserva: '26090102' },
    ]);

    const mockReservaDetalle = {
      id: 101,
      numeroReserva: '26090101',
      valorTotal: 50000,
      abono: 50000,
      montoDevuelto: 0,
      descuento: 0,
      estado: 'COMPLETADA',
      estadoPago: 'PAGADO',
      version: 1,
      cerradaAt: null,
      pasajeros: [],
      pagos: [],
      devoluciones: [],
      vuelos: [],
    };

    (prisma.reserva.findFirst as any).mockImplementation(({ where }: any) => {
      return Promise.resolve({
        ...mockReservaDetalle,
        id: where.id,
        version: where.id === 102 ? 2 : 1,
      });
    });
    (prisma.reserva.update as any).mockImplementation(({ data }) => Promise.resolve({ ...mockReservaDetalle, ...data }));

    const cerradas = await tickCierreContable();

    expect(prisma.reserva.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          cerradaAt: null,
          estado: { in: ['COMPLETADA', 'CANCELADA'] },
        }),
      })
    );
    expect(cerradas).toBe(2);
  });
});
