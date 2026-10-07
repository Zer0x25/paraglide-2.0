import { z } from 'zod';
import { TipoDescuentoEnum, CategoriaReglaEnum } from './enums';

// TARIFA
export const TarifaSchema = z.object({
  id: z.number().optional(),
  nombre: z.string().min(1, 'El nombre es obligatorio'),
  descripcion: z.string().optional().nullable(),
  precio: z.number().positive('El precio debe ser mayor a 0'), // Decimal(12,2) serializado como number por la API (ADR 008)
  activo: z.boolean().default(true),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});
export type TarifaDTO = z.infer<typeof TarifaSchema>;

export const CreateTarifaPayloadSchema = TarifaSchema.omit({ id: true, createdAt: true, updatedAt: true });
// z.input (no z.infer): los campos con .default (activo) deben ser OPCIONALES
// para quien envía el payload.
export type CreateTarifaPayload = z.input<typeof CreateTarifaPayloadSchema>;

// PROMOCIÓN
export const PromocionSchema = z.object({
  id: z.number().optional(),
  nombre: z.string().min(1, 'El nombre es obligatorio'),
  descripcion: z.string().optional().nullable(),
  tipoDescuento: TipoDescuentoEnum,
  valor: z.number().positive('El valor debe ser mayor a 0'),
  fechaInicio: z.string().or(z.date()).optional().nullable(),
  fechaFin: z.string().or(z.date()).optional().nullable(),
  activa: z.boolean().default(true),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});
export type PromocionDTO = z.infer<typeof PromocionSchema>;

export const CreatePromocionPayloadSchema = PromocionSchema.omit({ id: true, createdAt: true, updatedAt: true }).superRefine((data, ctx) => {
  if (data.tipoDescuento === 'PORCENTAJE' && data.valor > 100) {
    ctx.addIssue({
      code: z.ZodIssueCode.too_big,
      type: 'number',
      maximum: 100,
      inclusive: true,
      path: ['valor'],
      message: 'Un porcentaje no puede superar 100',
    });
  }
  if (
    data.fechaInicio != null &&
    data.fechaFin != null &&
    new Date(data.fechaInicio).getTime() > new Date(data.fechaFin).getTime()
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['fechaFin'],
      message: 'La fecha de fin debe ser posterior a la fecha de inicio',
    });
  }
});
export type CreatePromocionPayload = z.input<typeof CreatePromocionPayloadSchema>;

// Update parcial: los campos son opcionales y las validaciones cruzadas solo
// aplican cuando AMBAS fechas están presentes en el payload.
export const UpdatePromocionPayloadSchema = PromocionSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})
  .partial()
  .superRefine((data, ctx) => {
    if (
      data.fechaInicio != null &&
      data.fechaFin != null &&
      new Date(data.fechaInicio).getTime() > new Date(data.fechaFin).getTime()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['fechaFin'],
        message: 'La fecha de fin debe ser posterior a la fecha de inicio',
      });
    }
  });
export type UpdatePromocionPayload = z.input<typeof UpdatePromocionPayloadSchema>;

// FAQ
export const FaqSchema = z.object({
  id: z.number().optional(),
  pregunta: z.string().min(1, 'La pregunta es obligatoria'),
  respuesta: z.string().min(1, 'La respuesta es obligatoria'),
  orden: z.number().int().default(0),
  publica: z.boolean().default(true),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});
export type FaqDTO = z.infer<typeof FaqSchema>;

export const CreateFaqPayloadSchema = FaqSchema.omit({ id: true, createdAt: true, updatedAt: true });
export type CreateFaqPayload = z.input<typeof CreateFaqPayloadSchema>;

// DESLINDE (historial legal inmutable; solo el flag `activa` cambia.
// `version` = número legal inmutable; `revision` = token de concurrencia)
export const DeslindeVersionSchema = z.object({
  id: z.number().optional(),
  version: z.number().optional(),
  revision: z.number().optional(),
  titulo: z.string().default('Deslinde de Responsabilidad'),
  texto: z.string().min(1, 'El texto es obligatorio'),
  activa: z.boolean().default(false),
  createdAt: z.string().or(z.date()).optional(),
});
export type DeslindeVersionDTO = z.infer<typeof DeslindeVersionSchema>;

export const CreateDeslindePayloadSchema = DeslindeVersionSchema.omit({ id: true, version: true, createdAt: true });
export type CreateDeslindePayload = z.input<typeof CreateDeslindePayloadSchema>;

// REGLA OPERATIVA (upsert clave-valor; la clave viaja en la URL)
export const ReglaOperativaSchema = z.object({
  id: z.number().optional(),
  clave: z.string().min(1, 'La clave es obligatoria'),
  valor: z.string().min(1, 'El valor es obligatorio'),
  descripcion: z.string().optional().nullable(),
  categoria: CategoriaReglaEnum,
  esDefault: z.boolean().optional().default(false),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});
export type ReglaOperativaDTO = z.infer<typeof ReglaOperativaSchema>;

export const UpsertReglaPayloadSchema = ReglaOperativaSchema.omit({ id: true, clave: true, createdAt: true, updatedAt: true });
export type UpsertReglaPayload = z.input<typeof UpsertReglaPayloadSchema>;

// CÁLCULO DE VALOR
export const CalcularValorPayloadSchema = z.object({
  tarifaId: z.number().int(),
  promocionId: z.number().int().optional(),
  cantidadPasajeros: z.number().int().positive('La cantidad de pasajeros debe ser mayor a 0'),
});
// z.input: promocionId es opcional para quien envía el payload.
export type CalcularValorPayload = z.input<typeof CalcularValorPayloadSchema>;

export const CalculoValorDTOSchema = z.object({
  precioBase: z.number(),
  descuento: z.number(),
  valorTotal: z.number(),
  detalle: z.string(),
});
export type CalculoValorDTO = z.infer<typeof CalculoValorDTOSchema>;

// EMPRESA
export const EmpresaSchema = z.object({
  id: z.number().optional(),
  nombre: z.string().min(1, 'El nombre es obligatorio'),
  slogan: z.string().optional().nullable(),
  telefono: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  direccion: z.string().optional().nullable(),
  logoUrl: z.string().optional().nullable(),
  horario: z.string().optional().nullable(),
  redesSociales: z.record(z.string(), z.unknown()).optional().nullable(),
  version: z.number().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});
export type EmpresaDTO = z.infer<typeof EmpresaSchema>;

export const UpdateEmpresaPayloadSchema = EmpresaSchema.omit({
  id: true,
  version: true,
  createdAt: true,
  updatedAt: true,
}).partial();
export type UpdateEmpresaPayload = z.input<typeof UpdateEmpresaPayloadSchema>;
