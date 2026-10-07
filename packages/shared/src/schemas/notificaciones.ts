import { z } from 'zod';

export type TipoNotificacionClave = 'RECORDATORIO_24H' | 'AVISO_CLIMA_CANCELACION';

export const NotificacionConfigSchema = z.object({
  id: z.number(),
  recordatorio24hActivo: z.boolean(),
  avisoClimaActivo: z.boolean(),
  version: z.number(),
  createdAt: z.string().or(z.date()).optional(),
  updatedAt: z.string().or(z.date()).optional(),
});
export type NotificacionConfigDTO = z.infer<typeof NotificacionConfigSchema>;

export const UpdateNotificacionConfigPayloadSchema = z.object({
  recordatorio24hActivo: z.boolean().optional(),
  avisoClimaActivo: z.boolean().optional(),
  /** Versión conocida por el cliente (ADR 004, 409 si staleness). */
  version: z.number().int().min(0),
});
export type UpdateNotificacionConfigPayload = z.infer<typeof UpdateNotificacionConfigPayloadSchema>;

export const NOTIFICACIONES_QUERY_KEY = ['notificaciones-config'] as const;
