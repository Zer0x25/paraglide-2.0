export interface PasajeroPublico {
  id: number;
  nombre: string;
  rutDni?: string | null;
  peso?: number | null;
  pesoVerificado?: number | null;
  firmaDeslinde: boolean;
}

export interface TarifaPublica {
  id: number;
  nombre: string;
  precio: number;
}

export interface PromocionPublica {
  id: number;
  nombre: string;
  tipoDescuento: string;
  valor: number;
}

export interface ReservaPublica {
  id: number;
  tokenPublico?: string | null;
  shortId?: string | null;
  numeroReserva?: string | null;
  nombreTitular: string;
  telefono: string;
  email?: string | null;
  fechaAgenda?: string | null;
  horaAgenda?: string | null;
  esGiftCard?: boolean;
  estado?: string | null;
  estadoPago: string;
  valorTotal: number;
  abono: number;
  montoDevuelto?: number | null;
  descuento?: number | null;
  tarifa?: TarifaPublica | null;
  promocion?: PromocionPublica | null;
  pasajeros: PasajeroPublico[];
}

export interface ReglaOperativaPublica {
  categoria?: string;
  esDefault?: boolean;
  clave?: string;
  valor?: string;
}
