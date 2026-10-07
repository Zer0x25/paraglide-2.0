import { z } from 'zod';
import { TipoEquipoEnum, EstadoEquipoEnum } from './enums';

export const CreateMantenimientoPayloadSchema = z.object({
  fecha: z.string().or(z.date()).optional(),
  tipo: z.string().min(2, 'El tipo de mantenimiento es requerido'),
  descripcion: z.string().min(3, 'La descripción es requerida'),
  taller: z.string().nullable().optional(),
  costo: z.number().nonnegative().default(0),
  version: z.number().optional(),
  comprobante: z.string().nullable().optional(),
  proximaRevision: z.string().or(z.date()).nullable().optional(),
});
export type CreateMantenimientoPayload = z.infer<typeof CreateMantenimientoPayloadSchema>;

export const MantenimientoEquipoDTOSchema = z.object({
  id: z.number(),
  fecha: z.string().or(z.date()),
  tipo: z.string(),
  descripcion: z.string(),
  taller: z.string().nullable().optional(),
  costo: z.number(),
  version: z.number().optional(),
  comprobante: z.string().nullable().optional(),
  equipoId: z.number(),
  createdAt: z.string().or(z.date()),
});
export type MantenimientoEquipoDTO = z.infer<typeof MantenimientoEquipoDTOSchema>;

export const CreateEquipoPayloadSchema = z.object({
  codigo: z.string().min(2, 'El código es requerido (ej: VELA-01)'),
  nombre: z.string().min(2, 'El nombre o modelo es requerido'),
  tipo: TipoEquipoEnum.default('VELA'),
  marca: z.string().nullable().optional(),
  modelo: z.string().nullable().optional(),
  numeroSerie: z.string().nullable().optional(),
  anoFabricacion: z.number().min(1990).max(2050).nullable().optional(),
  fechaAdquisicion: z.string().or(z.date()).nullable().optional(),
  estado: EstadoEquipoEnum.default('OPERATIVO'),
  horasVueloEstimadas: z.number().nonnegative().default(0),
  vuelosRealizados: z.number().int().nonnegative().default(0),
  limiteHorasInspeccion: z.number().nonnegative().nullable().optional().default(100),
  fechaUltimaRevision: z.string().or(z.date()).nullable().optional(),
  fechaProximaRevision: z.string().or(z.date()).nullable().optional(),
  notas: z.string().nullable().optional(),
  pilotoAsignadoId: z.number().nullable().optional(),
  version: z.number().optional(),
});
export type CreateEquipoPayload = z.infer<typeof CreateEquipoPayloadSchema>;

export const EquipoDTOSchema = CreateEquipoPayloadSchema.extend({
  id: z.number(),
  pilotoAsignado: z.object({
    id: z.number(),
    nombre: z.string(),
  }).nullable().optional(),
  mantenimientos: z.array(MantenimientoEquipoDTOSchema).optional(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});
export type EquipoDTO = z.infer<typeof EquipoDTOSchema>;
