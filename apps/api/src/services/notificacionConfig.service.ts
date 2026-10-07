import { prisma } from '../plugins/prisma';
import { broadcastDatos } from '../services/eventos.service';
import type { NotificacionConfigDTO } from '@parapente/shared';

export type NotificacionConfigRow = {
  id: number;
  recordatorio24hActivo: boolean;
  avisoClimaActivo: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

export async function getNotificacionConfig(): Promise<NotificacionConfigRow> {
  let row = (await (prisma as unknown as { notificacionConfig: { findFirst: (a: unknown) => Promise<NotificacionConfigRow | null> } }).notificacionConfig.findFirst({})) ?? null;
  if (!row) {
    row = await (prisma as unknown as { notificacionConfig: { create: (a: unknown) => Promise<NotificacionConfigRow> } }).notificacionConfig.create({
      data: { recordatorio24hActivo: true, avisoClimaActivo: true, version: 1 },
    });
  }
  return row;
}

export async function getNotificacionConfigSafe(): Promise<NotificacionConfigRow | null> {
  try {
    return await getNotificacionConfig();
  } catch {
    return {
      id: 1,
      recordatorio24hActivo: true,
      avisoClimaActivo: true,
      version: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}

export async function isRecordatorio24hActivo(): Promise<boolean> {
  const cfg = await getNotificacionConfigSafe();
  return cfg ? cfg.recordatorio24hActivo : true;
}

export async function isAvisoClimaActivo(): Promise<boolean> {
  const cfg = await getNotificacionConfigSafe();
  return cfg ? cfg.avisoClimaActivo : true;
}

export async function updateNotificacionConfig(
  payload: { recordatorio24hActivo?: boolean; avisoClimaActivo?: boolean; version: number },
): Promise<NotificacionConfigRow> {
  const existente = await getNotificacionConfig();
  if (payload.version !== existente.version) {
    const err = Object.assign(new Error('version conflict'), { code: 'VERSION_CONFLICT' as const, statusCode: 409 });
    throw err;
  }
  const data: Record<string, unknown> = { version: { increment: 1 } as unknown as number };
  if (typeof payload.recordatorio24hActivo === 'boolean') data.recordatorio24hActivo = payload.recordatorio24hActivo;
  if (typeof payload.avisoClimaActivo === 'boolean') data.avisoClimaActivo = payload.avisoClimaActivo;
  const actualizado = await (prisma as unknown as {
    notificacionConfig: { update: (a: unknown) => Promise<NotificacionConfigRow> };
  }).notificacionConfig.update({
    where: { id: existente.id },
    data: data as never,
  });
  // Notificar SSE de forma no bloqueante (Pilar 6); el cliente invalida ['notificaciones-config']
  try {
    broadcastDatos('notificacion-config', 'actualizar');
  } catch {}
  return actualizado;
}
