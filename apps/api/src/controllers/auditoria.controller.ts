import { FastifyRequest, FastifyReply } from 'fastify';
import { auditoriaService } from '../services/auditoria.service';
import { parsePagination } from '../services/pagination.util';

export class AuditoriaController {
  async getLogs(req: FastifyRequest, reply: FastifyReply) {
    const query = req.query as { entidad?: string; accion?: string; busqueda?: string; limit?: string; page?: string; pageSize?: string; cursor?: string };
    const { entidad, accion, busqueda, cursor } = query;
    const parsed = parsePagination(query);
    const pageSize = query.limit ? Math.min(500, Math.max(1, Number(query.limit) || 100)) : parsed.pageSize;
    const result = await auditoriaService.getLogs({ filtroEntidad: entidad, filtroAccion: accion, busqueda, page: parsed.page, pageSize, cursor });
    return reply.send(result);
  }
}

export const auditoriaController = new AuditoriaController();
