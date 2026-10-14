import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';

vi.mock('../../plugins/prisma', () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    piloto: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('../../services/auditoria.service', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from '../../plugins/prisma';
import usersRoutes from '../users.routes';

const loggedInAdmin = { id: 1, email: 'admin@test.com', nombre: 'Admin Uno', role: 'ADMIN' };

function buildApp(requester = loggedInAdmin): FastifyInstance {
  const app = Fastify();
  app.decorate('authorize', (_roles: string[]) => async (request: any, reply: any) => {
    const role = (request.headers['x-test-role'] as string) ?? requester.role;
    if (!_roles.includes(role)) {
      return reply.status(403).send({ error: 'Forbidden' });
    }
    request.user = { ...requester, role };
  });
  app.decorate('authenticate', async (request: any) => {
    request.user = requester;
  });
  return app;
}

async function registerRoutes(app: FastifyInstance) {
  await app.register(usersRoutes, { prefix: '/api/users' });
  await app.ready();
}

describe('Users API — Edición de usuario (PUT /api/users/:id)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Admin editándose a sí mismo (isSelf = true)', () => {
    it('1. Permite actualizar su propio nombre correctamente', async () => {
      const app = buildApp();
      await registerRoutes(app);

      const existingUser = {
        id: 1,
        email: 'admin@test.com',
        nombre: 'Admin Uno',
        role: 'ADMIN',
        pilotoId: null,
      };

      (prisma.user.findFirst as any)
        .mockResolvedValueOnce(existingUser) // check existing
        .mockResolvedValueOnce({ ...existingUser, nombre: 'Admin Renombrado' }); // fetch updated

      (prisma.user.update as any).mockResolvedValue({
        ...existingUser,
        nombre: 'Admin Renombrado',
      });

      const res = await app.inject({
        method: 'PUT',
        url: '/api/users/1',
        payload: { nombre: 'Admin Renombrado' },
      });

      expect(res.statusCode).toBe(200);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { nombre: 'Admin Renombrado' },
      });
      expect(res.json().nombre).toBe('Admin Renombrado');

      await app.close();
    });

    it('2. Bloquea si intenta modificar su propio rol', async () => {
      const app = buildApp();
      await registerRoutes(app);

      (prisma.user.findFirst as any).mockResolvedValueOnce({
        id: 1,
        email: 'admin@test.com',
        nombre: 'Admin Uno',
        role: 'ADMIN',
        pilotoId: null,
      });

      const res = await app.inject({
        method: 'PUT',
        url: '/api/users/1',
        payload: { nombre: 'Admin Uno', role: 'RECEPCION' },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe('Un administrador no puede cambiar su propio rol');
      expect(prisma.user.update).not.toHaveBeenCalled();

      await app.close();
    });

    it('3. Bloquea si intenta modificar su propio email', async () => {
      const app = buildApp();
      await registerRoutes(app);

      (prisma.user.findFirst as any).mockResolvedValueOnce({
        id: 1,
        email: 'admin@test.com',
        nombre: 'Admin Uno',
        role: 'ADMIN',
        pilotoId: null,
      });

      const res = await app.inject({
        method: 'PUT',
        url: '/api/users/1',
        payload: { email: 'nuevo_admin@test.com' },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe('Un administrador no puede cambiar su propio email');
      expect(prisma.user.update).not.toHaveBeenCalled();

      await app.close();
    });

    it('4. Bloquea si intenta modificar su contraseña desde este endpoint', async () => {
      const app = buildApp();
      await registerRoutes(app);

      (prisma.user.findFirst as any).mockResolvedValueOnce({
        id: 1,
        email: 'admin@test.com',
        nombre: 'Admin Uno',
        role: 'ADMIN',
        pilotoId: null,
      });

      const res = await app.inject({
        method: 'PUT',
        url: '/api/users/1',
        payload: { password: 'password123' },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe(
        'Para cambiar tu contraseña utiliza la opción de cambio de contraseña',
      );
      expect(prisma.user.update).not.toHaveBeenCalled();

      await app.close();
    });

    it('5. Bloquea si intenta modificar su vínculo de piloto', async () => {
      const app = buildApp();
      await registerRoutes(app);

      (prisma.user.findFirst as any).mockResolvedValueOnce({
        id: 1,
        email: 'admin@test.com',
        nombre: 'Admin Uno',
        role: 'ADMIN',
        pilotoId: null,
      });

      const res = await app.inject({
        method: 'PUT',
        url: '/api/users/1',
        payload: { pilotoId: 5 },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe('Un administrador no puede cambiar su propio piloto vinculado');
      expect(prisma.user.update).not.toHaveBeenCalled();

      await app.close();
    });
  });

  describe('Admin editando a otro usuario (isSelf = false)', () => {
    it('Permite cambiar rol, email, etc. al editar a otro usuario', async () => {
      const app = buildApp();
      await registerRoutes(app);

      const otherUser = {
        id: 2,
        email: 'otro@test.com',
        nombre: 'Otro Usuario',
        role: 'RECEPCION',
        pilotoId: null,
      };

      (prisma.user.findFirst as any)
        .mockResolvedValueOnce(otherUser)
        .mockResolvedValueOnce({ ...otherUser, role: 'PILOTO', nombre: 'Otro Renombrado' });

      (prisma.user.update as any).mockResolvedValue({ ...otherUser, role: 'PILOTO' });

      const res = await app.inject({
        method: 'PUT',
        url: '/api/users/2',
        payload: { nombre: 'Otro Renombrado', role: 'PILOTO' },
      });

      expect(res.statusCode).toBe(200);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 2 },
        data: { nombre: 'Otro Renombrado', role: 'PILOTO' },
      });

      await app.close();
    });
  });

  describe('DELETE /api/users/:id - Soft delete con liberación de @unique (C-07)', () => {
    it('elimina usuario anonimizando email, liberando pilotoId/googleId e incrementando sessionVersion', async () => {
      const app = buildApp();
      await registerRoutes(app);

      const targetUser = {
        id: 3,
        email: 'piloto3@test.com',
        nombre: 'Piloto Tres',
        role: 'PILOTO',
        pilotoId: 10,
        googleId: 'google-sub-123',
      };

      (prisma.user.findFirst as any).mockResolvedValueOnce(targetUser);
      (prisma.user.update as any).mockResolvedValue({ ...targetUser, deletedAt: new Date() });

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/users/3',
      });

      expect(res.statusCode).toBe(200);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 3 },
        data: expect.objectContaining({
          deletedAt: expect.any(Date),
          pilotoId: null,
          googleId: null,
          email: expect.stringMatching(/^deleted_3_\d+_piloto3@test\.com$/),
          sessionVersion: { increment: 1 },
        }),
      });

      await app.close();
    });

    it('bloquea eliminar al último administrador', async () => {
      const app = buildApp();
      await registerRoutes(app);

      const adminUser = {
        id: 2,
        email: 'otro_admin@test.com',
        nombre: 'Otro Admin',
        role: 'ADMIN',
      };

      (prisma.user.findFirst as any).mockResolvedValueOnce(adminUser);
      (prisma.user.count as any).mockResolvedValueOnce(1); // solo 1 admin

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/users/2',
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe('No se puede eliminar al último administrador');
      expect(prisma.user.update).not.toHaveBeenCalled();

      await app.close();
    });
  });
});
