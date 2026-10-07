import { googleCalendarService } from './google-calendar.service';

/**
 * SCHEDULER de reconciliación desatendida con Google Calendar.
 *
 * Se ejecuta automáticamente cada 60 minutos (y al arrancar el servidor)
 * para asegurar que ningún vuelo quede desfasado si ocurrió una interrupción
 * de red o caída transitoria en la API de Google.
 *
 * Estrategia:
 * 1. Barrido inicial al arrancar el servidor (si Google Calendar está habilitado).
 * 2. Ciclo desatendido cada 60 min con setInterval + .unref() (no impide el graceful shutdown).
 */

const INTERVALO_60_MIN_MS = 60 * 60 * 1000; // 3_600_000 ms

/**
 * Ejecuta un ciclo de reconciliación de vuelos contra Google Calendar.
 * Retorna las estadísticas del ciclo o null si Google Calendar no está habilitado / falló.
 * Tolerante a fallos: nunca lanza excepciones.
 */
export async function tickCalendarReconciliation(): Promise<Awaited<ReturnType<typeof googleCalendarService.reconcileVuelos>> | null> {
  if (!googleCalendarService.isEnabled()) {
    return null;
  }

  try {
    const stats = await googleCalendarService.reconcileVuelos();
    if (stats.creados > 0 || stats.actualizados > 0 || stats.eliminados > 0) {
      console.log(
        `[calendar-scheduler] Reconciliación completada: ` +
        `${stats.creados} creados, ${stats.actualizados} actualizados, ${stats.eliminados} eliminados (${stats.total} activos evaluados)`
      );
    }
    return stats;
  } catch (err) {
    console.warn('[calendar-scheduler] Fallo en tickCalendarReconciliation:', err);
    return null;
  }
}

/**
 * Inicia el scheduler de reconciliación periódica de Google Calendar.
 * Solo arranca si Google Calendar cuenta con credenciales válidas. Fire-and-forget.
 */
export function iniciarCalendarScheduler(): void {
  if (!googleCalendarService.isEnabled()) {
    console.log('[calendar-scheduler] Google Calendar no configurado, scheduler omitido.');
    return;
  }

  // Barrido inicial asíncrono
  void tickCalendarReconciliation();

  // Ciclo recurrente cada 60 minutos
  setInterval(() => {
    void tickCalendarReconciliation();
  }, INTERVALO_60_MIN_MS).unref();

  console.log('[calendar-scheduler] Scheduler de reconciliación de Google Calendar iniciado (cada 60 min)');
}
