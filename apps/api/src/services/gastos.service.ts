import { prisma } from '../plugins/prisma';
import { checkVersion } from './concurrencia.service';
import { listar, ListQuery } from './pagination.util';

/** Error de recurso no encontrado: el handler lo mapea a HTTP 404 (ADR 004). */
class NotFoundError extends Error {
  statusCode = 404;

  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class GastosService {
  async getAll(opts: ListQuery & { desde?: string; hasta?: string } = {}) {
    const where: any = {};
    if (opts.desde || opts.hasta) {
      where.fecha = {};
      if (opts.desde) where.fecha.gte = new Date(opts.desde);
      if (opts.hasta) where.fecha.lte = new Date(opts.hasta);
    }
    return listar(
      opts,
      ({ skip, take }) => prisma.gasto.findMany({ where, orderBy: { fecha: 'desc' }, skip, take }),
      () => prisma.gasto.count({ where }),
    );
  }

  async create(data: { fecha: string | Date; categoria: string; monto: number; descripcion?: string }) {
    return prisma.gasto.create({
      data: {
        fecha: new Date(data.fecha),
        categoria: data.categoria,
        monto: data.monto,
        descripcion: data.descripcion
      }
    });
  }

  async delete(id: number, version?: number) {
    return prisma.$transaction(async (tx) => {
      const actual = await tx.gasto.findUnique({ where: { id, deletedAt: null } });
      if (!actual) throw new NotFoundError('Gasto no encontrado');
      checkVersion(actual.version, version);
      return tx.gasto.update({
        where: { id },
        data: { deletedAt: new Date(), version: { increment: 1 } }
      });
    });
  }
}

export const gastosService = new GastosService();
