import { prisma } from '../plugins/prisma';
import { cerrarReservaContable } from './reservas/reservas.ciclo-vida';

/**
 * SCHEDULER de cierre contable e inmutabilidad de reservas históricas (Fase 3).
 *
 * Busca reservas en estado COMPLETADA o CANCELADA con más de 7 días de antigüedad
 * que aún no han sido congeladas (cerradaAt === null).
 * Serializa su desglose final en snapshotJson y estampa cerradaAt.
 *
 * Estrategia:
 * 1. Barrido inicial al arrancar el servidor.
 * 2. Scheduler diario a las 04:00 UTC (reprogramado con setTimeout + .unref()).
 * 3. Ejecución por lotes (take: 50) para no saturar el pool de conexiones.
 */

const DIAS_RETENCION_CIERRE = 7;

/**
 * Ejecuta un ciclo de congelamiento de reservas históricas.
 * Retorna el número de reservas congeladas exitosamente.
 * Tolerante a fallos: nunca tumba el proceso.
 */
export async function tickCierreContable(): Promise<number> {
  try {
    const haceSieteDias = new Date(Date.now() - DIAS_RETENCION_CIERRE * 24 * 60 * 60 * 1000);

    const pendientes = await prisma.reserva.findMany({
      where: {
        deletedAt: null,
        cerradaAt: null,
        estado: { in: ['COMPLETADA', 'CANCELADA'] },
        OR: [
          { fechaAgenda: { lt: haceSieteDias } },
          { fechaAgenda: null, createdAt: { lt: haceSieteDias } },
        ],
      },
      select: { id: true, version: true, numeroReserva: true },
      take: 50,
    });

    if (pendientes.length === 0) {
      return 0;
    }

    let cerradas = 0;
    for (const r of pendientes) {
      try {
        await cerrarReservaContable(r.id, r.version);
        cerradas++;
      } catch (err) {
        console.warn(`[cierre-contable] No se pudo cerrar reserva #${r.id} (${r.numeroReserva}):`, err);
      }
    }

    if (cerradas > 0) {
      console.log(`[cierre-contable] ${cerradas} reserva(s) histórica(s) congelada(s) con snapshot inmutable (>7 días).`);
    }

    return cerradas;
  } catch (err) {
    console.error('[cierre-contable] Error durante tickCierreContable:', err);
    return 0;
  }
}

function msHastaProximaCuatroAM(): number {
  const ahora = new Date();
  const proxima = new Date(
    Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate(), 4, 0, 0)
  );
  if (proxima <= ahora) proxima.setUTCDate(proxima.getUTCDate() + 1);
  return proxima.getTime() - ahora.getTime();
}

function programarSiguienteCierre(): void {
  const delay = msHastaProximaCuatroAM();
  setTimeout(() => {
    void tickCierreContable().finally(programarSiguienteCierre);
  }, delay).unref();
}

/** Inicia el scheduler de cierre contable: barrido inicial + scheduler diario (04:00 UTC). */
export function iniciarCierreContableScheduler(): void {
  void tickCierreContable();
  programarSiguienteCierre();
  console.log('[cierre-contable] Scheduler diario de inmutabilidad iniciado (04:00 UTC)');
}
