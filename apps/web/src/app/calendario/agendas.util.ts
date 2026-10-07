/**
 * Utilidades puras (sin React) para la vista "Agendas" del calendario.
 *
 * La vista divide cada BLOQUE horario del día en carriles por piloto con sus
 * reservas. Estas funciones son testables de forma aislada y comparten las
 * mismas convenciones de zona horaria que `page.tsx` (fechas locales
 * representadas como `YYYY-MM-DD` restando el offset antes de `toISOString`).
 */

/** Proyección `vista-calendario` de un vuelo (misma forma que la query de la página). */
export interface VueloVista {
  id: number;
  pilotoId: number;
  pasajeroId: number;
  fechaHora: string;
  estado: string;
  valorPactado: number;
  version?: number;
  reservaId?: number | null;
  piloto?: { nombre: string };
  pasajero?: { nombre: string; reservaId?: number | null };
  reserva?: {
    id: number;
    numeroReserva?: string;
    estado: string;
    estadoPago: string;
    abono: number;
    valorTotal: number;
  };
}

/** Piloto con los campos que la vista agendas necesita para saber disponibilidad por día. */
export interface PilotoDia {
  id: number;
  nombre: string;
  activo: boolean;
  prioridad: number;
  disponibilidadTotal: boolean;
  excepciones: { fecha: string }[];
}

/** Horario de un bloque de vuelo. */
export interface HorarioBloque {
  horaInicio: string;
  horaFin: string;
}

import { dateKeyLocal, horaLocalHHMM, esMismoDia } from '@parapente/shared';

export { dateKeyLocal, horaLocalHHMM, esMismoDia };

/** Resultado de agrupar los vuelos de un bloque por piloto. */
export interface GrupoCarril {
  pilotoId: number;
  nombre: string;
  vuelos: VueloVista[];
}

/** Agrupa los vuelos de un carril por reserva para separar visualmente reservas distintas. */
export function agruparVuelosPorReserva(vuelos: VueloVista[]): Map<string, VueloVista[]> {
  const mapa = new Map<string, VueloVista[]>();
  for (const v of vuelos) {
    const key = String(v.reservaId ?? v.pasajero?.reservaId ?? `vuelo-${v.id}`);
    const arr = mapa.get(key);
    if (arr) arr.push(v);
    else mapa.set(key, [v]);
  }
  return mapa;
}

/**
 * ¿El vuelo cae dentro del bloque `[horaInicio, horaFin)` del día dado?
 * Intervalo semiabierto comparando `HH:mm` como strings (ordenan correctamente).
 * Mejora el match por timestamp exacto que usaba la vista anterior: los vuelos
 * a mitad de bloque ya no se pierden.
 */
export const vueloEnBloque = (
  v: VueloVista,
  dateKey: string,
  horaInicio: string,
  horaFin: string
): boolean => {
  if (!esMismoDia(v.fechaHora, dateKey)) return false;
  const hh = horaLocalHHMM(v.fechaHora);
  return hh >= horaInicio && hh < horaFin;
};

/**
 * Pilotos activos y disponibles para el día (misma lógica que la página):
 * `disponibilidadTotal ? !excepcion : excepcion`. La excepción es un item de
 * `excepciones[]` cuya `fecha` empieza con `dateKey`.
 */
export const pilotosDisponiblesDia = (pilotos: PilotoDia[], dateKey: string): PilotoDia[] => {
  return pilotos.filter((p) => {
    if (!p.activo) return false;
    const hasException = (p.excepciones || []).some((ex) => ex.fecha.startsWith(dateKey));
    return p.disponibilidadTotal ? !hasException : hasException;
  });
};

/**
 * Vuelos del bloque agrupados por piloto, ordenados alfabéticamente por nombre.
 * Solo incluye pilotos que tienen vuelos dentro del bloque.
 */
export const agruparVuelosPorPiloto = (
  vuelos: VueloVista[],
  dateKey: string,
  horaInicio: string,
  horaFin: string
): GrupoCarril[] => {
  const enBloque = vuelos.filter((v) => vueloEnBloque(v, dateKey, horaInicio, horaFin));
  return agruparVuelosPorLista(enBloque);
};

/**
 * Agrupa una lista arbitraria de vuelos por piloto, ordenados alfabéticamente por nombre.
 * Utilizado para agrupar vuelos fuera de los bloques configurados.
 */
export const agruparVuelosPorLista = (vuelos: VueloVista[]): GrupoCarril[] => {
  const mapa = new Map<number, GrupoCarril>();
  for (const v of vuelos) {
    let grupo = mapa.get(v.pilotoId);
    if (!grupo) {
      grupo = {
        pilotoId: v.pilotoId,
        nombre: v.piloto?.nombre ?? `Piloto #${v.pilotoId}`,
        vuelos: [],
      };
      mapa.set(v.pilotoId, grupo);
    }
    grupo.vuelos.push(v);
  }
  return Array.from(mapa.values()).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
};

/**
 * Número de pilotos disponibles ese día que NO tienen vuelos en el bloque.
 * Útil para el carril fantasma "Libres (+N)".
 */
export const pilotosLibresEnBloque = (
  disponibles: PilotoDia[],
  carriles: GrupoCarril[]
): number => {
  const conVuelos = new Set(carriles.map((c) => c.pilotoId));
  return disponibles.filter((p) => !conVuelos.has(p.id)).length;
};
