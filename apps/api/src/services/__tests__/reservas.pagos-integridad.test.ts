import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createReserva } from '../reservas/reservas.crud';
import { actualizarEstadoPasajerosReserva } from '../reservas/reservas.ciclo-vida';
import { updateEstadoVuelo } from '../vuelos/vuelos.lifecycle';

vi.mock('../../plugins/prisma', () => {
  return {
    prisma: {
      $transaction: vi.fn(),
      $queryRaw: vi.fn().mockResolvedValue([]),
      reserva: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      pago: {
        create: vi.fn(),
        aggregate: vi.fn(),
        count: vi.fn(),
      },
      vuelo: {
        findFirst: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
        groupBy: vi.fn(),
        updateMany: vi.fn(),
      },
      pasajero: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        create: vi.fn(),
      },
    },
  };
});

vi.mock('../eventos.service', () => ({
  broadcastDatos: vi.fn(),
}));

vi.mock('../google-calendar.service', () => ({
  googleCalendarService: {
    syncVueloCreated: vi.fn().mockResolvedValue(undefined),
    syncVueloUpdated: vi.fn().mockResolvedValue(undefined),
    syncVueloDeleted: vi.fn().mockResolvedValue(undefined),
    syncReservaVuelosDeleted: vi.fn().mockResolvedValue(undefined),
  },
}));

import { prisma } from '../../plugins/prisma';

describe('Integridad Contable: Historial de Pagos y Validación al Completar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('crearReserva auto-crea registro en Pago', () => {
    it('al crear reserva con abono > 0, incluye create en relación pagos', async () => {
      (prisma.reserva.create as any).mockResolvedValue({
        id: 101,
        numeroReserva: '26092201',
        valorTotal: 75000,
        abono: 30000,
        estadoPago: 'ABONADO',
        pagos: [{ id: 1, monto: 30000, metodoPago: 'TRANSFERENCIA' }],
      });

      const payload = {
        nombreTitular: 'Cliente Test Abono',
        email: 'test@abono.com',
        valorTotal: 75000,
        abono: 30000,
        metodoPago: 'TRANSFERENCIA' as const,
        notasPago: 'Depósito inicial',
      };

      const resultado = await createReserva(payload as any);

      expect(prisma.reserva.create).toHaveBeenCalledTimes(1);
      const callArgs = (prisma.reserva.create as any).mock.calls[0][0];

      expect(callArgs.data.abono).toBe(30000);
      expect(callArgs.data.pagos).toBeDefined();
      expect(callArgs.data.pagos.create).toEqual([
        expect.objectContaining({
          monto: 30000,
          metodoPago: 'TRANSFERENCIA',
          notas: 'Depósito inicial',
        }),
      ]);
      expect(resultado.abono).toBe(30000);
    });

    it('al crear reserva con abono = 0, no incluye pagos anidados', async () => {
      (prisma.reserva.create as any).mockResolvedValue({
        id: 102,
        numeroReserva: '26092202',
        valorTotal: 75000,
        abono: 0,
        estadoPago: 'PENDIENTE',
      });

      const payload = {
        nombreTitular: 'Cliente Sin Abono',
        valorTotal: 75000,
        abono: 0,
      };

      await createReserva(payload as any);

      const callArgs = (prisma.reserva.create as any).mock.calls[0][0];
      expect(callArgs.data.abono).toBe(0);
      expect(callArgs.data.pagos).toBeUndefined();
    });
  });

  describe('actualizarEstadoPasajerosReserva: validación estricta al completar', () => {
    it('rechaza completar reserva si valorTotal > 0 y no hay pagos en el historial', async () => {
      const mockTx = {
        reserva: {
          findFirst: vi.fn().mockResolvedValue({
            id: 201,
            version: 1,
            estado: 'AGENDADA',
            estadoPago: 'PENDIENTE',
            valorTotal: 80000,
            abono: 0,
            cerradaAt: null,
          }),
          update: vi.fn(),
        },
        pasajero: {
          findMany: vi.fn()
            .mockResolvedValueOnce([{ id: 1 }]) // validación de pertenencia
            .mockResolvedValueOnce([{ id: 1, estado: 'VUELO_COMPLETADO' }]), // estados finales
          update: vi.fn().mockResolvedValue({ id: 1, estado: 'VUELO_COMPLETADO' }),
        },
        vuelo: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        pago: {
          aggregate: vi.fn().mockResolvedValue({ _sum: { monto: null } }),
          count: vi.fn().mockResolvedValue(0),
        },
      };

      (prisma.$transaction as any).mockImplementation((cb: any) => cb(mockTx));

      await expect(
        actualizarEstadoPasajerosReserva(201, {
          version: 1,
          pasajeros: [{ id: 1, estado: 'VUELO_COMPLETADO' }],
        })
      ).rejects.toThrow(/saldo debe ser \$0 y debe existir respaldo en el historial de pagos/i);
    });

    it('permite completar reserva si valorTotal > 0 y pagos en historial cubren el total', async () => {
      const mockTx = {
        reserva: {
          findFirst: vi.fn().mockResolvedValue({
            id: 202,
            version: 1,
            estado: 'AGENDADA',
            estadoPago: 'PAGADO',
            valorTotal: 80000,
            abono: 80000,
            cerradaAt: null,
          }),
          update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 202, ...data })),
        },
        pasajero: {
          findMany: vi.fn()
            .mockResolvedValueOnce([{ id: 1 }])
            .mockResolvedValueOnce([{ id: 1, estado: 'VUELO_COMPLETADO' }]),
          update: vi.fn().mockResolvedValue({ id: 1, estado: 'VUELO_COMPLETADO' }),
        },
        vuelo: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        pago: {
          aggregate: vi.fn().mockResolvedValue({ _sum: { monto: 80000 } }),
          count: vi.fn().mockResolvedValue(1),
        },
      };

      (prisma.$transaction as any).mockImplementation((cb: any) => cb(mockTx));

      const res = await actualizarEstadoPasajerosReserva(202, {
        version: 1,
        pasajeros: [{ id: 1, estado: 'VUELO_COMPLETADO' }],
      });

      expect(res.estado).toBe('COMPLETADA');
    });

    it('permite completar reserva de cortesía con valorTotal = 0 sin requerir pagos', async () => {
      const mockTx = {
        reserva: {
          findFirst: vi.fn().mockResolvedValue({
            id: 203,
            version: 1,
            estado: 'AGENDADA',
            estadoPago: 'PENDIENTE',
            valorTotal: 0,
            abono: 0,
            cerradaAt: null,
          }),
          update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 203, ...data })),
        },
        pasajero: {
          findMany: vi.fn()
            .mockResolvedValueOnce([{ id: 1 }])
            .mockResolvedValueOnce([{ id: 1, estado: 'VUELO_COMPLETADO' }]),
          update: vi.fn().mockResolvedValue({ id: 1, estado: 'VUELO_COMPLETADO' }),
        },
        vuelo: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        pago: {
          aggregate: vi.fn(),
          count: vi.fn(),
        },
      };

      (prisma.$transaction as any).mockImplementation((cb: any) => cb(mockTx));

      const res = await actualizarEstadoPasajerosReserva(203, {
        version: 1,
        pasajeros: [{ id: 1, estado: 'VUELO_COMPLETADO' }],
      });

      expect(res.estado).toBe('COMPLETADA');
      expect(mockTx.pago.count).not.toHaveBeenCalled();
    });
  });

  describe('updateEstadoVuelo: auto-completado condicionado a historial', () => {
    it('no auto-completa la reserva si los vuelos terminan pero no hay historial de pagos', async () => {
      const mockTx = {
        vuelo: {
          findFirst: vi.fn().mockResolvedValue({
            id: 501,
            version: 1,
            estado: 'AGENDADO',
            pasajeroId: 10,
            reserva: { cerradaAt: null },
          }),
          update: vi.fn().mockResolvedValue({
            id: 501,
            estado: 'COMPLETADO',
            pasajeroId: 10,
          }),
          count: vi.fn()
            .mockResolvedValueOnce(1) // totalActivos
            .mockResolvedValueOnce(1), // completados
          groupBy: vi.fn().mockResolvedValue([{ pasajeroId: 10 }]),
        },
        pasajero: {
          update: vi.fn(),
          findUnique: vi.fn().mockResolvedValue({ id: 10, reservaId: 99 }),
          findMany: vi.fn().mockResolvedValue([{ id: 10 }]),
        },
        reserva: {
          findFirst: vi.fn().mockResolvedValue({
            id: 99,
            estado: 'AGENDADA',
            estadoPago: 'PAGADO',
            valorTotal: 75000,
          }),
          update: vi.fn(),
        },
        pago: {
          aggregate: vi.fn().mockResolvedValue({ _sum: { monto: null } }),
          count: vi.fn().mockResolvedValue(0),
        },
      };

      (prisma.$transaction as any).mockImplementation((cb: any) => cb(mockTx));

      const resultado = await updateEstadoVuelo(501, 'COMPLETADO', 1);

      expect(resultado.estado).toBe('COMPLETADO');
      expect(mockTx.reserva.update).not.toHaveBeenCalled();
    });

    it('auto-completa la reserva si los vuelos terminan y existe respaldo en historial de pagos', async () => {
      const mockTx = {
        vuelo: {
          findFirst: vi.fn().mockResolvedValue({
            id: 502,
            version: 1,
            estado: 'AGENDADO',
            pasajeroId: 10,
            reserva: { cerradaAt: null },
          }),
          update: vi.fn().mockResolvedValue({
            id: 502,
            estado: 'COMPLETADO',
            pasajeroId: 10,
          }),
          count: vi.fn()
            .mockResolvedValueOnce(1) // totalActivos
            .mockResolvedValueOnce(1), // completados
          groupBy: vi.fn().mockResolvedValue([{ pasajeroId: 10 }]),
        },
        pasajero: {
          update: vi.fn(),
          findUnique: vi.fn().mockResolvedValue({ id: 10, reservaId: 99 }),
          findMany: vi.fn().mockResolvedValue([{ id: 10 }]),
        },
        reserva: {
          findFirst: vi.fn().mockResolvedValue({
            id: 99,
            estado: 'AGENDADA',
            estadoPago: 'PAGADO',
            valorTotal: 75000,
          }),
          update: vi.fn().mockResolvedValue({ id: 99, estado: 'COMPLETADA' }),
        },
        pago: {
          aggregate: vi.fn().mockResolvedValue({ _sum: { monto: 75000 } }),
          count: vi.fn().mockResolvedValue(1),
        },
      };

      (prisma.$transaction as any).mockImplementation((cb: any) => cb(mockTx));

      const resultado = await updateEstadoVuelo(502, 'COMPLETADO', 1);

      expect(resultado.estado).toBe('COMPLETADO');
      expect(mockTx.reserva.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 99 },
          data: expect.objectContaining({ estado: 'COMPLETADA' }),
        })
      );
    });
  });
});
