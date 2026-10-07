import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../plugins/prisma';
import { UpdateEmpresaPayloadSchema } from '@parapente/shared';
import { logAudit } from '../services/auditoria.service';

/**
 * Gestión de la ficha EMPRESA (Fase 2) — registro singleton.
 *
 * Concurrencia optimista (ADR 004): el cliente envía la `version` que conoce
 * embebida en el body junto al resto del payload (`{ ...payload, version }`).
 * - Si no existe fila → se crea con `version: 1`.
 * - Si existe y la versión no coincide → 409 { error: 'version' }.
 * - Si coincide → update + incremento atómico de `version`.
 *
 * No existe DELETE: es un singleton sin borrado.
 */
const empresaRoutes: FastifyPluginAsync = async (fastify) => {
  // Obtener ficha (para el form de admin). Sin fila → 200 null (no 404):
  // el frontend muestra el formulario vacío para la primera carga.
  fastify.get('/', { preHandler: fastify.authorize(['ADMIN']) }, async (_request, reply) => {
    const empresa = await prisma.empresa.findFirst();
    return reply.send(empresa ?? null);
  });

  // Crear o actualizar la ficha (upsert con control de versión)
  fastify.put('/', { preHandler: fastify.authorize(['ADMIN']) }, async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;

    // La versión viaja embebida en el body (decisión documentada en el header
    // del archivo); debe ser number entero presente.
    const version = body.version;
    if (typeof version !== 'number' || !Number.isInteger(version)) {
      return reply.status(400).send({ error: 'Datos inválidos', details: ['version requerida (entero)'] });
    }

    // Validar el payload sin la clave de concurrencia
    const { version: _omit, ...payloadRest } = body;
    const parsed = UpdateEmpresaPayloadSchema.safeParse(payloadRest);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.errors });
    }
    const data = parsed.data;

    const existente = await prisma.empresa.findFirst();

    // En creación la BD exige `nombre` (el resto de campos son opcionales)
    if (!existente && !data.nombre) {
      return reply.status(400).send({ error: 'Datos inválidos', details: ['nombre requerido al crear'] });
    }

    if (!existente) {
      // Primera vez: se crea directamente (no hay versión previa contra la que chocar)
      const empresa = await prisma.empresa.create({
        data: { ...data, version: 1 } as { nombre: string; version: number },
      });
      await logAudit(request, {
        accion: 'CREAR',
        entidad: 'EMPRESA',
        entidadId: empresa.id,
        descripcion: 'Ficha de empresa creada',
      });
      return reply.send(empresa);
    }

    // Concurrencia optimista ATÓMICA: el chequeo de version va en el WHERE del
    // update para evitar la carrera lost-update (dos clientes con v3 pasando
    // el check simultáneamente). count=0 → otro cliente ya actualizó → 409.
    const result = await prisma.empresa.updateMany({
      where: { id: existente.id, version },
      data: { ...(data as object), version: { increment: 1 } },
    });
    if (result.count === 0) {
      return reply.status(409).send({ error: 'version' });
    }

    const empresa = await prisma.empresa.findFirstOrThrow({ where: { id: existente.id } });

    await logAudit(request, {
      accion: 'ACTUALIZAR',
      entidad: 'EMPRESA',
      entidadId: empresa.id,
      descripcion: `Ficha de empresa actualizada (v${empresa.version})`,
    });
    return reply.send(empresa);
  });
};

export default empresaRoutes;
