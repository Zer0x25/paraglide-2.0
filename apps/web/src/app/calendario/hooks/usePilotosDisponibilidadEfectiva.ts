import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import type { PilotoDia } from '../agendas.util';

/**
 * FIX 1: `GET /pilotos` no trae `excepciones` (Fase 5: on-demand), así que la
 * disponibilidad real del día visible se resuelve aquí por piloto. Si la query
 * está pending/error se usa la prop tal cual (fallback → fixtures de tests y
 * comportamiento anterior).
 */
export function usePilotosDisponibilidadEfectiva(
  pilotos: PilotoDia[],
  dateKey: string
): { pilotosEfectivos: PilotoDia[]; isLoading: boolean } {
  const disponibilidadQuery = useQuery<
    Map<number, { excepciones: { fecha: string }[]; disponibilidadTotal: boolean }>
  >({
    queryKey: ['pilotos', 'disponibilidad', dateKey],
    queryFn: async () => {
      const resultados = await Promise.all(
        pilotos.map((p) => api.pilotos.obtenerDisponibilidad(p.id))
      );
      const mapa = new Map<
        number,
        { excepciones: { fecha: string }[]; disponibilidadTotal: boolean }
      >();
      resultados.forEach((r: { excepciones?: unknown; disponibilidadTotal?: boolean } | null, i) => {
        const p = pilotos[i];
        if (r && p) {
          // El endpoint puede devolver excepciones como null o []: normaliza a array.
          mapa.set(p.id, {
            excepciones: Array.isArray(r.excepciones) ? (r.excepciones as { fecha: string }[]) : [],
            disponibilidadTotal: r.disponibilidadTotal ?? p.disponibilidadTotal,
          });
        }
      });
      return mapa;
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
    const dataMap = raw as Map<
      number,
      { excepciones: { fecha: string }[]; disponibilidadTotal: boolean }
    > &
      Record<string, unknown>;
    const isMap = raw instanceof Map;
    const size = isMap
      ? (raw as Map<unknown, unknown>).size
      : typeof raw === 'object'
      ? Object.keys(raw as Record<string, unknown>).length
      : 0;
    if (size === 0) return pilotos;

    const getEntrada = (
      id: number
    ): { excepciones: { fecha: string }[]; disponibilidadTotal: boolean } | undefined => {
      if (isMap) {
        return (
          raw as Map<number, { excepciones: { fecha: string }[]; disponibilidadTotal: boolean }>
        ).get(id);
      }
      if (typeof (dataMap as { get?: unknown }).get === 'function') {
        try {
          return (
            dataMap as unknown as Map<
              number,
              { excepciones: { fecha: string }[]; disponibilidadTotal: boolean }
            >
          ).get(id);
        } catch {
          return undefined;
        }
      }
      const rec = raw as Record<
        string,
        { excepciones: { fecha: string }[]; disponibilidadTotal: boolean }
      >;
      return rec[id] ?? rec[String(id)];
    };

    return pilotos.map((p) => {
      const entrada = getEntrada(p.id);
      if (!entrada) return p;
      return {
        ...p,
        excepciones: entrada.excepciones ?? [],
        disponibilidadTotal: entrada.disponibilidadTotal ?? p.disponibilidadTotal,
      };
    });
  })();

  return {
    pilotosEfectivos,
    isLoading: disponibilidadQuery.isLoading,
  };
}
