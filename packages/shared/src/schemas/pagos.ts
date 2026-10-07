import { z } from 'zod';
import { MetodoPagoEnum } from './enums';

export const PagoSchema = z.object({
  id: z.number().optional(),
  monto: z.number().positive("El monto del pago debe ser mayor a 0"),
  metodoPago: MetodoPagoEnum.default('TRANSFERENCIA'),
  fecha: z.string().or(z.date()).optional(),
  comprobante: z.string().optional().nullable(),
  notas: z.string().optional().nullable(),
  version: z.number().optional(),
  reservaId: z.number().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});
export type PagoDTO = z.infer<typeof PagoSchema>;

export const CreatePagoPayloadSchema = PagoSchema.omit({ id: true, createdAt: true, updatedAt: true });
export type CreatePagoPayload = z.infer<typeof CreatePagoPayloadSchema>;

// DEVOLUCIÓN (Fase 2 del ciclo de vida): espejo de Pago. `Reserva.montoDevuelto`
// se denormaliza igual que `abono`; la suma de devoluciones no puede exceder el
// total pagado (regla validada en el servicio).
export const DevolucionSchema = z.object({
  id: z.number().optional(),
  monto: z.number().positive("El monto de la devolución debe ser mayor a 0"),
  metodoPago: MetodoPagoEnum.default('TRANSFERENCIA'),
  fecha: z.string().or(z.date()).optional(),
  comprobante: z.string().optional().nullable(),
  notas: z.string().optional().nullable(),
  version: z.number().optional(),
  reservaId: z.number().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});
export type DevolucionDTO = z.infer<typeof DevolucionSchema>;

export const CreateDevolucionPayloadSchema = DevolucionSchema.omit({ id: true, createdAt: true, updatedAt: true });
export type CreateDevolucionPayload = z.input<typeof CreateDevolucionPayloadSchema>;
