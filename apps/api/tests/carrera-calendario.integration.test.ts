import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { buildApp } from '../src/app';
import { FastifyInstance } from 'fastify';
import { getAdminToken } from './helpers/test-auth';

describe('Carrera Crítica en Calendario (Integración DB Real)', () => {
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

  const apiReq = (method: 'get' | 'post' | 'put' | 'delete' | 'patch', url: string) => {
    return supertest(app.server)[method](url).set('Authorization', `Bearer ${token}`);
  };

  it('evita doble agendamiento al mismo piloto en paralelo: 1 aprobado (201) y 1 colisión (400)', async () => {
    // 1. Piloto único de prueba
    const resPiloto = await apiReq('post', '/api/pilotos').send({
      nombre: 'Piloto Carrera Único',
      email: `piloto-carrera-${Date.now()}@example.com`,
      telefono: '998877112',
      peso: 75,
      tieneLicencia: true,
    });
    const pilotoId = resPiloto.body.id;

    // 2. Dos reservas distintas con pasajeros distintos
    const [resReservaA, resReservaB] = await Promise.all([
      apiReq('post', '/api/reservas').send({
        nombreTitular: 'Titular Carrera A',
        email: `carrera-a-${Date.now()}@example.com`,
        valorTotal: 50000,
        abono: 0,
        pasajeros: [{ nombre: 'Pasajero Carrera A', peso: 70 }],
      }),
      apiReq('post', '/api/reservas').send({
        nombreTitular: 'Titular Carrera B',
        email: `carrera-b-${Date.now()}@example.com`,
        valorTotal: 50000,
        abono: 0,
        pasajeros: [{ nombre: 'Pasajero Carrera B', peso: 75 }],
      }),
    ]);

    const paxAId = resReservaA.body.pasajeros[0].id;
    const paxBId = resReservaB.body.pasajeros[0].id;

    // 3. Misma fecha y hora exacta
    const fechaHora = new Date(Date.now() + 259200000).toISOString(); // +3 días

    // 4. Intentar agendar concurrentemente al mismo piloto
    const [resVueloA, resVueloB] = await Promise.all([
      apiReq('post', '/api/vuelos').send({
        fechaHora,
        valorPactado: 50000,
        estado: 'AGENDADO',
        pilotoId,
        pasajeroId: paxAId,
      }),
      apiReq('post', '/api/vuelos').send({
        fechaHora,
        valorPactado: 50000,
        estado: 'AGENDADO',
        pilotoId,
        pasajeroId: paxBId,
      }),
    ]);

    const statuses = [resVueloA.status, resVueloB.status].sort();

    // Exactamente 1 éxito (201) y 1 rechazo por conflicto (400)
    expect(statuses).toEqual([201, 400]);

    const conflictRes = resVueloA.status === 400 ? resVueloA : resVueloB;
    expect(conflictRes.body.message).toMatch(/piloto ya tiene un vuelo|conflicto de horario/i);
  });
});
