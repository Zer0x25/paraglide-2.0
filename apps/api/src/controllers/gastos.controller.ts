import { FastifyRequest, FastifyReply } from 'fastify';
import { gastosService } from '../services/gastos.service';
import { logAudit } from '../services/auditoria.service';

export class GastosController {
  async getAll(
    request: FastifyRequest<{ Querystring: Record<string, string | undefined> }>,
    reply: FastifyReply,
  ) {
    try {
      const gastos = await gastosService.getAll(request.query || {});
      return reply.send(gastos);
    } catch (error) {
      console.error('Error in getAll gastos:', error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    try {
      const data = (request.body as any) || {};
      if (!data.fecha || !data.categoria || data.monto === undefined) {
        return reply.status(400).send({ error: 'Faltan campos obligatorios' });
      }
      const montoNum = Number(data.monto);
      if (!Number.isFinite(montoNum) || montoNum <= 0) {
        return reply
          .status(400)
          .send({ error: 'El monto del gasto debe ser un número positivo mayor a 0' });
      }
      const fechaParsed = new Date(data.fecha);
      if (Number.isNaN(fechaParsed.getTime())) {
        return reply.status(400).send({ error: 'Fecha de gasto inválida' });
      }
      const categoriaLimpia = String(data.categoria).trim();
      if (!categoriaLimpia || categoriaLimpia.length > 100) {
        return reply.status(400).send({ error: 'Categoría de gasto inválida' });
      }

      const gasto = await gastosService.create({
        fecha: data.fecha,
        categoria: categoriaLimpia,
        monto: montoNum,
        descripcion: data.descripcion ? String(data.descripcion).trim() : undefined,
      });
      await logAudit(request, {
        accion: 'CREAR',
        entidad: 'GASTO',
        entidadId: gasto.id,
        descripcion: `Gasto registrado: ${categoriaLimpia} por $${montoNum.toLocaleString('es-CL')} CLP`,
        detalles: JSON.stringify({ fecha: data.fecha, descripcion: data.descripcion || null }),
      });
      return reply.status(201).send(gasto);
    } catch (error: any) {
      const status = error?.statusCode || 500;
      if (status >= 500) console.error('Error in create gasto:', error);
      return reply.status(status).send({
        error:
          status === 409
            ? 'Conflicto de concurrencia'
            : status === 404
              ? 'Not Found'
              : 'Internal Server Error',
        message: error.message,
      });
    }
  }

  async delete(
    request: FastifyRequest<{ Params: { id: string }; Querystring: { version?: string } }>,
    reply: FastifyReply,
  ) {
    try {
      const { id } = request.params;
      const version =
        request.query.version !== undefined ? Number(request.query.version) : undefined;
      await gastosService.delete(Number(id), version);
      await logAudit(request, {
        accion: 'ELIMINAR',
        entidad: 'GASTO',
        entidadId: id,
        descripcion: `Gasto #${id} eliminado`,
      });
      return reply.status(204).send();
    } catch (error: any) {
      const status = error?.statusCode || 500;
      if (status >= 500) console.error('Error in delete gasto:', error);
      return reply.status(status).send({
        error:
          status === 409
            ? 'Conflicto de concurrencia'
            : status === 404
              ? 'Not Found'
              : 'Internal Server Error',
        message: error.message,
      });
    }
  }
}

export const gastosController = new GastosController();
