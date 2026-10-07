import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { buildApp } from '../src/app';
import { FastifyInstance } from 'fastify';
import { getAdminToken, getRecepcionToken } from './helpers/test-auth';

describe('Control de Acceso RBAC (Integración DB Real)', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let recepcionToken: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    adminToken = await getAdminToken(app);
    recepcionToken = await getRecepcionToken(app, adminToken);
  });

  afterAll(async () => {
    await app.close();
  });

  it('bloquea con HTTP 403 al rol RECEPCION en /api/auditoria', async () => {
    const res = await supertest(app.server)
      .get('/api/auditoria')
      .set('Authorization', `Bearer ${recepcionToken}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/permisos|no autorizado|restringido|prohibido|acceso denegado/i);
  });

  it('bloquea con HTTP 403 al rol RECEPCION en /api/admin/modules', async () => {
    const res = await supertest(app.server)
      .put('/api/admin/modules')
      .set('Authorization', `Bearer ${recepcionToken}`)
      .send({ modules: ['equipos'] });

    expect(res.status).toBe(403);
  });

  it('bloquea con HTTP 403 al rol RECEPCION en gestión de usuarios /api/users', async () => {
    const res = await supertest(app.server)
      .get('/api/users')
      .set('Authorization', `Bearer ${recepcionToken}`);

    expect(res.status).toBe(403);
  });

  it('permite al rol RECEPCION consultar y operar en rutas operativas (pilotos, reservas)', async () => {
    const [resPilotos, resReservas] = await Promise.all([
      supertest(app.server)
        .get('/api/pilotos')
        .set('Authorization', `Bearer ${recepcionToken}`),
      supertest(app.server)
        .get('/api/reservas')
        .set('Authorization', `Bearer ${recepcionToken}`),
    ]);

    expect(resPilotos.status).toBe(200);
    expect(resReservas.status).toBe(200);
  });

  it('permite al rol ADMIN acceder a todas las rutas protegidas', async () => {
    const [resAuditoria, resUsers] = await Promise.all([
      supertest(app.server)
        .get('/api/auditoria')
        .set('Authorization', `Bearer ${adminToken}`),
      supertest(app.server)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`),
    ]);

    expect(resAuditoria.status).toBe(200);
    expect(resUsers.status).toBe(200);
  });
});
