import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';

/**
 * Tests de la ficha EMPRESA (Fase 2) — patrón unitario igual que
 * configuracion.test.ts: Prisma mockeado, app mínima y `authorize`
 * decorado como stub controlado por el header `x-test-role`.
 */
vi.mock('../../plugins/prisma', () => ({
  prisma: {
    empresa: {
      findFirst: vi.fn(),
      findFirstOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      // Default que sobrevive a clearAllMocks: updateMany responde count 0
      // (camino stale → 409) salvo que un test lo sobreescriba.
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  },
}));

vi.mock('../../services/auditoria.service', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from '../../plugins/prisma';
import empresaRoutes from '../empresa';
import publicRoutes from '../public.routes';

const adminUser = { id: 1, email: 'admin@test.com', nombre: 'Admin', role: 'ADMIN' };

/** App mínima con authorize stub (respeta x-test-role). */
function buildApp(withAuth = true): FastifyInstance {
  const app = Fastify();
  if (withAuth) {
    app.decorate('authorize', (_roles: string[]) => async (request: any, reply: any) => {
      const role = (request.headers['x-test-role'] as string) ?? 'ADMIN';
      if (!_roles.includes(role)) {
        return reply.status(403).send({ error: 'Forbidden' });
      }
      request.user = { ...adminUser, role };
    });
  }
  return app;
}

async function registerProtected(app: FastifyInstance) {
  await app.register(empresaRoutes, { prefix: '/api/empresa' });
  await app.ready();
}

describe('Empresa API (unit)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET sin fila → 200 null', async () => {
    const app = buildApp();
    await registerProtected(app);
    (prisma.empresa.findFirst as any).mockResolvedValue(null);

    const res = await app.inject({ method: 'GET', url: '/api/empresa' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toBeNull();
    await app.close();
  });

  it('PUT crea la primera vez (version 1)', async () => {
    const app = buildApp();
    await registerProtected(app);
    (prisma.empresa.findFirst as any).mockResolvedValue(null);
    (prisma.empresa.create as any).mockImplementation(async ({ data }: any) => ({
      id: 1,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const res = await app.inject({
      method: 'PUT',
      url: '/api/empresa',
      payload: { nombre: 'Parapente Escuela', version: 0 },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().version).toBe(1);
    expect(prisma.empresa.create).toHaveBeenCalledTimes(1);
    expect(prisma.empresa.update).not.toHaveBeenCalled();
    await app.close();
  });

  it('PUT con version stale → 409 { error: "version" }', async () => {
    const app = buildApp();
    await registerProtected(app);
    (prisma.empresa.findFirst as any).mockResolvedValue({
      id: 1,
      nombre: 'Parapente Escuela',
      version: 3,
    });

    const res = await app.inject({
      method: 'PUT',
      url: '/api/empresa',
      payload: { nombre: 'Otro Nombre', version: 2 },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: 'version' });
    // Con el update atómico, updateMany SÍ se ejecuta (where incluye la
    // version stale) pero devuelve count=0 → 409. Lo que NO debe pasar:
    // que se devuelva la fila actualizada (findFirstOrThrow sin llamada).
    expect(prisma.empresa.findFirstOrThrow).not.toHaveBeenCalled();
    await app.close();
  });

  it('PUT con version correcta actualiza e incrementa version', async () => {
    const app = buildApp();
    await registerProtected(app);
    (prisma.empresa.findFirst as any).mockResolvedValue({
      id: 1,
      nombre: 'Parapente Escuela',
      version: 3,
    });
    // Update atómico: where incluye version → count 1 = éxito
    (prisma.empresa.updateMany as any).mockResolvedValue({ count: 1 });
    (prisma.empresa.findFirstOrThrow as any).mockResolvedValue({
      id: 1,
      nombre: 'Parapente Escuela v2',
      telefono: '+56912345678',
      version: 4,
    });

    const res = await app.inject({
      method: 'PUT',
      url: '/api/empresa',
      payload: { nombre: 'Parapente Escuela v2', telefono: '+56912345678', version: 3 },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().version).toBe(4);
    expect(prisma.empresa.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1, version: 3 },
        data: expect.objectContaining({ version: { increment: 1 } }),
      }),
    );
    await app.close();
  });

  it('PUT con payload inválido → 400', async () => {
    const app = buildApp();
    await registerProtected(app);

    const res = await app.inject({
      method: 'PUT',
      url: '/api/empresa',
      payload: { email: 'no-es-email', version: 0 },
    });

    expect(res.statusCode).toBe(400);
    expect(prisma.empresa.create).not.toHaveBeenCalled();
    expect(prisma.empresa.updateMany).not.toHaveBeenCalled();
    await app.close();
  });

  it('público GET /api/public/empresa sin token funciona (null y con fila)', async () => {
    // App mínima SIN decorate authorize: si la ruta requiriera auth fallaría
    const app = buildApp(false);
    await app.register(publicRoutes, { prefix: '/api/public' });
    await app.ready();

    (prisma.empresa.findFirst as any).mockResolvedValueOnce(null);
    const resNull = await app.inject({ method: 'GET', url: '/api/public/empresa' });
    expect(resNull.statusCode).toBe(200);
    expect(resNull.json()).toBeNull();

    (prisma.empresa.findFirst as any).mockResolvedValueOnce({
      id: 1,
      nombre: 'Parapente Escuela',
      slogan: 'Vuela alto',
      version: 2,
    });
    const resData = await app.inject({ method: 'GET', url: '/api/public/empresa' });
    expect(resData.statusCode).toBe(200);
    expect(resData.json().nombre).toBe('Parapente Escuela');

    await app.close();
  });
});
