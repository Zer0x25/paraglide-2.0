import { z } from 'zod';

export const CreateLogAuditoriaPayloadSchema = z.object({
  usuarioId: z.number().nullable().optional(),
  usuarioEmail: z.string().nullable().optional(),
  usuarioNombre: z.string().nullable().optional(),
  accion: z.string(),
  entidad: z.string(),
  entidadId: z.string().nullable().optional(),
  descripcion: z.string(),
  detalles: z.string().nullable().optional(),
  ip: z.string().nullable().optional(),
});
export type CreateLogAuditoriaPayload = z.infer<typeof CreateLogAuditoriaPayloadSchema>;

export const LogAuditoriaDTOSchema = CreateLogAuditoriaPayloadSchema.extend({
  id: z.number(),
  fechaHora: z.string().or(z.date()),
  createdAt: z.string().or(z.date()),
});
export type LogAuditoriaDTO = z.infer<typeof LogAuditoriaDTOSchema>;
