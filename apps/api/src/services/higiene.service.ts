import { dateKeyLocal } from '@parapente/shared';
import { prisma } from '../plugins/prisma';

/**
 * Higiene automática de reglas de bloques (Fase 2).
 *
 * Archiva reglas expiradas (fechaFin/fechaExacta < hoy) una vez al día.
 * El archivado NUNCA borra: es snapshot histórico para /resolver en fechas
 * pasadas. Idempotente y tolerante a fallos (nunca tumba el server).
 *
 * Estrategia doble:
 * 1. Barrido al arrancar (cubre reinicios del contenedor/deploy).
 * 2. Scheduler diario a las ~03:00 hora del servidor (UTC), re-programado
 *    cada día con setTimeout (sin dependencia externa de cron).
 */
const INTERVALO_DIA_MS = 24 * 60 * 60 * 1000;

export async function archivarExpiradas(): Promise<number> {
  try {
    // fechaFin/fechaExacta son columnas date-only con la convención de fecha
    // civil en medianoche UTC (`YYYY-MM-DDT00:00:00.000Z`). Se compara contra
    // la medianoche UTC del día civil local de hoy: solo se archivan reglas con
    // día civil ESTRICTAMENTE anterior a hoy. Así el último día de cada rango
    // sigue resolviendo (el resolver descarta archivadas desde archivadaEn en
    // adelante) sin importar a qué hora corra el barrido.
    const inicioHoyUtc = new Date(`${dateKeyLocal()}T00:00:00.000Z`);
    const res = await prisma.configuracionBloque.updateMany({
      where: {
        deletedAt: null,
        archivada: false,
        OR: [{ fechaFin: { lt: inicioHoyUtc } }, { fechaExacta: { lt: inicioHoyUtc } }],
      },
      data: { archivada: true, archivadaEn: new Date() },
    });
    if (res.count > 0) {
      console.log(`[higiene-bloques] ${res.count} regla(s) expirada(s) archivada(s)`);
    }
    return res.count;
  } catch (err) {
    console.error('[higiene-bloques] Error archivando expiradas:', err);
    return 0;
  }
}

/**
 * Retención de 24h para boletines de pista (CondicionPista).
 * Soft-delete de boletines con fechaHora > 24h y aún no borrados.
 */
export async function descartarBoletinesAntiguos(): Promise<number> {
  try {
    const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const res = await prisma.condicionPista.updateMany({
      where: { deletedAt: null, fechaHora: { lt: hace24h } },
      data: { deletedAt: new Date() },
    });
    if (res.count > 0) {
      console.log(`[higiene-bloques] ${res.count} boletín(es) de pista descartado(s) (>24h)`);
    }
    return res.count;
  } catch (err) {
    console.warn('[higiene-bloques] Error descartando boletines antiguos:', err);
    return 0;
  }
}

function msHastaProximaTresAM(): number {
  const ahora = new Date();
  const proxima = new Date(
    Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate(), 3, 0, 0)
  );
  if (proxima <= ahora) proxima.setUTCDate(proxima.getUTCDate() + 1);
  return proxima.getTime() - ahora.getTime();
}

function programarSiguiente(): void {
  const delay = msHastaProximaTresAM();
  setTimeout(() => {
    void archivarExpiradas();
    void descartarBoletinesAntiguos().finally(programarSiguiente);
  }, delay).unref(); // unref: no impide el shutdown del proceso
}

/** Arranca la higiene: barrido inicial + scheduler diario. Fire-and-forget. */
export function iniciarHigieneBloques(): void {
  void archivarExpiradas();
  void descartarBoletinesAntiguos();
  programarSiguiente();
  console.log('[higiene-bloques] Scheduler diario iniciado (03:00 UTC)');
}
