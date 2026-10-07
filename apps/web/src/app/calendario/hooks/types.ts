import type { EstadoVuelo } from '@parapente/shared';

export interface Vuelo {
  id: number;
  pilotoId: number;
  pasajeroId: number;
  reservaId?: number | null;
  fechaHora: string;
  estado: EstadoVuelo;
  valorPactado: number;
  version?: number;
  piloto?: { nombre: string };
  pasajero?: { nombre: string; reservaId?: number | null };
  reserva?: {
    id: number;
    numeroReserva?: string;
    estado: string;
    estadoPago: string;
    abono: number;
    valorTotal: number;
    cerradaAt?: string | Date | null;
  };
}

export interface Disponibilidad {
  id: number;
  fecha: string;
}

export interface Piloto {
  id: number;
  nombre: string;
  activo: boolean;
  prioridad: number;
  disponibilidad: Disponibilidad[];
  excepciones: { fecha: string }[];
  disponibilidadTotal: boolean;
  categoria?: string | null;
  pesoMaximoPasajero?: number | null;
}

export interface Pasajero {
  id: number;
  nombre: string;
  reservaId: number | null;
  peso?: number | null;
  pesoVerificado?: number | null;
  numeroPasajero?: string | null;
  rutDni?: string | null;
  firmaDeslinde?: boolean;
}

export interface HorarioBloque {
  horaInicio: string;
  horaFin: string;
}

export interface ConfiguracionBloque {
  id: number;
  nombre: string;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  fechaExacta?: string | null;
  bloqueado: boolean;
  horarios: HorarioBloque[];
}

/** Recurso de un slot resumen del mes (hoy/pasado/bloqueado/bloque). */
export type CalendarSummaryResource =
  | { date: Date; isPastSummary: true; completados: number; total: number }
  | { date: Date; isBlockSummary: false; isBloqueado: true; isPastSummary: false }
  | {
      date: Date;
      isBlockSummary: true;
      isPastSummary: false;
      isBloqueado: false;
      block: HorarioBloque;
      reservas: number;
      disponibles: number;
      totalPilotos: number;
    };

export interface CalendarEvent {
  title: string;
  start: Date;
  end: Date;
  resource: Vuelo | CalendarSummaryResource;
  isSummary?: boolean;
}

export interface FormDataVuelo {
  pilotoId: string;
  pasajeroId: string;
  fecha: string;
  hora: string;
  valorPactado: string;
}

export type PasajeroParaPendiente = { vuelos?: Array<{ estado: string }> | null };

export function isSummaryResource(r: Vuelo | CalendarSummaryResource): r is CalendarSummaryResource {
  return typeof (r as CalendarSummaryResource).date !== 'undefined' && !('pilotoId' in r);
}
