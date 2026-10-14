import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import type { PilotoDia } from '../agendas.util';

interface DisponibilidadPilotoEntry {
  excepciones: { fecha: string }[];
  disponibilidadBloques: { fecha: string; horaInicio: string; horaFin: string }[];
  disponibilidadTotal: boolean;
}

/**
 * FIX 1: `GET /pilotos` no trae `excepciones` (Fase 5: on-demand), así que la
 * disponibilidad real del día visible se resuelve aquí por piloto. Si la query
 * está pending/error se usa la prop tal cual (fallback → fixtures de tests y
 * comportamiento anterior).
 */
export function usePilotosDisponibilidadEfectiva(
  pilotos: PilotoDia[],
  _dateKey?: string,
): { pilotosEfectivos: PilotoDia[]; isLoading: boolean } {
  void _dateKey;
  const pilotoIdsKey = pilotos
    .map((p) => p.id)
    .sort((a, b) => a - b)
    .join(',');

  const disponibilidadQuery = useQuery<
    Record<number, DisponibilidadPilotoEntry> | Map<number, DisponibilidadPilotoEntry>
  >({
    queryKey: ['pilotos', 'disponibilidad', pilotoIdsKey],
    queryFn: async () => {
      const resultados = await Promise.all(
        pilotos.map((p) => api.pilotos.obtenerDisponibilidad(p.id)),
      );
      const record: Record<number, DisponibilidadPilotoEntry> = {};
      resultados.forEach(
        (
          r: {
            excepciones?: unknown;
            disponibilidadBloques?: unknown;
            disponibilidadTotal?: boolean;
          } | null,
          i,
        ) => {
          const p = pilotos[i];
          if (r && p) {
            record[p.id] = {
              excepciones: Array.isArray(r.excepciones)
                ? (r.excepciones as { fecha: string }[])
                : [],
              disponibilidadBloques: Array.isArray(r.disponibilidadBloques)
                ? (r.disponibilidadBloques as {
                    fecha: string;
                    horaInicio: string;
                    horaFin: string;
                  }[])
                : [],
              disponibilidadTotal: r.disponibilidadTotal ?? p.disponibilidadTotal,
            };
          }
        },
      );
      return record;
    },
    enabled: pilotos.length > 0,
    staleTime: 60_000,
  });

  // Merge con fallback: si la query resolvió, mezcla excepciones reales por piloto
  // (los que no tengan entrada conservan la prop); pending/error → props tal cual.
  // FIX: data puede venir serializada como objeto plano (Map pierde prototipo tras
  // dehydrate/hydrate o mocks) → soportar Map y Record.
  const pilotosEfectivos: PilotoDia[] = (() => {
    const raw = disponibilidadQuery.data as unknown;
    if (!raw) return pilotos;
    const dataMap = raw as Map<number, DisponibilidadPilotoEntry> & Record<string, unknown>;
    const isMap = raw instanceof Map;
    const size = isMap
      ? (raw as Map<unknown, unknown>).size
      : typeof raw === 'object'
        ? Object.keys(raw as Record<string, unknown>).length
        : 0;
    if (size === 0) return pilotos;

    const getEntrada = (id: number): DisponibilidadPilotoEntry | undefined => {
      if (isMap) {
        return (raw as Map<number, DisponibilidadPilotoEntry>).get(id);
      }
      if (typeof (dataMap as { get?: unknown }).get === 'function') {
        try {
          return (dataMap as unknown as Map<number, DisponibilidadPilotoEntry>).get(id);
        } catch {
          return undefined;
        }
      }
      const rec = raw as Record<string, DisponibilidadPilotoEntry>;
      return rec[id] ?? rec[String(id)];
    };

    return pilotos.map((p) => {
      const entrada = getEntrada(p.id);
      if (!entrada) return p;
      return {
        ...p,
        excepciones: entrada.excepciones ?? [],
        disponibilidadBloques: entrada.disponibilidadBloques ?? p.disponibilidadBloques ?? [],
        disponibilidadTotal: entrada.disponibilidadTotal ?? p.disponibilidadTotal,
      };
    });
  })();

  return {
    pilotosEfectivos,
    isLoading: disponibilidadQuery.isLoading,
  };
}
