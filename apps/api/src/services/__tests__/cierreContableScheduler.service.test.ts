import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { prisma } from '../../plugins/prisma';
import { cerrarReservaContable } from '../reservas/reservas.ciclo-vida';
import {
  iniciarCierreContableScheduler,
  tickCierreContable,
} from '../cierreContableScheduler.service';

vi.mock('../../plugins/prisma', () => ({
  prisma: {
    reserva: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('../reservas/reservas.ciclo-vida', () => ({
  cerrarReservaContable: vi.fn(),
}));

describe('cierreContableScheduler.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('iniciarCierreContableScheduler', () => {
    it('calls tickCierreContable initially and sets up programarSiguienteCierre', () => {
      vi.useFakeTimers();

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Mock findMany to return empty array so tickCierreContable finishes quickly
      vi.mocked(prisma.reserva.findMany).mockResolvedValue([]);

      iniciarCierreContableScheduler();

      // tickCierreContable should have been called (verified via prisma call since we didn't mock tickCierreContable directly)
      expect(prisma.reserva.findMany).toHaveBeenCalledTimes(1);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[cierre-contable] Scheduler diario de inmutabilidad iniciado (04:00 UTC)',
      );

      // Unset fake timers
      vi.useRealTimers();
      consoleLogSpy.mockRestore();
    });

    it('schedules tickCierreContable again via setTimeout after advancing the clock', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(Date.UTC(2023, 0, 1, 0, 0, 0))); // 00:00 UTC

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      vi.mocked(prisma.reserva.findMany).mockResolvedValue([]);

      iniciarCierreContableScheduler();

      expect(prisma.reserva.findMany).toHaveBeenCalledTimes(1);

      // Advance timers by exactly 4 hours (to 04:00 UTC)
      await vi.advanceTimersByTimeAsync(4 * 60 * 60 * 1000);

      // It should have triggered again
      expect(prisma.reserva.findMany).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
      consoleLogSpy.mockRestore();
    });
  });

  describe('tickCierreContable', () => {
    it('returns 0 when there are no pending reservations', async () => {
      vi.mocked(prisma.reserva.findMany).mockResolvedValueOnce([]);

      const result = await tickCierreContable();

      expect(result).toBe(0);
      expect(prisma.reserva.findMany).toHaveBeenCalledTimes(1);
      expect(cerrarReservaContable).not.toHaveBeenCalled();
    });

    it('calls cerrarReservaContable and returns correct count when there are pending reservations', async () => {
      const mockReservations = [
        { id: 1, version: 1, numeroReserva: 'RES-001' },
        { id: 2, version: 2, numeroReserva: 'RES-002' },
      ];
      // @ts-ignore - Mocking partial data
      vi.mocked(prisma.reserva.findMany).mockResolvedValueOnce(mockReservations);
      vi.mocked(cerrarReservaContable).mockResolvedValue(undefined as any);

      const result = await tickCierreContable();

      expect(result).toBe(2);
      expect(prisma.reserva.findMany).toHaveBeenCalledTimes(1);
      expect(cerrarReservaContable).toHaveBeenCalledTimes(2);
      expect(cerrarReservaContable).toHaveBeenNthCalledWith(1, 1, 1);
      expect(cerrarReservaContable).toHaveBeenNthCalledWith(2, 2, 2);
    });

    it('handles an error thrown by cerrarReservaContable, logs warning, and continues processing others', async () => {
      const mockReservations = [
        { id: 1, version: 1, numeroReserva: 'RES-001' },
        { id: 2, version: 2, numeroReserva: 'RES-002' },
        { id: 3, version: 1, numeroReserva: 'RES-003' },
      ];
      // @ts-ignore
      vi.mocked(prisma.reserva.findMany).mockResolvedValueOnce(mockReservations);

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      vi.mocked(cerrarReservaContable)
        .mockResolvedValueOnce(undefined as any) // Success for id: 1
        .mockRejectedValueOnce(new Error('Simulated failure')) // Fails for id: 2
        .mockResolvedValueOnce(undefined as any); // Success for id: 3

      const result = await tickCierreContable();

      // Returns count of successfully closed ones (2 out of 3)
      expect(result).toBe(2);
      expect(cerrarReservaContable).toHaveBeenCalledTimes(3);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        `[cierre-contable] No se pudo cerrar reserva #2 (RES-002):`,
        expect.any(Error),
      );

      consoleWarnSpy.mockRestore();
    });

    it('returns 0 and logs error if prisma.reserva.findMany throws an error', async () => {
      vi.mocked(prisma.reserva.findMany).mockRejectedValueOnce(new Error('DB Error'));
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await tickCierreContable();

      expect(result).toBe(0);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[cierre-contable] Error durante tickCierreContable:',
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });
  });
});
