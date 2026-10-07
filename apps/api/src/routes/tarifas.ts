import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../plugins/prisma';
import { CreateTarifaPayloadSchema } from '@parapente/shared';
import { listar, parseSort } from '../services/pagination.util';
import { logAudit } from '../services/auditoria.service';

const TARIFA_SORT_FIELDS = ['nombre', 'createdAt', 'updatedAt'] as const;

/**
 * CRUD de tarifas (módulo Configuración).
 * Soft delete: el plugin de prisma filtra `deletedAt` en findMany/findFirst/count,
 * pero NO en updateMany → filtro manual allí (Fase 3).
 */
const tarifasRoutes: FastifyPluginAsync = async (fastify) => {
  // Listar (contrato ADR 005: envelope { data, pagination })
  fastify.get<{ Querystring: Record<string, string> }>(
    '/',
    { preHandler: fastify.authorize(['ADMIN']) },
    async (_request, reply) => {
      const query = (_request.query ?? {}) as Record<string, string>;
      const orderBy = parseSort(query.sort, TARIFA_SORT_FIELDS, { createdAt: 'desc' });
      const envelope = await listar(
        query,
        (p) =>
          prisma.tarifa.findMany({
            where: { deletedAt: null },
            orderBy,
            skip: p.skip,
            take: p.take,
          }),
        () => prisma.tarifa.count({ where: { deletedAt: null } }),
      );
      return reply.send(envelope);
    },
  );

  // Crear
  fastify.post('/', { preHandler: fastify.authorize(['ADMIN']) }, async (request, reply) => {
    const parsed = CreateTarifaPayloadSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.errors });
    }

    // Dinero Decimal(12,2): se pasa el número tal cual a Prisma (sin aritmética JS, ADR 008)
    const tarifa = await prisma.tarifa.create({ data: parsed.data });

    await logAudit(request, {
      accion: 'CREAR',
      entidad: 'TARIFA',
      entidadId: tarifa.id,
      descripcion: `Tarifa "${tarifa.nombre}" creada`,
    });
    return reply.status(201).send(tarifa);
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

      const parsed = CreateTarifaPayloadSchema.partial().safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.errors });
      }

      // updateMany + filtro manual de soft delete (el plugin no intercepta updateMany)
      const result = await prisma.tarifa.updateMany({
        where: { id, deletedAt: null },
        data: parsed.data,
      });
      if (result.count === 0) {
        return reply.status(404).send({ error: 'Tarifa no encontrada' });
      }

      const tarifa = await prisma.tarifa.findFirst({ where: { id, deletedAt: null } });
      await logAudit(request, {
        accion: 'ACTUALIZAR',
        entidad: 'TARIFA',
        entidadId: id,
        descripcion: `Tarifa "${tarifa?.nombre ?? id}" actualizada`,
      });
      return reply.send(tarifa);
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

      const result = await prisma.tarifa.updateMany({
        where: { id, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      if (result.count === 0) {
        return reply.status(404).send({ error: 'Tarifa no encontrada' });
      }

      await logAudit(request, {
        accion: 'ELIMINAR',
        entidad: 'TARIFA',
        entidadId: id,
        descripcion: `Tarifa ${id} eliminada`,
      });
      return reply.send({ success: true, message: 'Tarifa eliminada correctamente' });
    },
  );
};

export default tarifasRoutes;
