import type { ReservaDTO, PasajeroDTO, VueloDTO, PilotoDTO, PagoDTO, TarifaDTO, PromocionDTO } from '@parapente/shared';

export type VueloConPiloto = VueloDTO & { piloto?: Pick<PilotoDTO, 'id' | 'nombre' | 'telefono'> | null };

export type PasajeroConVuelos = PasajeroDTO & { vuelos?: VueloConPiloto[] | null };

export type ReservaConPasajeros = ReservaDTO & {
  pasajeros: PasajeroConVuelos[];
  pagos?: PagoDTO[];
  tarifa?: TarifaDTO | null;
  promocion?: PromocionDTO | null;
  numeroReserva?: string | number;
  tokenPublico?: string | null;
  shortId?: string | null;
};
