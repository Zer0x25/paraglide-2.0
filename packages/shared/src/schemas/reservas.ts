import { z } from 'zod';
import { EstadoPagoEnum, EstadoReservaEnum, EstadoPago, EstadoReserva, EstadoPasajero, MetodoPagoEnum } from './enums';
import { PasajeroSchema } from './pasajeros';

export const ReservaSchema = z.object({
  id: z.number().optional(),
  numeroReserva: z.string().optional(),
  tokenPublico: z.string().optional(),
  shortId: z.string().optional(),
  rutDniTitular: z.string().optional().nullable(),
  nombreTitular: z.string().min(1, "El nombre del titular es obligatorio"),
  telefono: z.string().optional().nullable(),
  email: z.string().email("Correo electrónico inválido (ej: nombre@correo.com)").optional().nullable().or(z.literal('')),
  esGiftCard: z.boolean().default(false),
  fechaAgenda: z.string().or(z.date()).optional().nullable().or(z.literal('')),
  horaAgenda: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Formato de hora inválido (HH:mm, ej: 09:00)").optional().nullable().or(z.literal('')),
  estadoPago: EstadoPagoEnum.default('PENDIENTE'),
  // Fase 1: ciclo de vida formal de la reserva. Defaults/nullable para no
  // romper mocks ni payloads existentes.
  estado: EstadoReservaEnum.default('SIN_AGENDAR'),
  motivoCancelacion: z.string().optional().nullable(),
  fechaCancelacion: z.string().or(z.date()).optional().nullable(),
  valorTotal: z.number().min(0, "El valor total no puede ser negativo").default(0),
  abono: z.number().min(0, "El abono no puede ser negativo").default(0),
  // Fase 2 (ciclo de vida): monto devuelto al cliente (denormalizado como abono).
  // Si es > 0, el estado de pago se deriva a DEVUELTO (prima sobre todo).
  montoDevuelto: z.number().default(0),
  // Fase 2: tarifa/promoción aplicada (snapshot del cálculo de valor).
  // Opcionales para no romper reservas legacy sin tarifa.
  tarifaId: z.number().optional().nullable(),
  promocionId: z.number().optional().nullable(),
  descuento: z.number().default(0),
  // Fase 2 (inmutabilidad y snapshot contable):
  cerradaAt: z.string().or(z.date()).optional().nullable(),
  snapshotJson: z.unknown().optional().nullable(),
  version: z.number().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export type ReservaDTO = z.infer<typeof ReservaSchema>;

// ========================
// CICLO DE VIDA: funciones puras compartidas E2E
// ========================

/**
 * Deriva el estado de pago a partir del dinero. Única fuente de verdad para
 * create/update/addPago/deletePago/addDevolucion/deleteDevolucion (ADR 008:
 * el caller normaliza con toNum()).
 *
 * Fase 2 (ciclo de vida): si hay devolución registrada (`montoDevuelto > 0`),
 * el estado es SIEMPRE DEVUELTO (prima sobre cualquier otra derivación).
 */
export function derivarEstadoPago(valorTotal: number, abono: number, montoDevuelto = 0): EstadoPago {
  if (montoDevuelto > 0) return 'DEVUELTO';
  if (abono >= valorTotal && valorTotal > 0) return 'PAGADO';
  if (abono > 0) return 'ABONADO';
  return 'PENDIENTE';
}

/**
 * Deriva el estado de la reserva a partir de los estados de vuelo de sus pasajeros.
 * - Todos VUELO_COMPLETADO (y pago PAGADO) → COMPLETADA.
 * - Todos CANCELADO → CANCELADA.
 * - Mezcla de estados o pendientes → null (mantiene el estado actual).
 */
export function derivarEstadoReservaPorPasajeros(
  estados: EstadoPasajero[],
  estadoPago?: EstadoPago,
  valorTotal?: number
): EstadoReserva | null {
  if (estados.length === 0) return null;
  if (estados.every((e) => e === 'VUELO_COMPLETADO')) {
    // Regla de negocio: solo se considera COMPLETADA si además el pago está totalmente saldado (PAGADO) o si es cortesía (valorTotal <= 0).
    const esGratis = valorTotal !== undefined && valorTotal <= 0;
    return estadoPago === 'PAGADO' || esGratis ? 'COMPLETADA' : null;
  }
  if (estados.every((e) => e === 'CANCELADO')) {
    return 'CANCELADA';
  }
  return null;
}

/**
 * Nomenclatura unificada de ciclo de vida por pasajero (mismo idioma que la reserva padre).
 * Permite saber si el pasajero está sin agendar, agendado, completado o cancelado.
 */
export type EstadoVueloPasajero = 'SIN_AGENDAR' | 'AGENDADO' | 'COMPLETADO' | 'CANCELADO';

export function derivarEstadoVueloPasajero(pax: {
  vuelos?: { estado: string; deletedAt?: string | Date | null }[];
  estado?: string;
}): EstadoVueloPasajero {
  const vuelosActivos = (pax.vuelos || []).filter((v) => !v.deletedAt);
  if (vuelosActivos.length === 0) {
    if (pax.estado === 'CANCELADO') return 'CANCELADO';
    return 'SIN_AGENDAR';
  }
  if (vuelosActivos.some((v) => v.estado === 'COMPLETADO') || pax.estado === 'VUELO_COMPLETADO') {
    return 'COMPLETADO';
  }
  if (vuelosActivos.some((v) => v.estado === 'AGENDADO')) {
    return 'AGENDADO';
  }
  if (vuelosActivos.every((v) => v.estado === 'CANCELADO') || pax.estado === 'CANCELADO') {
    return 'CANCELADO';
  }
  return 'SIN_AGENDAR';
}

export const DesagendarReservaPayloadSchema = z.object({
  version: z.number().int().optional(),
});
export type DesagendarReservaPayload = z.infer<typeof DesagendarReservaPayloadSchema>;

export const CancelarReservaPayloadSchema = z.object({
  motivo: z.string({ required_error: 'El motivo de cancelación es obligatorio' }).min(1, 'El motivo de cancelación es obligatorio'),
  version: z.number().int().optional(),
  devolucion: z
    .object({
      monto: z.number().positive('El monto a devolver debe ser mayor a 0'),
      metodoPago: z.enum(['TRANSFERENCIA', 'EFECTIVO', 'WEBPAY', 'TARJETA', 'OTRO']).optional(),
      comprobante: z.string().optional(),
      notas: z.string().optional(),
    })
    .optional(),
});
export type CancelarReservaPayload = z.infer<typeof CancelarReservaPayloadSchema>;


// PAYLOADS PARA API
export const CreateReservaPayloadSchema = ReservaSchema.omit({
  id: true,
  numeroReserva: true,
  tokenPublico: true,
  shortId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  metodoPago: MetodoPagoEnum.optional(),
  comprobantePago: z.string().optional().nullable(),
  notasPago: z.string().optional().nullable(),
  pasajeros: z.array(PasajeroSchema.omit({
    reservaId: true,
    numeroPasajero: true,
    tokenPublico: true,
    shortId: true,
    createdAt: true,
    updatedAt: true,
  })).optional(),
});
// z.input (no z.infer): los campos con .default (estado, estadoPago, valorTotal...)
// deben ser OPCIONALES para quien envía el payload (agente, simulador, web).
export type CreateReservaPayload = z.input<typeof CreateReservaPayloadSchema>;

// Punto 3 (auditoría 2026-09-29): `abono` y `montoDevuelto` son importes DERIVADOS —
// `abono` == suma de pagos activos y `montoDevuelto` == suma de devoluciones activas.
// No se aceptan en la edición: solo cambian vía los endpoints de pagos y devoluciones
// (con su historial contable). Esto hace el invariante estructural, no procedural.
export const UpdateReservaPayloadSchema = ReservaSchema.omit({
  abono: true,
  montoDevuelto: true,
}).partial().extend({
  pasajeros: z.array(PasajeroSchema.omit({
    reservaId: true,
    numeroPasajero: true,
    tokenPublico: true,
    shortId: true,
    createdAt: true,
    updatedAt: true,
  })).optional(),
});
export type UpdateReservaPayload = z.input<typeof UpdateReservaPayloadSchema>;
