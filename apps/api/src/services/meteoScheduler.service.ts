import { meteorologiaService } from './meteorologia.service';

/**
 * SAMPLER de backend para condiciones de pista vía Open-Meteo.
 *
 * Consulta Open-Meteo cada 15 minutos y persiste el boletín automático en
 * `CondicionPista` (vía MeteorologiaService, que ya mapea y registra).
 * Idempotente y tolerante a fallos: nunca tumba el server.
 *
 * Estrategia:
 * 1. Barrido inicial al arrancar (cubre reinicios del contenedor/deploy).
 * 2. Scheduler cada 15 min con setInterval + .unref() (no impide shutdown).
 */

const INTERVALO_15_MIN_MS = 15 * 60 * 1000; // 900_000 ms

/**
 * Muestrea Open-Meteo y persiste el boletín si la consulta fue exitosa.
 * Retorna 1 si registró, 0 si falló (Open-Meteo caído u otro error).
 */
export async function samplearOpenMeteo(): Promise<number> {
  try {
    const payload = await meteorologiaService.obtenerPronosticoOpenMeteo();
    if (!payload) {
      console.warn('[meteo-sampler] Open-Meteo no devolvió datos; se omite el registro');
      return 0;
    }
    await meteorologiaService.registrar(payload);
    return 1;
  } catch (err) {
    console.warn('[meteo-sampler] Fallo al muestrear Open-Meteo:', err);
    return 0;
  }
}

/** Arranca el sampler: barrido inicial + ciclo cada 15 min. Fire-and-forget. */
export function iniciarMeteoScheduler(): void {
  void samplearOpenMeteo();
  setInterval(() => {
    void samplearOpenMeteo();
  }, INTERVALO_15_MIN_MS).unref(); // unref: no impide el shutdown del proceso
  console.log('[meteo-sampler] Scheduler iniciado (cada 15 min)');
}
