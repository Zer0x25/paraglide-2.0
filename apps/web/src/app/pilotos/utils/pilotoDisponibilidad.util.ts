import type { HorarioBloquePayload, PilotoDTO } from '@parapente/shared';

export type PilotoConId = PilotoDTO & { id: number };

export type PilotoDisponibilidad = {
  id: number;
  disponibilidadTotal: boolean;
  version: number;
  excepciones: { fecha: string }[];
  disponibilidadBloques: { fecha: string | Date; horaInicio: string; horaFin: string }[];
};

export type HorarioBloque = HorarioBloquePayload;

export function getMonthDates(currentMonth: Date): string[] {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return Array.from(
    { length: daysInMonth },
    (_, i) => `${year}-${String(month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`
  );
}

export function buildInitialBlockOverrides(
  piloto: PilotoDisponibilidad | PilotoConId | null | undefined,
  getBlocksCountForDate: (ds: string) => number
): Record<string, Record<string, boolean>> {
  const res: Record<string, Record<string, boolean>> = {};
  const byDate: Record<string, { horaInicio: string; horaFin: string }[]> = {};
  const raw = (piloto as PilotoDisponibilidad | null)?.disponibilidadBloques;
  for (const b of (raw as { fecha: string | Date; horaInicio: string; horaFin: string }[] | undefined) ?? []) {
    const ds = String(b.fecha).slice(0, 10);
    (byDate[ds] ||= []).push(b);
  }
  for (const [ds, blocks] of Object.entries(byDate)) {
    const total = getBlocksCountForDate(ds);
    if (total > 0 && blocks.length > 0 && blocks.length < total) {
      res[ds] = {};
      for (const b of blocks) res[ds][b.horaInicio] = true;
    }
  }
  return res;
}

export function calculateOriginalAvailable(
  dateStr: string,
  availDisp: PilotoDisponibilidad | null
): boolean {
  if (!availDisp) return true;
  const hasException = availDisp.excepciones.some((ex: { fecha: string }) =>
    ex.fecha.startsWith(dateStr)
  );
  return availDisp.disponibilidadTotal ? !hasException : hasException;
}

export function calculateDayState(
  dateStr: string,
  totalBlocks: number,
  blockOverrides: Record<string, Record<string, boolean>>,
  desiredAvail: boolean
): 'full' | 'partial' | 'none' {
  const ov = blockOverrides[dateStr];
  if (totalBlocks > 0 && ov) {
    const sel = Object.keys(ov).length;
    if (sel >= totalBlocks) return 'full';
    if (sel === 0) return 'none';
    return 'partial';
  }
  return desiredAvail ? 'full' : 'none';
}
