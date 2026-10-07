import { programarEnvios } from './notificaciones.service';

/**
 * SCHEDULER de notificaciones automatizadas (Fase 5 — esqueleto).
 *
 * Barre cada 60 min las ventanas 24h / 2h y loguea los envíos que haría
 * (stub hasta que se configuren Resend/Twilio). Idempotente y tolerante
 * a fallos: nunca tumba el server.
 *
 * Estrategia:
 * 1. Barrido inicial al arrancar (cubre reinicios del contenedor/deploy).
 * 2. Ciclo cada 60 min con setInterval + .unref() (no impide shutdown).
 */

const INTERVALO_60_MIN_MS = 60 * 60 * 1000; // 3_600_000 ms

/**
 * Ejecuta un ciclo de programación de envíos.
 * Retorna el resumen del ciclo o null si falló por completo.
 * Nunca lanza: captura y loguea.
 */
export async function tickNotificaciones(): Promise<Awaited<ReturnType<typeof programarEnvios>> | null> {
  try {
    return await programarEnvios();
  } catch (err) {
    console.warn('[notificaciones-scheduler] Fallo en tickNotificaciones:', err);
    return null;
  }
}

/** Arranca el scheduler: barrido inicial + ciclo cada 60 min. Fire-and-forget. */
export function iniciarNotificacionesScheduler(): void {
  void tickNotificaciones();
  setInterval(() => {
    void tickNotificaciones();
  }, INTERVALO_60_MIN_MS).unref(); // unref: no impide el shutdown del proceso
  console.log('[notificaciones-scheduler] Scheduler iniciado (cada 60 min)');
}
