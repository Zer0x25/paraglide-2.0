import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { randomUUID } from 'crypto';
import { buildApp } from '../src/app';
import { FastifyInstance } from 'fastify';
import { getAdminToken } from './helpers/test-auth';

describe('Idempotencia de Outbox en DB Real (ADR 009)', () => {
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

  it('Deduplica llamadas idénticas con el mismo X-Client-Id evitando reservas duplicadas', async () => {
    const clientId = randomUUID();
    const payload = {
      nombreTitular: 'Idempotente Titular',
      email: `idem-${Date.now()}@test.com`,
      telefono: '911223344',
      estadoPago: 'PENDIENTE',
      valorTotal: 70000,
      abono: 0,
      fechaReserva: new Date().toISOString(),
      pasajeros: [
        {
          nombre: 'Pasajero Único',
          peso: 75
        }
      ]
    };

    // Primera llamada: debe procesar y guardar la clave de idempotencia
    const res1 = await supertest(app.server)
      .post('/api/reservas')
      .set('Authorization', `Bearer ${token}`)
      .set('x-client-id', clientId)
      .send(payload);

    expect(res1.status).toBe(201);
    expect(res1.body).toHaveProperty('id');
    const reservaId = res1.body.id;

    // Segunda llamada: replay idéntico con el MISMO X-Client-Id
    const res2 = await supertest(app.server)
      .post('/api/reservas')
      .set('Authorization', `Bearer ${token}`)
      .set('x-client-id', clientId)
      .send(payload);

    expect(res2.status).toBe(201);
    // Debe retornar la respuesta almacenada con el mismo ID de reserva
    expect(res2.body.id).toBe(reservaId);

    // Validar en el listado que no se crearon reservas duplicadas para ese email
    const resList = await supertest(app.server)
      .get(`/api/reservas?q=${encodeURIComponent(payload.email)}`)
      .set('Authorization', `Bearer ${token}`);

    expect(resList.status).toBe(200);
    expect(resList.body.data.length).toBe(1);
    expect(resList.body.data[0].id).toBe(reservaId);
  });
});
