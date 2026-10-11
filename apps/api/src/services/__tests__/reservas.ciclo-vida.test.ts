import { describe, it, expect, vi, beforeEach } from 'vitest';
import { actualizarEstadoPasajerosReserva } from '../reservas/reservas.ciclo-vida';
import { prisma } from '../../plugins/prisma';
import { checkVersion } from '../concurrencia.service';

vi.mock('../../plugins/prisma', () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

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

describe('Reservas Ciclo Vida', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('actualizarEstadoPasajerosReserva', () => {
    it('Lanza error si la reserva no es encontrada', async () => {
      const mockTx = {
        $queryRaw: vi.fn(),
        reserva: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      };
      (prisma.$transaction as any).mockImplementation(async (cb: any) => cb(mockTx));

      await expect(
        actualizarEstadoPasajerosReserva(1, { pasajeros: [] })
      ).rejects.toThrow('Reserva no encontrada');
    });

    it('Lanza error si la reserva ya está cerrada contablemente', async () => {
      const mockTx = {
        $queryRaw: vi.fn(),
        reserva: {
          findFirst: vi.fn().mockResolvedValue({
            id: 1,
            cerradaAt: new Date(),
          }),
        },
      };
      (prisma.$transaction as any).mockImplementation(async (cb: any) => cb(mockTx));

      await expect(
        actualizarEstadoPasajerosReserva(1, { pasajeros: [] })
      ).rejects.toThrow('No se pueden modificar los pasajeros de una reserva cerrada contablemente');
    });

    it('Lanza error si el estado de la reserva es CANCELADA', async () => {
      const mockTx = {
        $queryRaw: vi.fn(),
        reserva: {
          findFirst: vi.fn().mockResolvedValue({
            id: 1,
            cerradaAt: null,
            estado: 'CANCELADA',
          }),
        },
      };
      (prisma.$transaction as any).mockImplementation(async (cb: any) => cb(mockTx));

      await expect(
        actualizarEstadoPasajerosReserva(1, { pasajeros: [] })
      ).rejects.toThrow('No se puede marcar el estado de vuelo de una reserva cancelada o completada');
    });

    it('Lanza error si el estado de la reserva es COMPLETADA', async () => {
      const mockTx = {
        $queryRaw: vi.fn(),
        reserva: {
          findFirst: vi.fn().mockResolvedValue({
            id: 1,
            cerradaAt: null,
            estado: 'COMPLETADA',
          }),
        },
      };
      (prisma.$transaction as any).mockImplementation(async (cb: any) => cb(mockTx));

      await expect(
        actualizarEstadoPasajerosReserva(1, { pasajeros: [] })
      ).rejects.toThrow('No se puede marcar el estado de vuelo de una reserva cancelada o completada');
    });

    it('Lanza error si falla la validación de pertenencia de pasajeros', async () => {
      const mockTx = {
        $queryRaw: vi.fn(),
        reserva: {
          findFirst: vi.fn().mockResolvedValue({
            id: 1,
            cerradaAt: null,
            estado: 'AGENDADA',
            version: 1,
          }),
        },
        pasajero: {
          findMany: vi.fn().mockResolvedValue([{ id: 1 }]), // Solo devuelve 1 pasajero pero pedimos 2
        },
      };
      (prisma.$transaction as any).mockImplementation(async (cb: any) => cb(mockTx));

      await expect(
        actualizarEstadoPasajerosReserva(1, {
          version: 1,
          pasajeros: [
            { id: 1, estado: 'POR_VOLAR' },
            { id: 2, estado: 'POR_VOLAR' },
          ],
        })
      ).rejects.toThrow('Uno o más pasajeros no pertenecen a la reserva');
    });

    it('Llama a checkVersion con las versiones correctas', async () => {
      const mockTx = {
        $queryRaw: vi.fn(),
        reserva: {
          findFirst: vi.fn().mockResolvedValue({
            id: 1,
            cerradaAt: null,
            estado: 'AGENDADA',
            version: 5,
          }),
        },
        pasajero: {
          findMany: vi.fn().mockResolvedValue([{ id: 1 }]),
          update: vi.fn(),
        },
        vuelo: { updateMany: vi.fn() },
      };
      (prisma.$transaction as any).mockImplementation(async (cb: any) => cb(mockTx));
      (checkVersion as any).mockImplementationOnce(() => {
        throw new Error('Version mismatch');
      });

      await expect(
        actualizarEstadoPasajerosReserva(1, {
          version: 2, // Intentional mismatch to test exception thrown by checkVersion
          pasajeros: [{ id: 1, estado: 'POR_VOLAR' }],
        })
      ).rejects.toThrow('Version mismatch');

      expect(checkVersion).toHaveBeenCalledWith(
        5,
        2,
        'La reserva cambió en otro dispositivo. Recarga e intenta de nuevo.'
      );
    });

    it('Actualiza correctamente los pasajeros y sincroniza el estado de los vuelos a COMPLETADO y CANCELADO', async () => {
      const mockTx = {
        $queryRaw: vi.fn(),
        reserva: {
          findFirst: vi.fn().mockResolvedValue({
            id: 10,
            cerradaAt: null,
            estado: 'AGENDADA',
            version: 1,
          }),
          // El método devuelve la reserva actualizada
          update: vi.fn().mockResolvedValue({ id: 10, estado: 'AGENDADA' }),
        },
        pasajero: {
          // Primera llamada para validar membresía, segunda llamada para verificar 'todosVolaron'
          findMany: vi.fn()
            .mockResolvedValueOnce([{ id: 1 }, { id: 2 }]) // Pertenencia
            .mockResolvedValueOnce([{ estado: 'VUELO_COMPLETADO' }, { estado: 'CANCELADO' }]), // estadosFinales
          update: vi.fn(),
        },
        vuelo: { updateMany: vi.fn() },
      };
      (prisma.$transaction as any).mockImplementation(async (cb: any) => {
        await cb(mockTx);
        return mockTx.reserva.update.mock.results[0]?.value || { id: 10, estado: 'AGENDADA' }; // Fake return
      });

      const result = await actualizarEstadoPasajerosReserva(10, {
        version: 1,
        pasajeros: [
          { id: 1, estado: 'VUELO_COMPLETADO' },
          { id: 2, estado: 'CANCELADO' },
        ],
      });

      // Verify that passengers are updated
      expect(mockTx.pasajero.update).toHaveBeenCalledTimes(2);
      expect(mockTx.pasajero.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { estado: 'VUELO_COMPLETADO' },
      });
      expect(mockTx.pasajero.update).toHaveBeenCalledWith({
        where: { id: 2 },
        data: { estado: 'CANCELADO' },
      });

      // Verify synchronization of flight statuses
      expect(mockTx.vuelo.updateMany).toHaveBeenCalledTimes(2);
      expect(mockTx.vuelo.updateMany).toHaveBeenCalledWith({
        where: {
          pasajeroId: { in: [1] },
          deletedAt: null,
          estado: { not: 'CANCELADO' },
        },
        data: {
          estado: 'COMPLETADO',
          version: { increment: 1 },
        },
      });
      expect(mockTx.vuelo.updateMany).toHaveBeenCalledWith({
        where: {
          pasajeroId: { in: [2] },
          deletedAt: null,
          estado: { not: 'COMPLETADO' },
        },
        data: {
          estado: 'CANCELADO',
          version: { increment: 1 },
        },
      });

      // Si todos no volaron, el estado no debe cambiar. La función siempre llama a reserva.update al final, pero
      // sin pasar `estado` en data si no cambió.
      expect(mockTx.reserva.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 10 },
          data: { version: { increment: 1 } },
        })
      );
      expect(result.estado).toBe('AGENDADA');
    });

    it('Completa la reserva si todos los pasajeros tienen estado VUELO_COMPLETADO y cumple el saldo', async () => {
      const mockReservaFinal = { id: 20, estado: 'COMPLETADA' };
      const mockTx = {
        $queryRaw: vi.fn(),
        reserva: {
          findFirst: vi.fn().mockResolvedValue({
            id: 20,
            cerradaAt: null,
            estado: 'AGENDADA',
            estadoPago: 'PAGADO', // Necessary for derivarEstadoReservaPorPasajeros
            version: 1,
            valorTotal: 50000,
          }),
          update: vi.fn().mockResolvedValue(mockReservaFinal),
        },
        pasajero: {
          findMany: vi.fn()
            .mockResolvedValueOnce([{ id: 1 }]) // Pertenencia
            .mockResolvedValueOnce([{ estado: 'VUELO_COMPLETADO' }]), // estadosFinales
          update: vi.fn(),
        },
        vuelo: { updateMany: vi.fn() },
        pago: {
          aggregate: vi.fn().mockResolvedValue({ _sum: { monto: 50000 } }),
          count: vi.fn().mockResolvedValue(1),
        },
      };

      (prisma.$transaction as any).mockImplementation(async (cb: any) => {
        await cb(mockTx);
        return mockTx.reserva.update.mock.results[0]?.value;
      });

      const result = await actualizarEstadoPasajerosReserva(20, {
        version: 1,
        pasajeros: [{ id: 1, estado: 'VUELO_COMPLETADO' }],
      });

      // Verify transaction resolves total and allows completion
      expect(mockTx.pago.aggregate).toHaveBeenCalledWith({
        _sum: { monto: true },
        where: { reservaId: 20, deletedAt: null },
      });

      expect(mockTx.reserva.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 20 },
          data: {
            estado: 'COMPLETADA',
            version: { increment: 1 },
          },
        })
      );

      expect(result.estado).toBe('COMPLETADA');
    });
  });
});
