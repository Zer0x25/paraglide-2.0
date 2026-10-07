import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../plugins/prisma';
import { CreateFaqPayloadSchema } from '@parapente/shared';
import { listar, parseSort } from '../services/pagination.util';
import { logAudit } from '../services/auditoria.service';

const FAQ_SORT_FIELDS = ['orden', 'createdAt', 'updatedAt'] as const;

/**
 * CRUD de preguntas frecuentes (módulo Configuración).
 * Soft delete manual en updateMany (el plugin no lo intercepta).
 * La versión pública (solo `publica:true`) vive en public.routes.ts.
 */
const faqsRoutes: FastifyPluginAsync = async (fastify) => {
  // Listar (contrato ADR 005)
  fastify.get('/', { preHandler: fastify.authorize(['ADMIN']) }, async (request, reply) => {
    const query = (request.query ?? {}) as Record<string, string>;
    const orderBy = parseSort(query.sort, FAQ_SORT_FIELDS, { orden: 'asc' });
    const envelope = await listar(
      query,
      (p) =>
        prisma.faq.findMany({
          where: { deletedAt: null },
          orderBy,
          skip: p.skip,
          take: p.take,
        }),
      () => prisma.faq.count({ where: { deletedAt: null } }),
    );
    return reply.send(envelope);
  });

  // Crear
  fastify.post('/', { preHandler: fastify.authorize(['ADMIN']) }, async (request, reply) => {
    const parsed = CreateFaqPayloadSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.errors });
    }

    const faq = await prisma.faq.create({ data: parsed.data });

    await logAudit(request, {
      accion: 'CREAR',
      entidad: 'FAQ',
      entidadId: faq.id,
      descripcion: `FAQ "${faq.pregunta}" creada`,
    });
    return reply.status(201).send(faq);
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

      const parsed = CreateFaqPayloadSchema.partial().safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.errors });
      }

      const result = await prisma.faq.updateMany({
        where: { id, deletedAt: null },
        data: parsed.data,
      });
      if (result.count === 0) {
        return reply.status(404).send({ error: 'FAQ no encontrada' });
      }

      const faq = await prisma.faq.findFirst({ where: { id, deletedAt: null } });
      await logAudit(request, {
        accion: 'ACTUALIZAR',
        entidad: 'FAQ',
        entidadId: id,
        descripcion: `FAQ "${faq?.pregunta ?? id}" actualizada`,
      });
      return reply.send(faq);
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

      const result = await prisma.faq.updateMany({
        where: { id, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      if (result.count === 0) {
        return reply.status(404).send({ error: 'FAQ no encontrada' });
      }

      await logAudit(request, {
        accion: 'ELIMINAR',
        entidad: 'FAQ',
        entidadId: id,
        descripcion: `FAQ ${id} eliminada`,
      });
      return reply.send({ success: true, message: 'FAQ eliminada correctamente' });
    },
  );
};

export default faqsRoutes;
