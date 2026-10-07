import supertest from 'supertest';
import { buildApp } from '../src/app';
import { FastifyInstance } from 'fastify';
import { getAdminToken } from './helpers/test-auth';

describe('Metricas API', () => {
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

  it('debería retornar el resumen financiero y operativo del mes actual', async () => {
    const res = await supertest(app.server)
      .get('/api/metricas/financiero')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('mes');
    expect(res.body).toHaveProperty('year');
    expect(res.body).toHaveProperty('totalAgendados');
    expect(res.body).toHaveProperty('totalCompletados');
    expect(res.body).toHaveProperty('totalCancelados');
    expect(res.body).toHaveProperty('ingresosTotales');
    expect(res.body).toHaveProperty('pagosPilotos');
    expect(res.body).toHaveProperty('gastosOperativos');
    expect(res.body).toHaveProperty('pagoEscuela');
    expect(res.body).toHaveProperty('margenNetoPorcentaje');
    expect(res.body).toHaveProperty('pilotosTop');
    expect(Array.isArray(res.body.pilotosTop)).toBe(true);
    expect(res.body).toHaveProperty('demandaMensual');
    expect(Array.isArray(res.body.demandaMensual)).toBe(true);
    expect(res.body).toHaveProperty('gastosPorCategoria');
    expect(Array.isArray(res.body.gastosPorCategoria)).toBe(true);
  });

  it('debería soportar parámetros de consulta para mes y año específicos', async () => {
    const res = await supertest(app.server)
      .get('/api/metricas/financiero?mes=0&year=2026')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.mes).toBe(0);
    expect(res.body.year).toBe(2026);
  });
});
