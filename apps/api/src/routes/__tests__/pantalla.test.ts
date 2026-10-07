import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import pantallaRoutes from '../pantalla.routes';

vi.mock('../../plugins/prisma', () => {
  return {
    prisma: {
      pantallaToken: {
        findFirst: vi.fn(),
        create: vi.fn(),
        updateMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    },
  };
});

import { prisma } from '../../plugins/prisma';

describe('Pantalla Token Routes (Admin)', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify();
    app.decorate('authorize', () => async (request: any) => {
      request.user = { id: 1, email: 'admin@test.com', nombre: 'Admin', role: 'ADMIN' };
    });
    await app.register(pantallaRoutes);
    await app.ready();
  });

  it('GET /link?tipo=DIARIO - debería crear el enlace del día si no existe uno vigente', async () => {
    (prisma.pantallaToken.findFirst as any).mockResolvedValue(null);
    (prisma.pantallaToken.create as any).mockResolvedValue({
      token: 'nuevo-token-diario',
      expiraEn: new Date('2026-08-16T23:59:59.999Z'),
    });

    const response = await app.inject({ method: 'GET', url: '/link?tipo=DIARIO' });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.tipo).toBe('DIARIO');
    expect(body.token).toMatch(/^[0-9a-f]{64}$/);
    expect(body.url).toContain(`/pantalla?token=${body.token}`);
    expect(prisma.pantallaToken.create).toHaveBeenCalledTimes(1);
  });

  it('GET /link?tipo=DIARIO - debería reutilizar el enlace vigente del día', async () => {
    (prisma.pantallaToken.findFirst as any).mockResolvedValue({
      token: 'token-existente',
      expiraEn: new Date('2026-08-16T23:59:59.999Z'),
    });

    const response = await app.inject({ method: 'GET', url: '/link?tipo=DIARIO' });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).token).toBe('token-existente');
    expect(prisma.pantallaToken.create).not.toHaveBeenCalled();
  });

  it('GET /link - debería retornar 400 con tipo inválido', async () => {
    const response = await app.inject({ method: 'GET', url: '/link?tipo=SEMANAL' });

    expect(response.statusCode).toBe(400);
  });

  it('POST /link/regenerate - debería invalidar el enlace actual y crear uno nuevo', async () => {
    (prisma.pantallaToken.updateMany as any).mockResolvedValue({ count: 1 });
    (prisma.pantallaToken.create as any).mockResolvedValue({
      token: 'token-renovado',
      expiraEn: new Date('2026-08-16T23:59:59.999Z'),
    });

    const response = await app.inject({ method: 'POST', url: '/link/regenerate?tipo=DIARIO' });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).token).toMatch(/^[0-9a-f]{64}$/);
    expect(prisma.pantallaToken.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.pantallaToken.create).toHaveBeenCalledTimes(1);
  });
});
