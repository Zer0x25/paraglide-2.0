import { z } from 'zod';
import { EstadoVueloEnum, EstadoVuelo } from './enums';

export const VueloSchema = z.object({
  id: z.number().optional(),
  fechaHora: z.string().or(z.date()),
  valorPactado: z.number(),
  pagoPiloto: z.number().default(0),
  estado: EstadoVueloEnum.default('AGENDADO'),
  version: z.number().optional(),
  reservaId: z.number().int(),
  pilotoId: z.number().int(),
  pasajeroId: z.number().int(),
  equipoId: z.number().int().optional().nullable(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export type VueloDTO = z.infer<typeof VueloSchema>;

export const CreateVueloPayloadSchema = VueloSchema.omit({ id: true, createdAt: true, updatedAt: true }).extend({
  reservaId: z.number().int().optional(),
});
export type CreateVueloPayload = z.infer<typeof CreateVueloPayloadSchema>;

/** Mapa de transiciones válidas de EstadoVuelo. COMPLETADO es terminal. */
export const TRANSICIONES_VUELO: Record<EstadoVuelo, EstadoVuelo[]> = {
  AGENDADO: ['COMPLETADO', 'CANCELADO'],
  CANCELADO: ['AGENDADO'],
  COMPLETADO: [],
};

/** ¿Se puede pasar del vuelo `desde` al estado `hasta`? */
export function puedeTransicionarEstadoVuelo(desde: EstadoVuelo, hasta: EstadoVuelo): boolean {
  return (TRANSICIONES_VUELO[desde] ?? []).includes(hasta);
}
