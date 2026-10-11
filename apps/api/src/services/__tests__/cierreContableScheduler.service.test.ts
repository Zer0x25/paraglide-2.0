import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tickCierreContable, iniciarCierreContableScheduler } from '../cierreContableScheduler.service';
import { prisma } from '../../plugins/prisma';
import { cerrarReservaContable } from '../reservas/reservas.ciclo-vida';

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

describe('Cierre Contable Scheduler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('tickCierreContable', () => {
    it('debería retornar 0 y no llamar a cerrarReservaContable si no hay reservas pendientes', async () => {
      (prisma.reserva.findMany as any).mockResolvedValue([]);

      const result = await tickCierreContable();

      expect(prisma.reserva.findMany).toHaveBeenCalledTimes(1);
      expect(cerrarReservaContable).not.toHaveBeenCalled();
      expect(result).toBe(0);
    });

    it('debería procesar múltiples reservas y retornar el número de cerradas', async () => {
      (prisma.reserva.findMany as any).mockResolvedValue([
        { id: 1, version: 1, numeroReserva: 'R-001' },
        { id: 2, version: 2, numeroReserva: 'R-002' },
      ]);
      (cerrarReservaContable as any).mockResolvedValue({});

      const result = await tickCierreContable();

      expect(prisma.reserva.findMany).toHaveBeenCalledTimes(1);
      expect(cerrarReservaContable).toHaveBeenCalledTimes(2);
      expect(cerrarReservaContable).toHaveBeenCalledWith(1, 1);
      expect(cerrarReservaContable).toHaveBeenCalledWith(2, 2);
      expect(result).toBe(2);
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('2 reserva(s) histórica(s) congelada(s)'));
    });

    it('debería ser tolerante a fallos individuales: si una falla, continúa con las demás', async () => {
      (prisma.reserva.findMany as any).mockResolvedValue([
        { id: 1, version: 1, numeroReserva: 'R-001' },
        { id: 2, version: 2, numeroReserva: 'R-002' },
        { id: 3, version: 3, numeroReserva: 'R-003' },
      ]);

      (cerrarReservaContable as any)
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('Error simulado'))
        .mockResolvedValueOnce({});

      const result = await tickCierreContable();

      expect(cerrarReservaContable).toHaveBeenCalledTimes(3);
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('[cierre-contable] No se pudo cerrar reserva #2'),
        expect.any(Error)
      );
      expect(result).toBe(2); // 2 exitosas de 3
    });

    it('debería ser tolerante a fallos globales de BD y retornar 0 sin tumbar el proceso', async () => {
      (prisma.reserva.findMany as any).mockRejectedValue(new Error('BD caída'));

      const result = await tickCierreContable();

      expect(console.error).toHaveBeenCalledWith(
        '[cierre-contable] Error durante tickCierreContable:',
        expect.any(Error)
      );
      expect(result).toBe(0);
      expect(cerrarReservaContable).not.toHaveBeenCalled();
    });
  });

  describe('iniciarCierreContableScheduler', () => {
    it('debería ejecutar tickCierreContable al inicio y programar el siguiente cierre', async () => {
      (prisma.reserva.findMany as any).mockResolvedValue([]);

      iniciarCierreContableScheduler();

      // Debería ejecutar el tick inicial inmediatamente
      expect(prisma.reserva.findMany).toHaveBeenCalledTimes(1);
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Scheduler diario de inmutabilidad iniciado'));

      // Avanzamos el tiempo 24 horas para ver si se encola la siguiente ejecución
      await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000 + 1000);

      // Ahora debería haberse ejecutado al menos 2 veces (el inicial + el primer timer)
      expect(prisma.reserva.findMany).toHaveBeenCalledTimes(2);
    });
  });
});
