import supertest from 'supertest';
import { buildApp } from '../src/app';
import { FastifyInstance } from 'fastify';
import { getAdminToken } from './helpers/test-auth';

describe('Dashboard API', () => {
  let app: FastifyInstance;
  let token: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    token = await getAdminToken(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('debería retornar las estadísticas agregadas del dashboard en una sola consulta', async () => {
    const res = await supertest(app.server)
      .get('/api/dashboard/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('pilotos');
    expect(res.body).toHaveProperty('pilotosActivos');
    expect(res.body).toHaveProperty('pilotosDisponiblesHoy');
    expect(res.body).toHaveProperty('pasajeros30d');
    expect(res.body).toHaveProperty('promedioDiarioPasajeros');
    expect(res.body).toHaveProperty('vuelosTotal');
    expect(res.body).toHaveProperty('vuelosHoy');
    expect(res.body).toHaveProperty('vuelosFuturos');
    expect(res.body).toHaveProperty('reservasRecientes');
    expect(Array.isArray(res.body.reservasRecientes)).toBe(true);
  });
});
