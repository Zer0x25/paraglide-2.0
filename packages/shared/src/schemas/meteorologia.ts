import { z } from 'zod';
import { EstadoPistaEnum, EstadoPista } from './enums';

// El formulario web envía los inputs numéricos como strings (react-hook-form).
// Coercionamos "" -> no enviado y strings numéricos -> number para no romper la
// validación ni el create de Prisma.
const coerceNumber = (schema: z.ZodType<number | null | undefined>) =>
  z.preprocess(
    (v) => {
      if (v === null || v === undefined || v === '') return undefined;
      const n = typeof v === 'number' ? v : Number(v);
      return Number.isNaN(n) ? v : n;
    },
    schema,
  );

export const CreateCondicionPistaPayloadSchema = z.object({
  estadoPista: EstadoPistaEnum.default('ABIERTA'),
  velocidadViento: coerceNumber(z.number().nullable().optional()),
  rachaViento: coerceNumber(z.number().nullable().optional()),
  direccionViento: z.string().nullable().optional(),
  temperatura: coerceNumber(z.number().nullable().optional()),
  visibilidad: z.string().default('EXCELENTE').optional(),
  techoNubes: coerceNumber(z.number().int().nullable().optional()),
  nubosidad: coerceNumber(z.number().int().min(0).max(100).nullable().optional()),
  indiceUv: coerceNumber(z.number().nullable().optional()),
  observaciones: z.string().nullable().optional(),
  registradoPor: z.string().nullable().optional(),
  version: z.number().optional(),
});
export type CreateCondicionPistaPayload = z.infer<typeof CreateCondicionPistaPayloadSchema>;

export const CondicionPistaDTOSchema = CreateCondicionPistaPayloadSchema.extend({
  id: z.number(),
  fechaHora: z.string().or(z.date()),
  createdAt: z.string().or(z.date()),
});
export type CondicionPistaDTO = z.infer<typeof CondicionPistaDTOSchema>;
