import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../plugins/prisma';
import { CreateDeslindePayloadSchema } from '@parapente/shared';
import { logAudit } from '../services/auditoria.service';

/**
 * Historial legal de deslindes (módulo Configuración).
 *
 * DeslindeVersion NO tiene deletedAt ni updatedAt: es un historial inmutable
 * donde solo el flag `activa` cambia. Colección pequeña → findMany simple sin
 * envelope (el contrato lo define así, ADR 005 aplica a colecciones grandes).
 *
 * Activación atómica con concurrencia optimista (ADR 004): el cliente envía
 * la `version` que conoce; si no coincide con la actual → 409 Conflict.
 */
const deslindesRoutes: FastifyPluginAsync = async (fastify) => {
  // Listar historial completo (ordenado por versión descendente)
  fastify.get('/', { preHandler: fastify.authorize(['ADMIN']) }, async (_request, reply) => {
    const deslindes = await prisma.deslindeVersion.findMany({
      orderBy: { version: 'desc' },
    });
    return reply.send(deslindes);
  });

  // Crear nueva versión del deslinde
  fastify.post('/', { preHandler: fastify.authorize(['ADMIN']) }, async (request, reply) => {
    const parsed = CreateDeslindePayloadSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.errors });
    }

    // Si nace activa, se desactivan las demás dentro de la misma transacción
    // para preservar el invariante: exactamente una versión activa.
    const deslinde = await prisma.$transaction(async (tx) => {
      if (parsed.data.activa) {
        await tx.deslindeVersion.updateMany({ data: { activa: false } });
      }
      return tx.deslindeVersion.create({
        data: {
          titulo: parsed.data.titulo,
          texto: parsed.data.texto,
          // `version` es @default(autoincrement()): se asigna sola en el create
          ...(parsed.data.activa !== undefined && { activa: parsed.data.activa }),
        },
      });
    });

    await logAudit(request, {
      accion: 'CREAR',
      entidad: 'DESLINDE',
      entidadId: deslinde.id,
      descripcion: `Deslinde versión ${deslinde.version} creado`,
    });
    return reply.status(201).send(deslinde);
  });

  // Actualizar metadatos de una versión existente
  fastify.put<{ Params: { id: string } }>(
    '/:id',
    { preHandler: fastify.authorize(['ADMIN']) },
    async (request, reply) => {
      const id = Number(request.params.id);
      if (Number.isNaN(id)) {
        return reply.status(400).send({ error: 'ID inválido' });
      }

      const parsed = CreateDeslindePayloadSchema.partial().safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.errors });
      }
      const { titulo, texto, activa } = parsed.data;

      // Historial legal inmutable: el texto/título de una versión ya publicada
      // (activa) no se puede mutar — para cambiar el texto se crea una versión nueva.
      if (texto !== undefined || titulo !== undefined) {
        const actual = await prisma.deslindeVersion.findUnique({ where: { id } });
        if (!actual) {
          return reply.status(404).send({ error: 'Deslinde no encontrado' });
        }
        if (actual.activa) {
          return reply.status(400).send({ error: 'No se puede editar el texto de una versión activa. Crea una nueva versión.' });
        }
      }

      // Si se marca activa por esta vía, las demás se desactivan atómicamente.
      // La verificación de existencia va ANTES de desactivar: si el id no existe
      // (o fue eliminado por otro cliente), NO debe quedar el sistema sin activa.
      const result = await prisma.$transaction(async (tx) => {
        const target = await tx.deslindeVersion.findUnique({ where: { id } });
        if (!target) return { status: 404 as const };
        if (activa === true) {
          await tx.deslindeVersion.updateMany({ where: { id: { not: id } }, data: { activa: false } });
        }
        const updated = await tx.deslindeVersion.updateMany({
          where: { id },
          data: {
            ...(titulo !== undefined && { titulo }),
            ...(texto !== undefined && { texto }),
            ...(activa !== undefined && { activa }),
          },
        });
        return { status: 200 as const, count: updated.count };
      });
      if (result.status === 404 || result.count === 0) {
        return reply.status(404).send({ error: 'Deslinde no encontrado' });
      }

      const deslinde = await prisma.deslindeVersion.findUnique({ where: { id } });
      await logAudit(request, {
        accion: 'ACTUALIZAR',
        entidad: 'DESLINDE',
        entidadId: id,
        descripcion: `Deslinde versión ${deslinde?.version ?? id} actualizado`,
      });
      return reply.send(deslinde);
    },
  );

  // Eliminar una versión del historial (borrado físico: no hay deletedAt)
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: fastify.authorize(['ADMIN']) },
    async (request, reply) => {
      const id = Number(request.params.id);
      if (Number.isNaN(id)) {
        return reply.status(400).send({ error: 'ID inválido' });
      }

      try {
        // Protección del invariante: no se puede eliminar la única fuente del
        // texto legal que firman los pasajeros. Primero hay que activar otra.
        const toDelete = await prisma.deslindeVersion.findUnique({ where: { id } });
        if (!toDelete) {
          return reply.status(404).send({ error: 'Deslinde no encontrado' });
        }
        if (toDelete.activa) {
          return reply.status(400).send({ error: 'No se puede eliminar la versión activa. Activa otra versión primero.' });
        }
        await prisma.deslindeVersion.delete({ where: { id } });
      } catch {
        return reply.status(404).send({ error: 'Deslinde no encontrado' });
      }

      await logAudit(request, {
        accion: 'ELIMINAR',
        entidad: 'DESLINDE',
        entidadId: id,
        descripcion: `Deslinde ${id} eliminado`,
      });
      return reply.send({ success: true, message: 'Deslinde eliminado correctamente' });
    },
  );

  // Activar una versión (atómico + concurrencia optimista ADR 004)
  fastify.post<{ Params: { id: string }; Body: { revision?: number } }>(
    '/:id/activar',
    { preHandler: fastify.authorize(['ADMIN']) },
    async (request, reply) => {
      const id = Number(request.params.id);
      if (Number.isNaN(id)) {
        return reply.status(400).send({ error: 'ID inválido' });
      }

      const body = request.body as { revision?: number };
      if (typeof body?.revision !== 'number') {
        return reply.status(400).send({ error: 'Se requiere la revision actual del deslinde' });
      }

      const result = await prisma.$transaction(async (tx) => {
        const target = await tx.deslindeVersion.findUnique({ where: { id } });
        if (!target) return { status: 404 as const };

        // Concurrencia optimista (ADR 004): `revision` es el token que conoce el
        // cliente. `version` (número legal) queda INMUTABLE para trazabilidad.
        if (target.revision !== body.revision) {
          return { status: 409 as const };
        }

        await tx.deslindeVersion.updateMany({ data: { activa: false } });
        const activado = await tx.deslindeVersion.update({
          where: { id },
          data: { activa: true, revision: { increment: 1 } },
        });
        return { status: 200 as const, deslinde: activado };
      });

      if (result.status === 404) {
        return reply.status(404).send({ error: 'Deslinde no encontrado' });
      }
      if (result.status === 409) {
        return reply.status(409).send({ error: 'version' });
      }

      await logAudit(request, {
        accion: 'ACTIVAR',
        entidad: 'DESLINDE',
        entidadId: id,
        descripcion: `Deslinde activado (versión ${result.deslinde!.version})`,
      });
      return reply.send(result.deslinde);
    },
  );
};

export default deslindesRoutes;
