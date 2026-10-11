import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tickCalendarReconciliation, iniciarCalendarScheduler } from '../calendarScheduler.service';
import { googleCalendarService } from '../google-calendar.service';

vi.mock('../google-calendar.service', () => ({
  googleCalendarService: {
    isEnabled: vi.fn(),
    reconcileVuelos: vi.fn(),
  },
}));

describe('calendarScheduler.service', () => {
  let consoleLogSpy: any;
  let consoleWarnSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.useFakeTimers();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    vi.useRealTimers();
  });

  describe('tickCalendarReconciliation', () => {
    it('returns null if google calendar is not enabled', async () => {
      vi.mocked(googleCalendarService.isEnabled).mockReturnValue(false);

      const result = await tickCalendarReconciliation();

      expect(result).toBeNull();
      expect(googleCalendarService.reconcileVuelos).not.toHaveBeenCalled();
    });

    it('returns stats and logs if reconciliation makes changes', async () => {
      vi.mocked(googleCalendarService.isEnabled).mockReturnValue(true);
      const mockStats = { creados: 1, actualizados: 2, eliminados: 1, total: 4 };
      vi.mocked(googleCalendarService.reconcileVuelos).mockResolvedValue(mockStats);

      const result = await tickCalendarReconciliation();

      expect(result).toEqual(mockStats);
      expect(googleCalendarService.reconcileVuelos).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Reconciliación completada: 1 creados, 2 actualizados, 1 eliminados')
      );
    });

    it('returns stats but does not log if reconciliation makes no changes', async () => {
      vi.mocked(googleCalendarService.isEnabled).mockReturnValue(true);
      const mockStats = { creados: 0, actualizados: 0, eliminados: 0, total: 10 };
      vi.mocked(googleCalendarService.reconcileVuelos).mockResolvedValue(mockStats);

      const result = await tickCalendarReconciliation();

      expect(result).toEqual(mockStats);
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('returns null and logs warning if reconciliation throws an error', async () => {
      vi.mocked(googleCalendarService.isEnabled).mockReturnValue(true);
      const error = new Error('Network Error');
      vi.mocked(googleCalendarService.reconcileVuelos).mockRejectedValue(error);

      const result = await tickCalendarReconciliation();

      expect(result).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith('[calendar-scheduler] Fallo en tickCalendarReconciliation:', error);
    });
  });

  describe('iniciarCalendarScheduler', () => {
    it('does nothing if google calendar is not enabled', () => {
      vi.mocked(googleCalendarService.isEnabled).mockReturnValue(false);

      iniciarCalendarScheduler();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Google Calendar no configurado, scheduler omitido')
      );
      expect(googleCalendarService.reconcileVuelos).not.toHaveBeenCalled();
    });

    it('runs initial tick and sets up interval if enabled', () => {
      vi.mocked(googleCalendarService.isEnabled).mockReturnValue(true);
      vi.mocked(googleCalendarService.reconcileVuelos).mockResolvedValue({ creados: 0, actualizados: 0, eliminados: 0, total: 0 });

      // Mock tickCalendarReconciliation by running it to observe it being called indirectly or we can spy on setInterval
      const setIntervalSpy = vi.spyOn(global, 'setInterval');

      iniciarCalendarScheduler();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Scheduler de reconciliación de Google Calendar iniciado')
      );
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 60 * 60 * 1000);

      // Advance timers to trigger the interval
      vi.advanceTimersByTime(60 * 60 * 1000);

      // Verify reconcile was called during the interval
      expect(googleCalendarService.reconcileVuelos).toHaveBeenCalled();
    });
  });
});
