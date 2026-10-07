import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';

/**
 * Tests del módulo Configuración (tarifas, promociones, faqs, deslindes,
 * reglas operativas + endpoints públicos).
 *
 * Patrón de la suite (unitario): Prisma mockeado, app mínima por grupo de
 * rutas y `authorize` decorado como stub controlado por el header
 * `x-test-role` (default ADMIN) para poder probar 403 sin JWT real.
 */
vi.mock('../../plugins/prisma', () => {
  const prismaMock = {
    tarifa: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      findFirst: vi.fn(),
    },
    promocion: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      findFirst: vi.fn(),
    },
    faq: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      findFirst: vi.fn(),
    },
    deslindeVersion: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    reglaOperativa: {
      findMany: vi.fn(),
      upsert: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    // $transaction ejecuta el callback pasándole el propio mock como tx
    // (los handlers usan tx.reglaOperativa.updateMany/upsert).
    $transaction: vi.fn(async (fn: any) => fn(prismaMock)),
  };
  return { prisma: prismaMock };
});

vi.mock('../../services/auditoria.service', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from '../../plugins/prisma';
import tarifasRoutes from '../tarifas';
import promocionesRoutes from '../promociones';
import faqsRoutes from '../faqs';
import deslindesRoutes from '../deslindes';
import reglasOperativasRoutes from '../reglasOperativas';
import publicRoutes from '../public.routes';

const adminUser = { id: 1, email: 'admin@test.com', nombre: 'Admin', role: 'ADMIN' };

/** App mínima con authorize stub: respeta el rol enviado en el header x-test-role. */
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

async function registerAdminRoutes(app: FastifyInstance) {
  await app.register(tarifasRoutes, { prefix: '/api/tarifas' });
  await app.register(promocionesRoutes, { prefix: '/api/promociones' });
  await app.register(faqsRoutes, { prefix: '/api/faqs' });
  await app.register(deslindesRoutes, { prefix: '/api/deslindes' });
  await app.register(reglasOperativasRoutes, { prefix: '/api/reglas-operativas' });
  await app.ready();
}

describe('Configuración API (unit)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // $transaction debe ejecutar el callback pasándole el mock como tx
    // (los handlers usan tx.reglaOperativa.updateMany/upsert). clearAllMocks
    // resetea la impl por defecto del factory, así que la re-establecemos.
    (prisma.$transaction as any).mockImplementation(async (fn: any) => fn(prisma));
  });

  // ---------------------------------------------------------------
  // Tarifas
  // ---------------------------------------------------------------
  describe('Tarifas', () => {
    it('POST crea una tarifa (201)', async () => {
      const app = buildApp();
      await registerAdminRoutes(app);
      (prisma.tarifa.create as any).mockResolvedValue({
        id: 5,
        nombre: 'Vuelo Tándem Standard',
        precio: 80000,
        activo: true,
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/tarifas',
        payload: { nombre: 'Vuelo Tándem Standard', precio: 80000, activo: true },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().id).toBe(5);
      expect(prisma.tarifa.create).toHaveBeenCalledTimes(1);
      await app.close();
    });

    it('PUT actualiza la tarifa (200)', async () => {
      const app = buildApp();
      await registerAdminRoutes(app);
      (prisma.tarifa.updateMany as any).mockResolvedValue({ count: 1 });
      (prisma.tarifa.findFirst as any).mockResolvedValue({
        id: 5,
        nombre: 'Vuelo Tándem Standard',
        precio: 95000,
        activo: false,
      });

      const res = await app.inject({
        method: 'PUT',
        url: '/api/tarifas/5',
        payload: { precio: 95000, activo: false },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().precio).toBe(95000);
      expect(res.json().activo).toBe(false);
      await app.close();
    });

    it('GET lista con envelope paginado (ADR 005)', async () => {
      const app = buildApp();
      await registerAdminRoutes(app);
      (prisma.tarifa.findMany as any).mockResolvedValue([{ id: 5, nombre: 'T', precio: 8000 }]);
      (prisma.tarifa.count as any).mockResolvedValue(1);

      const res = await app.inject({ method: 'GET', url: '/api/tarifas' });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.pagination).toMatchObject({ page: 1, total: 1 });
      await app.close();
    });

    it('DELETE hace soft delete y responde success', async () => {
      const app = buildApp();
      await registerAdminRoutes(app);
      (prisma.tarifa.updateMany as any).mockResolvedValue({ count: 1 });

      const res = await app.inject({ method: 'DELETE', url: '/api/tarifas/5' });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
      expect(prisma.tarifa.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { deletedAt: expect.any(Date) } }),
      );
      await app.close();
    });

    it('rechaza mutación sin rol ADMIN (403)', async () => {
      const app = buildApp();
      await registerAdminRoutes(app);

      const res = await app.inject({
        method: 'POST',
        url: '/api/tarifas',
        headers: { 'x-test-role': 'PILOTO' },
        payload: { nombre: 'No autorizada', precio: 1000 },
      });

      expect(res.statusCode).toBe(403);
      await app.close();
    });
  });

  // ---------------------------------------------------------------
  // Deslindes
  // ---------------------------------------------------------------
  describe('Deslindes', () => {
    function txMock() {
      return {
        deslindeVersion: {
          findUnique: vi.fn(),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          update: vi.fn(),
          create: vi.fn(),
        },
      };
    }

    it('POST crea versión y preserva invariante de una sola activa', async () => {
      const app = buildApp();
      await registerAdminRoutes(app);
      const tx = txMock();
      (prisma.$transaction as any).mockImplementation(async (fn: any) => fn(tx));
      tx.deslindeVersion.create.mockResolvedValue({ id: 10, version: 4, activa: true, texto: 'nuevo' });

      const res = await app.inject({
        method: 'POST',
        url: '/api/deslindes',
        payload: { titulo: 'Deslinde', texto: 'nuevo', activa: true },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().activa).toBe(true);
      // Desactivó las demás dentro de la transacción
      expect(tx.deslindeVersion.updateMany).toHaveBeenCalledWith({ data: { activa: false } });
      await app.close();
    });

    it('POST /:id/activar deja solo una versión activa e incrementa revision (version legal intacta)', async () => {
      const app = buildApp();
      await registerAdminRoutes(app);
      const tx = txMock();
      (prisma.$transaction as any).mockImplementation(async (fn: any) => fn(tx));
      tx.deslindeVersion.findUnique.mockResolvedValue({ id: 9, version: 2, revision: 5, activa: false });
      tx.deslindeVersion.update.mockResolvedValue({ id: 9, version: 2, revision: 6, activa: true });

      const res = await app.inject({
        method: 'POST',
        url: '/api/deslindes/9/activar',
        payload: { revision: 5 },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ activa: true, revision: 6, version: 2 });
      expect(tx.deslindeVersion.updateMany).toHaveBeenCalledWith({ data: { activa: false } });
      await app.close();
    });

    it('POST /:id/activar con revision stale devuelve 409', async () => {
      const app = buildApp();
      await registerAdminRoutes(app);
      const tx = txMock();
      (prisma.$transaction as any).mockImplementation(async (fn: any) => fn(tx));
      tx.deslindeVersion.findUnique.mockResolvedValue({ id: 9, version: 3, revision: 6, activa: true });

      const res = await app.inject({
        method: 'POST',
        url: '/api/deslindes/9/activar',
        payload: { revision: 5 }, // el cliente conoce una revisión vieja
      });

      expect(res.statusCode).toBe(409);
      expect(res.json().error).toBe('version');
      await app.close();
    });

    it('POST /:id/activar sin revision devuelve 400', async () => {
      const app = buildApp();
      await registerAdminRoutes(app);

      const res = await app.inject({ method: 'POST', url: '/api/deslindes/9/activar', payload: {} });

      expect(res.statusCode).toBe(400);
      await app.close();
    });

    it('PUT con activa:true e id inexistente NO desactiva las demás (regresión bloqueante)', async () => {
      const app = buildApp();
      await registerAdminRoutes(app);
      const tx = txMock();
      (prisma.$transaction as any).mockImplementation(async (fn: any) => fn(tx));
      tx.deslindeVersion.findUnique.mockResolvedValue(null); // id eliminado por otro cliente

      const res = await app.inject({
        method: 'PUT',
        url: '/api/deslindes/999',
        payload: { activa: true },
      });

      expect(res.statusCode).toBe(404);
      // CRÍTICO: nunca debe quedar el sistema sin versión activa
      expect(tx.deslindeVersion.updateMany).not.toHaveBeenCalled();
      await app.close();
    });

    it('PUT no permite editar el texto de una versión activa (historial legal)', async () => {
      const app = buildApp();
      await registerAdminRoutes(app);
      (prisma.deslindeVersion.findUnique as any).mockResolvedValue({ id: 1, version: 1, activa: true, texto: 'firmado' });

      const res = await app.inject({
        method: 'PUT',
        url: '/api/deslindes/1',
        payload: { texto: 'texto mutado' },
      });

      expect(res.statusCode).toBe(400);
      await app.close();
    });

    it('DELETE de la versión activa devuelve 400 y no elimina', async () => {
      const app = buildApp();
      await registerAdminRoutes(app);
      (prisma.deslindeVersion.findUnique as any).mockResolvedValue({ id: 1, version: 1, activa: true });

      const res = await app.inject({ method: 'DELETE', url: '/api/deslindes/1' });

      expect(res.statusCode).toBe(400);
      expect(prisma.deslindeVersion.delete).not.toHaveBeenCalled();
      await app.close();
    });

    it('GET lista el historial completo sin envelope', async () => {
      const app = buildApp();
      await registerAdminRoutes(app);
      (prisma.deslindeVersion.findMany as any).mockResolvedValue([
        { id: 2, version: 2, activa: true },
        { id: 1, version: 1, activa: false },
      ]);

      const res = await app.inject({ method: 'GET', url: '/api/deslindes' });

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.json())).toBe(true);
      expect(res.json()).toHaveLength(2);
      await app.close();
    });
  });

  // ---------------------------------------------------------------
  // Reglas operativas
  // ---------------------------------------------------------------
  describe('Reglas operativas', () => {
    it('PUT upsert crea la regla la primera vez', async () => {
      const app = buildApp();
      await registerAdminRoutes(app);
      (prisma.reglaOperativa.upsert as any).mockResolvedValue({
        id: 1,
        clave: 'pesoMaximoPasajero',
        valor: '110',
        categoria: 'SEGURIDAD',
      });

      const res = await app.inject({
        method: 'PUT',
        url: '/api/reglas-operativas/pesoMaximoPasajero',
        payload: { valor: '110', categoria: 'SEGURIDAD', descripcion: 'Peso máximo' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().clave).toBe('pesoMaximoPasajero');
      expect(prisma.reglaOperativa.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { clave: 'pesoMaximoPasajero' } }),
      );
      await app.close();
    });

    it('PUT upsert con la misma clave actualiza en vez de duplicar', async () => {
      const app = buildApp();
      await registerAdminRoutes(app);
      (prisma.reglaOperativa.upsert as any)
        .mockResolvedValueOnce({ id: 1, clave: 'k', valor: '110', categoria: 'SEGURIDAD' })
        .mockResolvedValueOnce({ id: 1, clave: 'k', valor: '105', categoria: 'SEGURIDAD' });

      await app.inject({
        method: 'PUT',
        url: '/api/reglas-operativas/k',
        payload: { valor: '110', categoria: 'SEGURIDAD' },
      });
      const res = await app.inject({
        method: 'PUT',
        url: '/api/reglas-operativas/k',
        payload: { valor: '105', categoria: 'SEGURIDAD' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().valor).toBe('105');
      expect(prisma.reglaOperativa.upsert).toHaveBeenCalledTimes(2);
      const segundaLlamada = (prisma.reglaOperativa.upsert as any).mock.calls[1][0];
      expect(segundaLlamada.where.clave).toBe('k');
      await app.close();
    });
  });

  // ---------------------------------------------------------------
  // Endpoints públicos (sin auth)
  // ---------------------------------------------------------------
  describe('Público', () => {
    function buildPublicApp(): FastifyInstance {
      const app = Fastify();
      app.register(publicRoutes, { prefix: '/api/public' });
      return app as unknown as FastifyInstance;
    }

    it('GET /faqs devuelve solo públicas ordenadas', async () => {
      const app = buildPublicApp();
      await app.ready();
      (prisma.faq.findMany as any).mockResolvedValue([
        { pregunta: '¿Qué incluir?', respuesta: 'Todo', orden: 1, publica: true },
      ]);

      const res = await app.inject({ method: 'GET', url: '/api/public/faqs' });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toHaveLength(1);
      expect(prisma.faq.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { publica: true, deletedAt: null }, orderBy: { orden: 'asc' } }),
      );
      await app.close();
    });

    it('GET /deslinde-activo devuelve null (200) si no hay versión activa', async () => {
      const app = buildPublicApp();
      await app.ready();
      (prisma.deslindeVersion.findFirst as any).mockResolvedValue(null);

      const res = await app.inject({ method: 'GET', url: '/api/public/deslinde-activo' });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toBeNull();
      await app.close();
    });

    it('GET /deslinde-activo devuelve la versión activa', async () => {
      const app = buildPublicApp();
      await app.ready();
      (prisma.deslindeVersion.findFirst as any).mockResolvedValue({
        id: 1,
        version: 1,
        activa: true,
        texto: 'Declaro estar en condiciones...',
      });

      const res = await app.inject({ method: 'GET', url: '/api/public/deslinde-activo' });

      expect(res.statusCode).toBe(200);
      expect(res.json().texto).toContain('Declaro');
      await app.close();
    });
  });
});
