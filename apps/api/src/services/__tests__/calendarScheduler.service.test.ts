import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { iniciarCalendarScheduler, tickCalendarReconciliation } from '../calendarScheduler.service';
import { googleCalendarService } from '../google-calendar.service';

// Mock del googleCalendarService
vi.mock('../google-calendar.service', () => ({
  googleCalendarService: {
    isEnabled: vi.fn(),
    reconcileVuelos: vi.fn(),
  },
}));

describe('calendarScheduler.service', () => {
  let consoleLogSpy: MockInstance;
  let consoleWarnSpy: MockInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('tickCalendarReconciliation', () => {
    it('debe retornar null si Google Calendar no está habilitado', async () => {
      vi.mocked(googleCalendarService.isEnabled).mockReturnValue(false);

      const result = await tickCalendarReconciliation();

      expect(result).toBeNull();
      expect(googleCalendarService.reconcileVuelos).not.toHaveBeenCalled();
    });

    it('debe retornar estadísticas y loguear si hay cambios', async () => {
      vi.mocked(googleCalendarService.isEnabled).mockReturnValue(true);
      const mockStats = { creados: 1, actualizados: 2, eliminados: 3, total: 6 };
      vi.mocked(googleCalendarService.reconcileVuelos).mockResolvedValue(mockStats);

      const result = await tickCalendarReconciliation();

      expect(result).toEqual(mockStats);
      expect(googleCalendarService.reconcileVuelos).toHaveBeenCalledOnce();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[calendar-scheduler] Reconciliación completada: 1 creados, 2 actualizados, 3 eliminados (6 activos evaluados)'
      );
    });

    it('debe retornar estadísticas y NO loguear si no hay cambios', async () => {
      vi.mocked(googleCalendarService.isEnabled).mockReturnValue(true);
      const mockStats = { creados: 0, actualizados: 0, eliminados: 0, total: 5 };
      vi.mocked(googleCalendarService.reconcileVuelos).mockResolvedValue(mockStats);

      const result = await tickCalendarReconciliation();

      expect(result).toEqual(mockStats);
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('debe retornar null y advertir si reconcileVuelos lanza un error', async () => {
      vi.mocked(googleCalendarService.isEnabled).mockReturnValue(true);
      const mockError = new Error('API down');
      vi.mocked(googleCalendarService.reconcileVuelos).mockRejectedValue(mockError);

      const result = await tickCalendarReconciliation();

      expect(result).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[calendar-scheduler] Fallo en tickCalendarReconciliation:',
        mockError
      );
    });
  });

  describe('iniciarCalendarScheduler', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('debe omitir el inicio si Google Calendar no está habilitado', () => {
      vi.mocked(googleCalendarService.isEnabled).mockReturnValue(false);

      iniciarCalendarScheduler();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[calendar-scheduler] Google Calendar no configurado, scheduler omitido.'
      );
      expect(googleCalendarService.reconcileVuelos).not.toHaveBeenCalled();
    });

    it('debe ejecutar un barrido inicial y programar un intervalo recurrente si está habilitado', async () => {
      vi.mocked(googleCalendarService.isEnabled).mockReturnValue(true);
      vi.mocked(googleCalendarService.reconcileVuelos).mockResolvedValue({
        creados: 0, actualizados: 0, eliminados: 0, total: 0
      });

      iniciarCalendarScheduler();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[calendar-scheduler] Scheduler de reconciliación de Google Calendar iniciado (cada 60 min)'
      );

      // El scheduler hace `void tickCalendarReconciliation()` sin await.
      // Avanzamos los timers en microtasks.

      // Primera ejecución (se llama inmediatamente de forma síncrona hasta el primer await)
      expect(googleCalendarService.reconcileVuelos).toHaveBeenCalledTimes(1);

      vi.mocked(googleCalendarService.reconcileVuelos).mockClear();

      // Avanzamos 60 minutos
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
      expect(googleCalendarService.reconcileVuelos).toHaveBeenCalledTimes(1);

      vi.mocked(googleCalendarService.reconcileVuelos).mockClear();

      // Avanzamos otros 60 minutos
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
      expect(googleCalendarService.reconcileVuelos).toHaveBeenCalledTimes(1);
    });
  });
});
