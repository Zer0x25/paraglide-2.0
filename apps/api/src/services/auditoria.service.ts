import { prisma } from '../plugins/prisma';
import { CreateLogAuditoriaPayload } from '@parapente/shared';
import { FastifyRequest } from 'fastify';

export class AuditoriaService {
  async log(data: CreateLogAuditoriaPayload) {
    try {
      return await prisma.logAuditoria.create({
        data: {
          usuarioId: data.usuarioId || null,
          usuarioEmail: data.usuarioEmail || null,
          usuarioNombre: data.usuarioNombre || 'Sistema',
          accion: data.accion,
          entidad: data.entidad,
          entidadId: data.entidadId ? String(data.entidadId) : null,
          descripcion: data.descripcion,
          detalles: data.detalles || null,
          ip: data.ip || null,
        },
      });
    } catch (err) {
      console.error('Error al registrar log de auditoría:', err);
      return null;
    }
  }

  async getLogs(opts: {
    filtroEntidad?: string;
    filtroAccion?: string;
    busqueda?: string;
    page?: number;
    pageSize?: number;
    cursor?: string;
  } = {}) {
    const { filtroEntidad, filtroAccion, busqueda, cursor } = opts;
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(500, Math.max(1, opts.pageSize ?? 50));
    const where: any = {
      ...(filtroEntidad && filtroEntidad !== 'TODAS' ? { entidad: filtroEntidad } : {}),
      ...(filtroAccion && filtroAccion !== 'TODAS' ? { accion: filtroAccion } : {}),
      ...(busqueda
        ? {
            OR: [
              { descripcion: { contains: busqueda, mode: 'insensitive' } },
              { usuarioNombre: { contains: busqueda, mode: 'insensitive' } },
              { usuarioEmail: { contains: busqueda, mode: 'insensitive' } },
              { entidadId: { contains: busqueda, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    // Contrato v2 (Pilar 5): keyset pagination por id (desc) para listas
    // temporales no acotadas — sin skip (O(n)) y sin totalPages costoso.
    const useKeyset = !!cursor;
    if (useKeyset) {
      const cursorId = Number(cursor);
      if (!Number.isNaN(cursorId)) where.id = { lt: cursorId };
    }

    const [logs, total] = await Promise.all([
      prisma.logAuditoria.findMany({
        where,
        orderBy: { id: 'desc' },
        ...(useKeyset ? {} : { skip: (page - 1) * pageSize }),
        take: pageSize,
      }),
      prisma.logAuditoria.count({ where }),
    ]);

    const lastId = logs.length > 0 ? logs[logs.length - 1].id : null;
    const hasMore = useKeyset ? logs.length === pageSize && lastId !== null : page * pageSize < total;

    return {
      data: logs,
      pagination: {
        page: useKeyset ? 1 : page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
        hasMore,
        nextCursor: hasMore ? String(lastId) : null,
        nextPage: !useKeyset && hasMore ? page + 1 : null,
      },
    };
  }
}

export const auditoriaService = new AuditoriaService();

export interface LogAuditInput {
  accion: string;
  entidad: string;
  entidadId?: string | number | null;
  descripcion: string;
  detalles?: string | null;
}

/**
 * Registra un log de auditoría extrayendo automáticamente el usuario
 * autenticado (JWT) y la IP de la petición Fastify.
 */
export async function logAudit(req: FastifyRequest, input: LogAuditInput) {
  const user = req.user;
  return auditoriaService.log({
    usuarioId: user?.id ?? null,
    usuarioEmail: user?.email ?? null,
    usuarioNombre: user?.nombre ?? 'Sistema',
    accion: input.accion,
    entidad: input.entidad,
    entidadId: input.entidadId != null ? String(input.entidadId) : null,
    descripcion: input.descripcion,
    detalles: input.detalles ?? null,
    ip: req.ip ?? null,
  });
}
