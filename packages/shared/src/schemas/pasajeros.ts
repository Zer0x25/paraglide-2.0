import { z } from 'zod';
import { EstadoPasajeroEnum } from './enums';

export const PasajeroSchema = z.object({
  id: z.number().optional(),
  tokenPublico: z.string().optional(),
  shortId: z.string().optional(),
  numeroPasajero: z.string().optional(),
  rutDni: z.string().optional().nullable(),
  nombre: z.string().min(1, "El nombre del pasajero es obligatorio"),
  peso: z.number().int("El peso debe ser un número entero en kg").positive("El peso debe ser mayor a 0").optional().nullable(),
  telefono: z.string().optional().nullable(),
  contactoEmergencia: z.string().optional().nullable(),
  telefonoEmergencia: z.string().optional().nullable(),
  condicionFisica: z.string().optional().nullable(),
  pesoVerificado: z.number().int("El peso verificado debe ser un número entero en kg").positive("El peso verificado debe ser mayor a 0").optional().nullable(),
  firmaDeslinde: z.boolean().default(false),
  firmaFecha: z.string().or(z.date()).optional().nullable(),
  // Estado de vuelo del pasajero (modal de pagos): quién voló. Campo
  // independiente y editable, POR_VOLAR por defecto.
  estado: EstadoPasajeroEnum.default('POR_VOLAR'),
  reservaId: z.number().int(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export type PasajeroDTO = z.infer<typeof PasajeroSchema>;

export const DeslindeFirmaSchema = z.object({
  id: z.number().optional(),
  pasajeroId: z.number().int(),
  firmaBase64: z.string().min(1, "La firma digital es requerida"),
  ip: z.string().optional().nullable(),
  userAgent: z.string().optional().nullable(),
  versionLegal: z.number().int().default(1),
  createdAt: z.date().optional(),
});
export type DeslindeFirmaDTO = z.infer<typeof DeslindeFirmaSchema>;

export const CreatePasajeroPayloadSchema = PasajeroSchema.omit({
  id: true,
  reservaId: true,
  numeroPasajero: true,
  tokenPublico: true,
  shortId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  reservaId: z.number().int().optional(),
});
export type CreatePasajeroPayload = z.infer<typeof CreatePasajeroPayloadSchema>;

export const UpdatePasajeroPayloadSchema = PasajeroSchema.partial();
export type UpdatePasajeroPayload = z.infer<typeof UpdatePasajeroPayloadSchema>;

export const FirmaDeslindePayloadSchema = z.object({
  // Tope de 2 MB: la firma es un data-URL de canvas; sin máximo, el endpoint
  // público aceptaba cuerpos arbitrarios directamente contra la base de datos.
  firmaBase64: z.string().min(1, "La firma digital es requerida").max(2_000_000, "La firma es demasiado grande"),
  rutDni: z.string().optional().nullable(),
  contactoEmergencia: z.string().optional().nullable(),
  telefonoEmergencia: z.string().optional().nullable(),
  condicionFisica: z.string().optional().nullable(),
  pesoVerificado: z.number().int("El peso verificado debe ser un número entero en kg").optional().nullable(),
});
export type FirmaDeslindePayload = z.infer<typeof FirmaDeslindePayloadSchema>;

// Payload batch para marcar el estado de vuelo de los pasajeros de una reserva
// (modal de pagos). Concurrencia optimista vía `version` de la Reserva (ADR 004).
export const ActualizarEstadoPasajerosPayloadSchema = z.object({
  version: z.number().int(),
  pasajeros: z.array(z.object({ id: z.number().int(), estado: EstadoPasajeroEnum })).min(1),
});
export type ActualizarEstadoPasajerosPayload = z.input<typeof ActualizarEstadoPasajerosPayloadSchema>;
