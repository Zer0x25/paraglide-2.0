import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../plugins/prisma';
import { UpsertReglaPayloadSchema } from '@parapente/shared';
import { logAudit } from '../services/auditoria.service';

/**
 * Reglas operativas clave-valor (módulo Configuración).
 * Colección pequeña → listado simple sin envelope. La clave viaja en la URL
 * y PUT /:clave es upsert (crea si no existe, actualiza si existe).
 */
const reglasOperativasRoutes: FastifyPluginAsync = async (fastify) => {
  // Listar todas las reglas ordenadas por categoría y clave
  fastify.get('/', { preHandler: fastify.authorize(['ADMIN']) }, async (_request, reply) => {
    const reglas = await prisma.reglaOperativa.findMany({
      orderBy: [{ categoria: 'asc' }, { clave: 'asc' }],
    });
    return reply.send(reglas);
  });

  // Upsert por clave única
  fastify.put<{ Params: { clave: string } }>(
    '/:clave',
    { preHandler: fastify.authorize(['ADMIN']) },
    async (request, reply) => {
      const { clave } = request.params;
      const parsed = UpsertReglaPayloadSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.errors });
      }

      // Si se marca como predeterminado dentro de PUNTO_ENCUENTRO, se desmarca
      // cualquier otro punto que ya fuera default (un solo default por categoría).
      const regla = await prisma.$transaction(async (tx) => {
        if (parsed.data.esDefault && parsed.data.categoria === 'PUNTO_ENCUENTRO') {
          await tx.reglaOperativa.updateMany({
            where: { categoria: 'PUNTO_ENCUENTRO', esDefault: true, NOT: { clave } },
            data: { esDefault: false },
          });
        }
        return tx.reglaOperativa.upsert({
          where: { clave },
          update: parsed.data,
          create: { ...parsed.data, clave },
        });
      });

      await logAudit(request, {
        accion: 'ACTUALIZAR',
        entidad: 'REGLA_OPERATIVA',
        entidadId: regla.id,
        descripcion: `Regla operativa "${clave}" guardada (${regla.categoria})`,
      });
      return reply.send(regla);
    },
  );

  // Claves protegidas: no borrables (valor editable sí) — ver seed.prod.ts
  const CLAVES_PROTEGIDAS = new Set(['puntoDeEncuentro', 'telefonoContacto', 'emailContacto']);

  // Eliminar por clave
  fastify.delete<{ Params: { clave: string } }>(
    '/:clave',
    { preHandler: fastify.authorize(['ADMIN']) },
    async (request, reply) => {
      const { clave } = request.params;
      if (CLAVES_PROTEGIDAS.has(clave)) {
        return reply.status(403).send({ error: 'No se puede eliminar una regla protegida', clave });
      }

      const result = await prisma.reglaOperativa.deleteMany({ where: { clave } });
      if (result.count === 0) {
        return reply.status(404).send({ error: 'Regla operativa no encontrada' });
      }

      await logAudit(request, {
        accion: 'ELIMINAR',
        entidad: 'REGLA_OPERATIVA',
        entidadId: null,
        descripcion: `Regla operativa "${clave}" eliminada`,
      });
      return reply.send({ success: true, message: 'Regla operativa eliminada correctamente' });
    },
  );
};

export default reglasOperativasRoutes;
