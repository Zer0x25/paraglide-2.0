import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { buildApp } from '../src/app';
import { FastifyInstance } from 'fastify';
import { getAdminToken } from './helpers/test-auth';

describe('Correlativos con Soft Delete en DB Real (Evitar Colisión P2002)', () => {
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

  it('Genera correlativos correlativos incrementales considerando registros eliminados por soft-delete', async () => {
    // 1. Crear primera reserva
    const res1 = await supertest(app.server)
      .post('/api/reservas')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nombreTitular: 'Titular SoftDelete 1',
        email: `soft1-${Date.now()}@test.com`,
        telefono: '911111111',
        estadoPago: 'PENDIENTE',
        valorTotal: 50000,
        abono: 0,
        fechaReserva: new Date().toISOString(),
        pasajeros: [{ nombre: 'Pax 1', peso: 70 }]
      });

    expect(res1.status).toBe(201);
    expect(res1.body).toHaveProperty('id');
    expect(res1.body).toHaveProperty('numeroReserva');
    const id1 = res1.body.id;
    const num1 = res1.body.numeroReserva;

    // 2. Soft-delete de la primera reserva
    const resDel = await supertest(app.server)
      .delete(`/api/reservas/${id1}`)
      .set('Authorization', `Bearer ${token}`);

    expect([200, 204]).toContain(resDel.status);

    // 3. Comprobar que no aparece en el listado activo
    const resGet = await supertest(app.server)
      .get(`/api/reservas/${id1}`)
      .set('Authorization', `Bearer ${token}`);

    expect(resGet.status).toBe(404);

    // 4. Crear una segunda reserva en el mismo instante
    const res2 = await supertest(app.server)
      .post('/api/reservas')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nombreTitular: 'Titular SoftDelete 2',
        email: `soft2-${Date.now()}@test.com`,
        telefono: '922222222',
        estadoPago: 'PENDIENTE',
        valorTotal: 50000,
        abono: 0,
        fechaReserva: new Date().toISOString(),
        pasajeros: [{ nombre: 'Pax 2', peso: 75 }]
      });

    expect(res2.status).toBe(201);
    expect(res2.body).toHaveProperty('id');
    expect(res2.body).toHaveProperty('numeroReserva');
    const num2 = res2.body.numeroReserva;

    // 5. El segundo correlativo debe ser estrictamente distinto al primero
    expect(num2).not.toBe(num1);
  });
});
