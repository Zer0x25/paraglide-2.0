import type { EstadoPasajero, PasajeroDTO, ReservaDTO, VueloDTO } from '@parapente/shared';

export type VueloMarcacion = VueloDTO & {
  id: number;
  piloto?: { id: number; nombre: string; telefono?: string | null } | null;
};

export type PasajeroMarcacion = Omit<PasajeroDTO, 'id'> & {
  id: number;
  vuelos?: VueloMarcacion[] | null;
};

export type ReservaMarcacion = Omit<ReservaDTO, 'id'> & {
  id: number;
  pasajeros?: PasajeroMarcacion[] | null;
};

export interface MarcacionRow {
  key: string;
  reserva: ReservaMarcacion;
  pasajero: PasajeroMarcacion;
  vuelo: VueloMarcacion;
  vuelosDia: VueloMarcacion[];
  estado: EstadoPasajero;
  tieneCambio: boolean;
}

export type FiltroMarcacion = 'TODOS' | 'PENDIENTES' | 'VOLADOS' | 'NO_VOLARON';
