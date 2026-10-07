import { FastifyRequest, FastifyReply } from 'fastify';
import { reportesService, LiquidacionQueryInput } from '../services/reportes.service';

export class ReportesController {
  async getManifiesto(request: FastifyRequest<{ Querystring: { fecha?: string } }>, reply: FastifyReply) {
    const data = await reportesService.getManifiestoDiario(request.query?.fecha);
    return reply.send(data);
  }

  async getManifiestoPdf(request: FastifyRequest<{ Querystring: { fecha?: string } }>, reply: FastifyReply) {
    const { buffer, filename } = await reportesService.generarManifiestoPdf(request.query?.fecha);
    return reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .header('Content-Length', String(buffer.length))
      .send(buffer);
  }

  async getLiquidaciones(request: FastifyRequest<{ Querystring: LiquidacionQueryInput }>, reply: FastifyReply) {
    const data = await reportesService.getLiquidaciones(request.query || {});
    return reply.send(data);
  }

  async getLiquidacionesCsv(request: FastifyRequest<{ Querystring: LiquidacionQueryInput }>, reply: FastifyReply) {
    const { csvContent, filename } = await reportesService.generarLiquidacionesCsv(request.query || {});
    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send(csvContent);
  }

  async getLiquidacionesXlsx(request: FastifyRequest<{ Querystring: LiquidacionQueryInput }>, reply: FastifyReply) {
    const { buffer, filename } = await reportesService.generarLiquidacionesXlsx(request.query || {});
    return reply
      .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .header('Content-Length', String(buffer.length))
      .send(buffer);
  }
}

export const reportesController = new ReportesController();
