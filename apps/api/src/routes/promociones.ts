import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../plugins/prisma';
import { CreatePromocionPayloadSchema, UpdatePromocionPayloadSchema } from '@parapente/shared';
import { listar, parseSort } from '../services/pagination.util';
import { logAudit } from '../services/auditoria.service';

const PROMO_SORT_FIELDS = ['nombre', 'createdAt', 'updatedAt'] as const;

/** Normaliza fecha string|Date|null del payload Zod a Date|null para Prisma. */
function toDate(v: string | Date | null | undefined): Date | null {
  return v == null ? null : new Date(v);
}

/**
 * CRUD de promociones (módulo Configuración).
 * Soft delete manual en updateMany (el plugin no lo intercepta).
 */
const promocionesRoutes: FastifyPluginAsync = async (fastify) => {
  // Listar (contrato ADR 005)
  fastify.get('/', { preHandler: fastify.authorize(['ADMIN']) }, async (request, reply) => {
    const query = (request.query ?? {}) as Record<string, string>;
    const orderBy = parseSort(query.sort, PROMO_SORT_FIELDS, { createdAt: 'desc' });
    const envelope = await listar(
      query,
      (p) =>
        prisma.promocion.findMany({
          where: { deletedAt: null },
          orderBy,
          skip: p.skip,
          take: p.take,
        }),
      () => prisma.promocion.count({ where: { deletedAt: null } }),
    );
    return reply.send(envelope);
  });

  // Crear
  fastify.post('/', { preHandler: fastify.authorize(['ADMIN']) }, async (request, reply) => {
    const parsed = CreatePromocionPayloadSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.errors });
    }
    const { fechaInicio, fechaFin, ...rest } = parsed.data;

    // valor es Decimal(12,2): sin aritmética directa (ADR 008)
    const promocion = await prisma.promocion.create({
      data: { ...rest, fechaInicio: toDate(fechaInicio), fechaFin: toDate(fechaFin) },
    });

    await logAudit(request, {
      accion: 'CREAR',
      entidad: 'PROMOCION',
      entidadId: promocion.id,
      descripcion: `Promoción "${promocion.nombre}" creada`,
    });
    return reply.status(201).send(promocion);
  });

  // Actualizar (parcial)
  fastify.put<{ Params: { id: string } }>(
    '/:id',
    { preHandler: fastify.authorize(['ADMIN']) },
    async (request, reply) => {
      const id = Number(request.params.id);
      if (Number.isNaN(id)) {
        return reply.status(400).send({ error: 'ID inválido' });
      }

      const parsed = UpdatePromocionPayloadSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.errors });
      }
      const { fechaInicio, fechaFin, ...rest } = parsed.data;

      const result = await prisma.promocion.updateMany({
        where: { id, deletedAt: null },
        data: {
          ...rest,
          ...(fechaInicio !== undefined && { fechaInicio: toDate(fechaInicio) }),
          ...(fechaFin !== undefined && { fechaFin: toDate(fechaFin) }),
        },
      });
      if (result.count === 0) {
        return reply.status(404).send({ error: 'Promoción no encontrada' });
      }

      const promocion = await prisma.promocion.findFirst({ where: { id, deletedAt: null } });
      await logAudit(request, {
        accion: 'ACTUALIZAR',
        entidad: 'PROMOCION',
        entidadId: id,
        descripcion: `Promoción "${promocion?.nombre ?? id}" actualizada`,
      });
      return reply.send(promocion);
    },
  );

  // Eliminar (soft delete)
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: fastify.authorize(['ADMIN']) },
    async (request, reply) => {
      const id = Number(request.params.id);
      if (Number.isNaN(id)) {
        return reply.status(400).send({ error: 'ID inválido' });
      }

      const result = await prisma.promocion.updateMany({
        where: { id, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      if (result.count === 0) {
        return reply.status(404).send({ error: 'Promoción no encontrada' });
      }

      await logAudit(request, {
        accion: 'ELIMINAR',
        entidad: 'PROMOCION',
        entidadId: id,
        descripcion: `Promoción ${id} eliminada`,
      });
      return reply.send({ success: true, message: 'Promoción eliminada correctamente' });
    },
  );
};

export default promocionesRoutes;
