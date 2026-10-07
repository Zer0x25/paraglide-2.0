import { z } from 'zod';

export const RoleEnum = z.enum(['ADMIN', 'PILOTO', 'RECEPCION']);
export const EstadoPagoEnum = z.enum(['PENDIENTE', 'ABONADO', 'PAGADO', 'DEVUELTO']);
export const EstadoVueloEnum = z.enum(['AGENDADO', 'COMPLETADO', 'CANCELADO']);
export const EstadoReservaEnum = z.enum(['SIN_AGENDAR', 'AGENDADA', 'COMPLETADA', 'CANCELADA']);
export const EstadoPasajeroEnum = z.enum(['POR_VOLAR', 'VUELO_COMPLETADO', 'CANCELADO']);
export const CategoriaPilotoEnum = z.enum(['MASTER', 'SENIOR', 'JUNIOR', 'STANDARD']);

export type Role = z.infer<typeof RoleEnum>;
export type EstadoPago = z.infer<typeof EstadoPagoEnum>;
export type EstadoVuelo = z.infer<typeof EstadoVueloEnum>;
export type EstadoReserva = z.infer<typeof EstadoReservaEnum>;
export type EstadoPasajero = z.infer<typeof EstadoPasajeroEnum>;
export type CategoriaPiloto = z.infer<typeof CategoriaPilotoEnum>;

export const MetodoPagoEnum = z.enum(['TRANSFERENCIA', 'EFECTIVO', 'WEBPAY', 'TARJETA', 'OTRO']);
export type MetodoPago = z.infer<typeof MetodoPagoEnum>;

export const TipoEquipoEnum = z.enum([
  'VELA',
  'ARNES_PILOTO',
  'ARNES_PASAJERO',
  'PARACAIDAS_EMERGENCIA',
  'CASCO',
  'MOSQUETONES',
  'OTRO',
]);
export type TipoEquipo = z.infer<typeof TipoEquipoEnum>;

export const EstadoEquipoEnum = z.enum([
  'OPERATIVO',
  'EN_MANTENIMIENTO',
  'REVISION_PENDIENTE',
  'DE_BAJA',
]);
export type EstadoEquipo = z.infer<typeof EstadoEquipoEnum>;

export const EstadoPistaEnum = z.enum(['ABIERTA', 'PRECAUCION', 'CERRADA']);
export type EstadoPista = z.infer<typeof EstadoPistaEnum>;

export const CanalMensajeEnum = z.enum(['WHATSAPP', 'EMAIL', 'SMS']);
export type CanalMensaje = z.infer<typeof CanalMensajeEnum>;

export const TipoDescuentoEnum = z.enum(['PORCENTAJE', 'MONTO_FIJO']);
export type TipoDescuento = z.infer<typeof TipoDescuentoEnum>;

export const CategoriaReglaEnum = z.enum([
  'AGENDAMIENTO',
  'SEGURIDAD',
  'CONTACTO',
  'PAGOS',
  'PUNTO_ENCUENTRO',
]);
export type CategoriaRegla = z.infer<typeof CategoriaReglaEnum>;
