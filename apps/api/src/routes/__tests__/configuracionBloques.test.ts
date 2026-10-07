import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';

/**
 * Tests Fase 2-B: rutas de Configuración de Bloques.
 *
 * Patrón de la suite (unitario): Prisma mockeado, app mínima y `authorize`
 * decorado como stub controlado por el header `x-test-role` (default ADMIN).
 * NO se mockea @parapente/shared: resolverConfiguracion/numerarConfigs son
 * puras y se usan las reales tanto en la implementación como en los fixtures.
 */
vi.mock('../../plugins/prisma', () => ({
  prisma: {
    configuracionBloque: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    horarioBloque: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('../../services/auditoria.service', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from '../../plugins/prisma';
import configuracionBloquesRoutes from '../configuracionBloques';

const adminUser = { id: 1, email: 'admin@test.com', nombre: 'Admin', role: 'ADMIN' };

function buildApp(): FastifyInstance {
  const app = Fastify();
  app.decorate('authorize', (_roles: string[]) => async (request: any, reply: any) => {
    const role = (request.headers['x-test-role'] as string) ?? 'ADMIN';
    if (!_roles.includes(role)) {
      return reply.status(403).send({ error: 'Forbidden' });
    }
    request.user = { ...adminUser, role };
  });
  return app;
}

async function registerRoutes(app: FastifyInstance) {
  await app.register(configuracionBloquesRoutes, { prefix: '/api/configuracion-bloques' });
  await app.ready();
}

/**
 * $transaction mockeado: si recibe función, la invoca con un tx que es el
 * mismo mock de prisma (patrón de la suite).
 */
beforeEach(() => {
  vi.clearAllMocks();
  (prisma.$transaction as any).mockImplementation(async (arg: any) => {
    if (typeof arg === 'function') return arg(prisma);
    return Promise.all(arg);
  });
});

// ---------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------
const HORARIOS = [{ horaInicio: '09:00', horaFin: '13:00' }];

const indefinido = {
  id: 1,
  nombre: 'Base',
  fechaInicio: null,
  fechaFin: null,
  fechaExacta: null,
  bloqueado: false,
  archivada: false,
  version: 3,
  createdAt: new Date('2026-01-01T10:00:00Z'),
  horarios: HORARIOS,
};

const rangoVerano = {
  id: 2,
  nombre: 'Verano',
  fechaInicio: new Date('2026-12-01T00:00:00Z'),
  fechaFin: new Date('2026-12-31T00:00:00Z'),
  fechaExacta: null,
  bloqueado: false,
  archivada: false,
  version: 1,
  createdAt: new Date('2026-01-02T10:00:00Z'),
  horarios: HORARIOS,
};

const exactaNavidad = {
  id: 3,
  nombre: 'Navidad',
  fechaInicio: null,
  fechaFin: null,
  fechaExacta: new Date('2026-12-25T00:00:00Z'),
  bloqueado: true,
  archivada: false,
  version: 1,
  createdAt: new Date('2026-01-03T10:00:00Z'),
  horarios: [],
};

describe('Configuración de Bloques API — Fase 2-B (unit)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.$transaction as any).mockImplementation(async (arg: any) => {
      if (typeof arg === 'function') return arg(prisma);
      return Promise.all(arg);
    });
  });

  // -------------------------------------------------------------
  // POST: reglas de negocio vía validarSolapamientos
  // -------------------------------------------------------------
  describe('POST /', () => {
    it('rechaza un segundo INDEFINIDO con 400', async () => {
      const app = buildApp();
      await registerRoutes(app);
      (prisma.configuracionBloque.findMany as any).mockResolvedValue([indefinido]);

      const res = await app.inject({
        method: 'POST',
        url: '/api/configuracion-bloques',
        payload: { nombre: 'Otro base', bloqueado: false, horarios: HORARIOS },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toMatch(/Ya existe una configuración indefinida/i);
      expect(prisma.configuracionBloque.create).not.toHaveBeenCalled();
      await app.close();
    });

    it('rechaza un RANGO solapado con otro rango existente (400)', async () => {
      const app = buildApp();
      await registerRoutes(app);
      (prisma.configuracionBloque.findMany as any).mockResolvedValue([rangoVerano]);

      const res = await app.inject({
        method: 'POST',
        url: '/api/configuracion-bloques',
        payload: {
          nombre: 'Invierno pisado',
          fechaInicio: '2026-12-15',
          fechaFin: '2027-01-15',
          bloqueado: false,
          horarios: HORARIOS,
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toMatch(/El rango se superpone con "Verano"/i);
      expect(prisma.configuracionBloque.create).not.toHaveBeenCalled();
      await app.close();
    });

    it('rechaza RANGO nuevo que cae dentro de un RANGO ABIERTO existente (400)', async () => {
      // Nota: CreateConfiguracionPayloadSchema exige inicio+fin completos, así
      // que un rango abierto solo puede existir por edición (PATCH fechaFin:null).
      // Aquí validamos la regla: el abierto solapa con todo lo posterior a su inicio.
      const app = buildApp();
      await registerRoutes(app);
      const rangoAbierto = { ...rangoVerano, fechaFin: null };
      (prisma.configuracionBloque.findMany as any).mockResolvedValue([rangoAbierto]);

      const res = await app.inject({
        method: 'POST',
        url: '/api/configuracion-bloques',
        payload: {
          nombre: 'Enero siguiente',
          fechaInicio: '2027-01-01',
          fechaFin: '2027-02-01',
          bloqueado: false,
          horarios: HORARIOS,
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toMatch(/El rango se superpone con "Verano"/i);
      await app.close();
    });

    it('permite rangos contiguos sin solape (201)', async () => {
      const app = buildApp();
      await registerRoutes(app);
      (prisma.configuracionBloque.findMany as any).mockResolvedValue([indefinido, rangoVerano]);
      (prisma.configuracionBloque.create as any).mockResolvedValue({ id: 9, nombre: 'Primavera' });

      const res = await app.inject({
        method: 'POST',
        url: '/api/configuracion-bloques',
        payload: {
          nombre: 'Primavera',
          fechaInicio: '2027-01-01',
          fechaFin: '2027-03-01',
          bloqueado: false,
          horarios: HORARIOS,
        },
      });

      expect(res.statusCode).toBe(201);
      await app.close();
    });

    it('rechaza EXACTA duplicada el mismo día (400)', async () => {
      const app = buildApp();
      await registerRoutes(app);
      (prisma.configuracionBloque.findMany as any).mockResolvedValue([exactaNavidad]);

      const res = await app.inject({
        method: 'POST',
        url: '/api/configuracion-bloques',
        payload: {
          nombre: 'Otra navidad',
          fechaExacta: '2026-12-25',
          bloqueado: true,
          horarios: [],
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toMatch(/Ya existe una configuración para esta fecha exacta/i);
      await app.close();
    });
  });

  // -------------------------------------------------------------
  // PATCH /:id: merge de valores efectivos + excludeId + guard archivada
  // -------------------------------------------------------------
  describe('PATCH /:id', () => {
    it('permite mover un rango a una posición válida (200)', async () => {
      const app = buildApp();
      await registerRoutes(app);
      const rango = { ...rangoVerano, id: 2 };
      (prisma.configuracionBloque.findUnique as any).mockResolvedValue(rango);
      // Otros rangos activos (excluye el propio id 2): sin conflicto con el nuevo rango
      (prisma.configuracionBloque.findMany as any).mockResolvedValue([]);
      (prisma.configuracionBloque.update as any).mockResolvedValue({ ...rango, fechaInicio: new Date('2027-01-01') });
      (prisma.configuracionBloque.findUnique as any).mockResolvedValueOnce(rango); // 1ª llamada dentro de tx

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/configuracion-bloques/2',
        payload: { fechaInicio: '2027-01-01', fechaFin: '2027-02-01', version: 1 },
      });

      expect(res.statusCode).toBe(200);
      await app.close();
    });

    it('rechaza mover un rango sobre otro existente (400)', async () => {
      const app = buildApp();
      await registerRoutes(app);
      const rango = { ...rangoVerano, id: 2 };
      (prisma.configuracionBloque.findUnique as any).mockResolvedValue(rango);
      // Otro rango activo distinto que ocupa el destino
      (prisma.configuracionBloque.findMany as any).mockResolvedValue([
        { ...rangoVerano, id: 5, nombre: 'Invierno' },
      ]);

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/configuracion-bloques/2',
        payload: { fechaInicio: '2026-12-15', fechaFin: '2027-01-15', version: 1 },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toMatch(/El rango se superpone/i);
      await app.close();
    });

    it('rechaza editar una config ARCHIVADA (snapshot histórico)', async () => {
      const app = buildApp();
      await registerRoutes(app);
      (prisma.configuracionBloque.findUnique as any).mockResolvedValue({
        ...rangoVerano,
        id: 2,
        archivada: true,
      });

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/configuracion-bloques/2',
        payload: { nombre: 'Renombrada', version: 1 },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toMatch(/archivada/i);
      expect(prisma.configuracionBloque.update).not.toHaveBeenCalled();
      await app.close();
    });

    it('al editar el INDEFINIDO, ARCHIVA la versión original (snapshot) y crea nueva config activa', async () => {
      const app = buildApp();
      await registerRoutes(app);
      (prisma.configuracionBloque.findUnique as any).mockResolvedValue(indefinido);
      (prisma.configuracionBloque.findMany as any).mockResolvedValue([]);
      (prisma.configuracionBloque.update as any).mockResolvedValue({
        ...indefinido,
        archivada: true,
        archivadaEn: new Date(),
      });
      (prisma.configuracionBloque.create as any).mockResolvedValue({
        id: 10,
        nombre: 'Base Nuevo',
        bloqueado: false,
        fechaInicio: null,
        fechaFin: null,
        fechaExacta: null,
        archivada: false,
        version: 0,
        horarios: [{ horaInicio: '10:00', horaFin: '14:00' }],
      });

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/configuracion-bloques/1',
        payload: {
          nombre: 'Base Nuevo',
          horarios: [{ horaInicio: '10:00', horaFin: '14:00' }],
          version: 3,
        },
      });

      expect(res.statusCode).toBe(200);
      expect(prisma.configuracionBloque.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: expect.objectContaining({
            archivada: true,
            archivadaEn: expect.any(Date),
            version: { increment: 1 },
          }),
        }),
      );
      expect(prisma.configuracionBloque.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            nombre: 'Base Nuevo',
            fechaInicio: null,
            fechaFin: null,
            fechaExacta: null,
          }),
        }),
      );
      // Los horarios originales NO se borran (se conservan para histórico)
      expect(prisma.horarioBloque.deleteMany).not.toHaveBeenCalled();
      await app.close();
    });
  });

  // -------------------------------------------------------------
  // DELETE: archivar (snapshot), nunca deletedAt
  // -------------------------------------------------------------
  describe('DELETE /:id', () => {
    it('rechaza eliminar el INDEFINIDO (400)', async () => {
      const app = buildApp();
      await registerRoutes(app);
      (prisma.configuracionBloque.findUnique as any).mockResolvedValue(indefinido);

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/configuracion-bloques/1',
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toMatch(/La configuración indefinida es la base y no se puede eliminar/i);
      expect(prisma.configuracionBloque.update).not.toHaveBeenCalled();
      await app.close();
    });

    it('ARCHIVA una config normal: archivada=true y SIN deletedAt', async () => {
      const app = buildApp();
      await registerRoutes(app);
      (prisma.configuracionBloque.findUnique as any).mockResolvedValue(rangoVerano);
      (prisma.configuracionBloque.update as any).mockResolvedValue({
        ...rangoVerano,
        archivada: true,
      });

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/configuracion-bloques/2',
      });

      expect(res.statusCode).toBe(200);
      expect(prisma.configuracionBloque.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 2 },
          data: expect.objectContaining({
            archivada: true,
            archivadaEn: expect.any(Date),
            version: { increment: 1 },
          }),
        }),
      );
      // Nunca deletedAt para bloques (snapshot)
      const dataArg = (prisma.configuracionBloque.update as any).mock.calls[0][0].data;
      expect(dataArg).not.toHaveProperty('deletedAt');
      // Los horarios quedan intactos (snapshot histórico)
      expect(prisma.horarioBloque.updateMany).not.toHaveBeenCalled();
      expect(prisma.horarioBloque.deleteMany).not.toHaveBeenCalled();
      await app.close();
    });
  });

  // -------------------------------------------------------------
  // GET /resolver
  // -------------------------------------------------------------
  describe('GET /resolver', () => {
    function mockResolverConfigs() {
      (prisma.configuracionBloque.findMany as any).mockResolvedValue([
        indefinido,
        rangoVerano,
        exactaNavidad,
      ]);
    }

    it('valida query: formato, orden y cap de días', async () => {
      const app = buildApp();
      await registerRoutes(app);

      const malFormato = await app.inject({
        method: 'GET',
        url: '/api/configuracion-bloques/resolver?desde=25-12-2026&hasta=26-12-2026',
      });
      expect(malFormato.statusCode).toBe(400);

      const desordenado = await app.inject({
        method: 'GET',
        url: '/api/configuracion-bloques/resolver?desde=2026-12-26&hasta=2026-12-25',
      });
      expect(desordenado.statusCode).toBe(400);

      const demasiadoLargo = await app.inject({
        method: 'GET',
        url: '/api/configuracion-bloques/resolver?desde=2026-01-01&hasta=2028-01-01',
      });
      expect(demasiadoLargo.statusCode).toBe(400);
      await app.close();
    });

    it('prioridad EXACTA > RANGO > INDEFINIDO y numeración #1/#2/#3', async () => {
      const app = buildApp();
      await registerRoutes(app);
      mockResolverConfigs();

      const res = await app.inject({
        method: 'GET',
        url: '/api/configuracion-bloques/resolver?desde=2026-12-24&hasta=2026-12-26',
      });

      expect(res.statusCode).toBe(200);
      const dias = res.json();
      // 24/12 → RANGO Verano (#2); 25/12 → EXACTA Navidad (#3); 26/12 → RANGO (#2)
      expect(dias['2026-12-24']).toMatchObject({
        configuracionId: 2,
        numero: 2,
        nombre: 'Verano',
        bloqueado: false,
      });
      expect(dias['2026-12-25']).toMatchObject({
        configuracionId: 3,
        numero: 3,
        nombre: 'Navidad',
        bloqueado: true,
      });
      expect(dias['2026-12-26']).toMatchObject({ configuracionId: 2, numero: 2 });

      // Día fuera de todo rango → INDEFINIDO #1
      const res2 = await app.inject({
        method: 'GET',
        url: '/api/configuracion-bloques/resolver?desde=2026-06-01&hasta=2026-06-01',
      });
      expect(res2.json()['2026-06-01']).toMatchObject({
        configuracionId: 1,
        numero: 1,
        nombre: 'Base',
      });
      await app.close();
    });

    it('archivada visible en fecha PASADA e invisible en HOY/FUTURO', async () => {
      const app = buildApp();
      await registerRoutes(app);

      const hoyStr = new Date().toISOString().slice(0, 10);
      const ayer = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
      const pasadoLejano = new Date(Date.now() - 5 * 86_400_000).toISOString().slice(0, 10);
      const manana = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

      const archivadaReciente = {
        ...exactaNavidad,
        id: 4,
        nombre: 'Promo vieja',
        fechaExacta: new Date(`${pasadoLejano}T00:00:00Z`),
        archivada: true,
        archivadaEn: new Date(),
      };

      (prisma.configuracionBloque.findMany as any).mockResolvedValue([indefinido, archivadaReciente]);

      // Fecha pasada: la archivada aplica (snapshot)
      const resPasado = await app.inject({
        method: 'GET',
        url: `/api/configuracion-bloques/resolver?desde=${pasadoLejano}&hasta=${pasadoLejano}`,
      });
      expect(resPasado.json()[pasadoLejano]).toMatchObject({
        configuracionId: 4,
        nombre: 'Promo vieja',
      });
      // Numeración separada: la archivada NO ocupa número activo (#IN1),
      // el espacio #N queda reservado para vigentes (indefinido=#1).
      expect(resPasado.json()[pasadoLejano].numero).toBeNull();
      expect(resPasado.json()[pasadoLejano].numeroInactiva).toBe(1);

      // Hoy y mañana: la archivada se ignora → gana el INDEFINIDO
      for (const dia of [hoyStr, manana]) {
        const resFuturo = await app.inject({
          method: 'GET',
          url: `/api/configuracion-bloques/resolver?desde=${dia}&hasta=${dia}`,
        });
        expect(resFuturo.json()[dia]).toMatchObject({ configuracionId: 1, numero: 1 });
      }
      void ayer;
      await app.close();
    });

    it('INDEFINIDO archivado resuelve en fechas PASADAS y nuevo INDEFINIDO activo resuelve en HOY/FUTURO', async () => {
      const app = buildApp();
      await registerRoutes(app);

      const hoyStr = new Date().toISOString().slice(0, 10);
      const pasadoLejano = new Date(Date.now() - 5 * 86_400_000).toISOString().slice(0, 10);
      const manana = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

      const indefinidoArchivado = {
        id: 1,
        nombre: 'Base Antiguo',
        fechaInicio: null,
        fechaFin: null,
        fechaExacta: null,
        bloqueado: false,
        archivada: true,
        archivadaEn: new Date(),
        version: 1,
        createdAt: new Date('2026-01-01T10:00:00Z'),
        horarios: [{ horaInicio: '09:00', horaFin: '13:00' }],
      };

      const indefinidoActivo = {
        id: 10,
        nombre: 'Base Nuevo',
        fechaInicio: null,
        fechaFin: null,
        fechaExacta: null,
        bloqueado: false,
        archivada: false,
        archivadaEn: null,
        version: 0,
        createdAt: new Date(),
        horarios: [{ horaInicio: '10:00', horaFin: '14:00' }],
      };

      (prisma.configuracionBloque.findMany as any).mockResolvedValue([
        indefinidoArchivado,
        indefinidoActivo,
      ]);

      // Pasado: resuelve la archivada (snapshot histórico, no se mueve el pasado)
      const resPasado = await app.inject({
        method: 'GET',
        url: `/api/configuracion-bloques/resolver?desde=${pasadoLejano}&hasta=${pasadoLejano}`,
      });
      expect(resPasado.json()[pasadoLejano]).toMatchObject({
        configuracionId: 1,
        nombre: 'Base Antiguo',
        horarios: [{ horaInicio: '09:00', horaFin: '13:00' }],
      });
      expect(resPasado.json()[pasadoLejano].numero).toBeNull();
      expect(resPasado.json()[pasadoLejano].numeroInactiva).toBe(1);

      // Hoy y Futuro: resuelve la activa nueva (#1)
      for (const dia of [hoyStr, manana]) {
        const resFuturo = await app.inject({
          method: 'GET',
          url: `/api/configuracion-bloques/resolver?desde=${dia}&hasta=${dia}`,
        });
        expect(resFuturo.json()[dia]).toMatchObject({
          configuracionId: 10,
          nombre: 'Base Nuevo',
          numero: 1,
          horarios: [{ horaInicio: '10:00', horaFin: '14:00' }],
        });
      }

      await app.close();
    });

    it('día sin ninguna config aplicable → día vacío', async () => {
      const app = buildApp();
      await registerRoutes(app);
      (prisma.configuracionBloque.findMany as any).mockResolvedValue([]);

      const res = await app.inject({
        method: 'GET',
        url: '/api/configuracion-bloques/resolver?desde=2026-06-01&hasta=2026-06-02',
      });

      expect(res.json()['2026-06-01']).toEqual({
        fecha: '2026-06-01',
        configuracionId: null,
        numero: null,
        numeroInactiva: null,
        nombre: null,
        bloqueado: false,
        horarios: [],
      });
      await app.close();
    });
  });

  // -------------------------------------------------------------
  // POST /limpiar-expiradas
  // -------------------------------------------------------------
  describe('POST /limpiar-expiradas', () => {
    it('archiva solo expiradas y responde { archivadas }', async () => {
      const app = buildApp();
      await registerRoutes(app);
      (prisma.configuracionBloque.updateMany as any).mockResolvedValue({ count: 3 });

      const res = await app.inject({
        method: 'POST',
        url: '/api/configuracion-bloques/limpiar-expiradas',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ archivadas: 3 });
      expect(prisma.configuracionBloque.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: null,
            archivada: false,
          }),
          data: expect.objectContaining({ archivada: true, archivadaEn: expect.any(Date) }),
        }),
      );
      const whereArg = (prisma.configuracionBloque.updateMany as any).mock.calls[0][0].where;
      expect(whereArg.OR).toEqual(
        expect.arrayContaining([
          { fechaFin: { lt: expect.any(Date) } },
          { fechaExacta: { lt: expect.any(Date) } },
        ]),
      );
      await app.close();
    });

    it('requiere rol ADMIN (403 para PILOTO)', async () => {
      const app = buildApp();
      await registerRoutes(app);

      const res = await app.inject({
        method: 'POST',
        url: '/api/configuracion-bloques/limpiar-expiradas',
        headers: { 'x-test-role': 'PILOTO' },
      });

      expect(res.statusCode).toBe(403);
      await app.close();
    });
  });

  // -------------------------------------------------------------
  // GET / (listado)
  // -------------------------------------------------------------
  describe('GET /', () => {
    it('devuelve array plano con orderBy determinista (createdAt asc)', async () => {
      const app = buildApp();
      await registerRoutes(app);
      (prisma.configuracionBloque.findMany as any).mockResolvedValue([indefinido]);

      const res = await app.inject({ method: 'GET', url: '/api/configuracion-bloques' });

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.json())).toBe(true);
      expect(prisma.configuracionBloque.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        }),
      );
      await app.close();
    });
  });
});
