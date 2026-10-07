import { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcryptjs';
import { prisma } from '../plugins/prisma';
import { CreateUserPayloadSchema, UpdateUserPayloadSchema, ChangePasswordPayloadSchema } from '@parapente/shared';
import { listar, parseSort } from '../services/pagination.util';
import { logAudit } from '../services/auditoria.service';

const USER_SORT_FIELDS = ['nombre', 'email', 'role', 'createdAt'] as const;

// Campos que nunca se exponen al cliente
const userSelect = {
  id: true,
  email: true,
  nombre: true,
  role: true,
  pilotoId: true,
  createdAt: true,
  updatedAt: true,
} as const;

const usersRoutes: FastifyPluginAsync = async (fastify) => {
  // Listar usuarios (paginado + filtros q/role + sort)
  fastify.get<{ Querystring: Record<string, string> }>(
    '/',
    { preHandler: fastify.authorize(['ADMIN']) },
    async (request, reply) => {
      const query = (request.query ?? {}) as Record<string, string>;
      const orderBy = parseSort(query.sort, USER_SORT_FIELDS, { createdAt: 'desc' });

      const where: Record<string, any> = { deletedAt: null };
      if (query.q) {
        const q = query.q.trim();
        where.OR = [
          { nombre: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ];
      }
      if (query.role) {
        where.role = query.role;
      }

      const envelope = await listar(
        query,
        (p) => prisma.user.findMany({ where, select: userSelect, orderBy, skip: p.skip, take: p.take }),
        () => prisma.user.count({ where }),
      );
      return reply.send(envelope);
    },
  );

  // Obtener por id
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: fastify.authorize(['ADMIN']) },
    async (request, reply) => {
      const id = Number(request.params.id);
      if (Number.isNaN(id)) return reply.status(400).send({ error: 'ID inválido' });
      const user = await prisma.user.findFirst({ where: { id, deletedAt: null }, select: userSelect });
      if (!user) return reply.status(404).send({ error: 'Usuario no encontrado' });
      return reply.send(user);
    },
  );

  // Crear usuario
  fastify.post('/', { preHandler: fastify.authorize(['ADMIN']) }, async (request, reply) => {
    const parsed = CreateUserPayloadSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.errors });
    }
    const { email, nombre, password, role, pilotoId } = parsed.data;

    if (pilotoId) {
      const piloto = await prisma.piloto.findFirst({ where: { id: pilotoId, deletedAt: null } });
      if (!piloto) return reply.status(400).send({ error: 'Piloto no encontrado' });
      const existing = await prisma.user.findFirst({ where: { pilotoId, deletedAt: null } });
      if (existing) return reply.status(400).send({ error: 'Ese piloto ya tiene un usuario vinculado' });
    }

    const hashed = await bcrypt.hash(password, 10);
    try {
      const user = await prisma.user.create({
        data: { email, nombre, password: hashed, role, pilotoId: pilotoId ?? null },
        select: userSelect,
      });
      await logAudit(request, {
        accion: 'CREAR',
        entidad: 'USER',
        entidadId: user.id,
        descripcion: `Usuario "${nombre}" (${role}) creado`,
      });
      return reply.status(201).send(user);
    } catch (e: any) {
      if (e?.code === 'P2002') {
        return reply.status(400).send({ error: 'El email ya está en uso' });
      }
      throw e;
    }
  });

  // Actualizar usuario
  fastify.put<{ Params: { id: string } }>(
    '/:id',
    { preHandler: fastify.authorize(['ADMIN']) },
    async (request, reply) => {
      const id = Number(request.params.id);
      if (Number.isNaN(id)) return reply.status(400).send({ error: 'ID inválido' });

      const parsed = UpdateUserPayloadSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.errors });
      }

      const existing = await prisma.user.findFirst({ where: { id, deletedAt: null } });
      if (!existing) return reply.status(404).send({ error: 'Usuario no encontrado' });

      const requester = request.user as any;
      const isSelf = requester?.id === id;

      const data: Record<string, any> = {};
      if (parsed.data.nombre !== undefined) data.nombre = parsed.data.nombre;

      if (isSelf && existing.role === 'ADMIN') {
        if (parsed.data.role !== undefined && parsed.data.role !== existing.role) {
          return reply.status(400).send({ error: 'Un administrador no puede cambiar su propio rol' });
        }
        if (parsed.data.email !== undefined && parsed.data.email !== existing.email) {
          return reply.status(400).send({ error: 'Un administrador no puede cambiar su propio email' });
        }
        if (parsed.data.pilotoId !== undefined && parsed.data.pilotoId !== existing.pilotoId) {
          return reply.status(400).send({ error: 'Un administrador no puede cambiar su propio piloto vinculado' });
        }
        if (parsed.data.password !== undefined) {
          return reply.status(400).send({ error: 'Para cambiar tu contraseña utiliza la opción de cambio de contraseña' });
        }
      } else {
        if (parsed.data.email !== undefined) data.email = parsed.data.email;
        if (parsed.data.role !== undefined) data.role = parsed.data.role;
        if (parsed.data.pilotoId !== undefined) {
          const newPilotoId = parsed.data.pilotoId ?? null;
          if (newPilotoId !== null) {
            const piloto = await prisma.piloto.findFirst({ where: { id: newPilotoId, deletedAt: null } });
            if (!piloto) return reply.status(400).send({ error: 'Piloto no encontrado' });
            const conflict = await prisma.user.findFirst({ where: { pilotoId: newPilotoId, deletedAt: null, NOT: { id } } });
            if (conflict) return reply.status(400).send({ error: 'Ese piloto ya tiene un usuario vinculado' });
          }
          data.pilotoId = newPilotoId;
        }
        if (parsed.data.password !== undefined) {
          data.password = await bcrypt.hash(parsed.data.password, 10);
          data.sessionVersion = { increment: 1 };
        }
      }

      // Si se intenta dejar sin ADMIN, bloquear
      if (data.role && existing.role === 'ADMIN' && data.role !== 'ADMIN') {
        const adminCount = await prisma.user.count({ where: { role: 'ADMIN', deletedAt: null } });
        if (adminCount <= 1) {
          return reply.status(400).send({ error: 'No se puede quitar el rol al último administrador' });
        }
      }

      try {
        await prisma.user.update({ where: { id }, data });
      } catch (e: any) {
        if (e?.code === 'P2002') return reply.status(400).send({ error: 'El email ya está en uso' });
        throw e;
      }

      const updated = await prisma.user.findFirst({ where: { id, deletedAt: null }, select: userSelect });
      await logAudit(request, {
        accion: 'ACTUALIZAR',
        entidad: 'USER',
        entidadId: id,
        descripcion: `Usuario ${id} actualizado`,
      });
      return reply.send(updated);
    },
  );

  // Eliminar (soft delete)
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: fastify.authorize(['ADMIN']) },
    async (request, reply) => {
      const id = Number(request.params.id);
      if (Number.isNaN(id)) return reply.status(400).send({ error: 'ID inválido' });

      const user = await prisma.user.findFirst({ where: { id, deletedAt: null } });
      if (!user) return reply.status(404).send({ error: 'Usuario no encontrado' });

      if (id === (request.user as any).id) {
        return reply.status(400).send({ error: 'No puedes eliminar tu propio usuario' });
      }

      if (user.role === 'ADMIN') {
        const adminCount = await prisma.user.count({ where: { role: 'ADMIN', deletedAt: null } });
        if (adminCount <= 1) {
          return reply.status(400).send({ error: 'No se puede eliminar al último administrador' });
        }
      }

      await prisma.user.update({ where: { id }, data: { deletedAt: new Date() } });
      await logAudit(request, {
        accion: 'ELIMINAR',
        entidad: 'USER',
        entidadId: id,
        descripcion: `Usuario ${id} eliminado`,
      });
      return reply.send({ success: true, message: 'Usuario eliminado correctamente' });
    },
  );

  // Cambiar password
  fastify.post<{ Params: { id: string } }>(
    '/:id/cambiar-password',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const id = Number(request.params.id);
      if (Number.isNaN(id)) return reply.status(400).send({ error: 'ID inválido' });

      const parsed = ChangePasswordPayloadSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.errors });
      }

      const requester = request.user as any;
      const isAdmin = requester.role === 'ADMIN';
      const isSelf = requester.id === id;

      if (!isAdmin && !isSelf) {
        return reply.status(403).send({ error: 'No tienes permisos para cambiar la contraseña de otro usuario' });
      }

      const target = await prisma.user.findFirst({ where: { id, deletedAt: null } });
      if (!target) return reply.status(404).send({ error: 'Usuario no encontrado' });

      // Si no es admin cambiando a otro, exigir currentPassword si el usuario ya tiene password
      if (!isAdmin || isSelf) {
        if (target.password) {
          if (!isAdmin && !parsed.data.currentPassword) {
            return reply.status(400).send({ error: 'Debes indicar la contraseña actual' });
          }
          if (parsed.data.currentPassword) {
            const ok = await bcrypt.compare(parsed.data.currentPassword, target.password);
            if (!ok) return reply.status(400).send({ error: 'La contraseña actual es incorrecta' });
          } else if (!isAdmin) {
            return reply.status(400).send({ error: 'Debes indicar la contraseña actual' });
          }
        }
      }

      const hashed = await bcrypt.hash(parsed.data.newPassword, 10);
      await prisma.user.update({
        where: { id },
        data: { password: hashed, sessionVersion: { increment: 1 } },
      });

      await logAudit(request, {
        accion: 'CAMBIAR_PASSWORD',
        entidad: 'USER',
        entidadId: id,
        descripcion: `Contraseña de usuario ${id} actualizada`,
      });
      return reply.send({ success: true });
    },
  );
};

export default usersRoutes;
