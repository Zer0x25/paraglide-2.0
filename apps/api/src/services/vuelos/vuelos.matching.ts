import { prisma } from '../../plugins/prisma';
import { dateKeyLocal } from '@parapente/shared';

export interface PilotoOrden {
  id: number;
  prioridad: number;
  categoria?: string | null;
}

// Ordena pilotos para asignación:
// 1) prioridad (menor número = mejor: 1 = máxima)
// 2) categoría (menor número = mejor: MASTER=1 > SENIOR=2 > JUNIOR=3)
// 3) empate total -> al azar (sin sesgo por orden de inserción)
export function ordenarPilotosParaAsignacion<T extends PilotoOrden>(pilotos: T[]): T[] {
  const CATEGORIA_RANK: Record<string, number> = { MASTER: 1, SENIOR: 2, JUNIOR: 3 };
  const rankCategoria = (c: string) => CATEGORIA_RANK[(c ?? '').toUpperCase()] ?? 99;
  return [...pilotos].sort((a, b) => {
    if (a.prioridad !== b.prioridad) return a.prioridad - b.prioridad;
    const rc = rankCategoria(a.categoria ?? '') - rankCategoria(b.categoria ?? '');
    if (rc !== 0) return rc;
    return Math.random() - 0.5;
  });
}

export async function validateWeightAndConflict(
  pilotoId: number,
  pasajeroId: number,
  fechaHora: string,
  excludeVueloId?: number,
) {
  const pasajeroData = await prisma.pasajero.findUnique({
    where: { id: pasajeroId, deletedAt: null },
  });

  if (pasajeroData?.peso && pasajeroData.peso > 115) {
    throw new Error(`Límite de peso excedido. El peso del pasajero (${pasajeroData.peso}kg) excede el límite (115kg).`);
  }

  const conflicto = await prisma.vuelo.findFirst({
    where: {
      pilotoId,
      fechaHora: new Date(fechaHora),
      deletedAt: null,
      estado: { not: 'CANCELADO' },
      ...(excludeVueloId ? { NOT: { id: excludeVueloId } } : {}),
    },
  });

  if (conflicto) {
    throw new Error('Conflicto de horario. El piloto ya tiene un vuelo en esa fecha y hora.');
  }
}

export async function autoAssignVuelos(fechaHora: string, pasajeros: { id: number; peso: number }[]) {
  const targetDate = new Date(fechaHora);
  const dateStr = dateKeyLocal(targetDate);

  const pilotosData = await prisma.piloto.findMany({
    where: { activo: true },
    include: {
      excepciones: {
        where: {
          fecha: {
            gte: new Date(`${dateStr}T00:00:00.000Z`),
            lte: new Date(`${dateStr}T23:59:59.999Z`),
          },
        },
      },
      vuelos: {
        where: {
          fechaHora: targetDate,
          deletedAt: null,
          estado: { not: 'CANCELADO' },
        },
      },
    },
  });

  const hoyUtcDate = new Date(`${dateKeyLocal()}T00:00:00.000Z`);

  // Filtrar pilotos disponibles en el día y sin vuelo agendado a esa hora exacta
  const availablePilots = pilotosData.filter((p: any) => {
    const hasException = p.excepciones.length > 0;
    const isAvailableDay = p.disponibilidadTotal ? !hasException : hasException;
    const isBusyTime = p.vuelos.length > 0;
    const licenciaOk = p.tieneLicencia && (!p.fechaVencimientoLicencia || new Date(p.fechaVencimientoLicencia) >= hoyUtcDate);
    return isAvailableDay && !isBusyTime && licenciaOk;
  });

  const asignaciones: Record<number, number> = {};
  
  // ORDENACIÓN: 1) prioridad, 2) categoría, 3) empate -> azar
  const pool = ordenarPilotosParaAsignacion(availablePilots);

  for (const pasajero of pasajeros) {
    const pesoPasajero = pasajero.peso || 75;
    
    const pilotIndex = pool.findIndex(p => {
      const minPeso = p.pesoMinimoPasajero ?? 30;
      const maxPeso = p.pesoMaximoPasajero ?? 110;
      return pesoPasajero >= minPeso && pesoPasajero <= maxPeso;
    });

    if (pilotIndex !== -1) {
      asignaciones[pasajero.id] = pool[pilotIndex].id;
      pool.splice(pilotIndex, 1);
    }
  }

  return asignaciones;
}
