import { z } from 'zod';
import { CategoriaPilotoEnum } from './enums';

export const PilotoSchema = z.object({
  id: z.number().optional(),
  nombre: z.string().min(1, "El nombre es obligatorio"),
  rutDni: z.string().optional().nullable(),
  telefono: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  activo: z.boolean().default(true),
  peso: z.number().int("El peso debe ser un número entero en kg").optional().nullable(),
  tieneLicencia: z.boolean().default(false),
  numeroLicencia: z.string().optional().nullable(),
  fechaVencimientoLicencia: z.string().or(z.date()).optional().nullable(),
  prioridad: z.number().default(1), // 1 = Máxima Prioridad/Master, 2 = Senior, 3 = Junior
  categoria: CategoriaPilotoEnum.optional().nullable().default("MASTER"),
  pesoMinimoPasajero: z.number().int("El peso mínimo debe ser un número entero en kg").optional().nullable().default(30),
  pesoMaximoPasajero: z.number().int("El peso máximo debe ser un número entero en kg").optional().nullable().default(110),
  disponibilidadTotal: z.boolean().default(true),
  tarifaPorVuelo: z.number().default(0),
  version: z.number().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export type PilotoDTO = z.infer<typeof PilotoSchema>;

export const SugerirPilotoPayloadSchema = z.object({
  fechaHora: z.string().or(z.date()),
  pesoPasajero: z.number().int("El peso debe ser un número entero en kg").optional().nullable(),
  pasajeroId: z.number().optional().nullable(),
});
export type SugerirPilotoPayload = z.infer<typeof SugerirPilotoPayloadSchema>;
