import { z } from 'zod';
import { CanalMensajeEnum } from './enums';

export const CreatePlantillaMensajePayloadSchema = z.object({
  tipo: z.string().min(2, 'El tipo es requerido'),
  titulo: z.string().min(2, 'El título es requerido'),
  canal: CanalMensajeEnum.default('WHATSAPP'),
  cuerpo: z.string().min(5, 'El cuerpo del mensaje es requerido'),
  variables: z.string().nullable().optional(),
  activo: z.boolean().default(true),
});
export type CreatePlantillaMensajePayload = z.infer<typeof CreatePlantillaMensajePayloadSchema>;

export const PlantillaMensajeDTOSchema = CreatePlantillaMensajePayloadSchema.extend({
  id: z.number(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});
export type PlantillaMensajeDTO = z.infer<typeof PlantillaMensajeDTOSchema>;
