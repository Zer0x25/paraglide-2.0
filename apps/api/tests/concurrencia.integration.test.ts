import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { buildApp } from '../src/app';
import { FastifyInstance } from 'fastify';
import { getAdminToken } from './helpers/test-auth';

describe('Concurrencia Optimista e Idempotencia (Integración DB Real)', () => {
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

  it('detecta colisión concurrente (HTTP 409) cuando dos peticiones envían la misma versión', async () => {
    // 1. Setup: Crear piloto
    const resPiloto = await apiReq('post', '/api/pilotos').send({
      nombre: 'Piloto Concurrente',
      email: `piloto-conc-${Date.now()}@example.com`,
      telefono: '998877665',
      peso: 75,
      tieneLicencia: true,
    });
    const pilotoId = resPiloto.body.id;

    // 2. Setup: Crear reserva y pasajero
    const resReserva = await apiReq('post', '/api/reservas').send({
      nombreTitular: 'Titular Concurrente',
      email: `conc-${Date.now()}@example.com`,
      telefono: '987654321',
      valorTotal: 50000,
      abono: 0,
      fechaReserva: new Date().toISOString(),
      pasajeros: [{ nombre: 'Pasajero Concurrente', peso: 70 }],
    });
    const pasajeroId = resReserva.body.pasajeros[0].id;

    // 3. Setup: Crear vuelo agendado (versión inicial 0)
    const resVuelo = await apiReq('post', '/api/vuelos').send({
      fechaHora: new Date(Date.now() + 86400000).toISOString(),
      valorPactado: 50000,
      estado: 'AGENDADO',
      pilotoId,
      pasajeroId,
    });
    expect(resVuelo.status).toBe(201);
    const vueloId = resVuelo.body.id;
    const initialVersion = resVuelo.body.version;

    // 4. Disparar dos mutaciones simultáneas sobre la misma versión exacta
    const [resA, resB] = await Promise.all([
      apiReq('patch', `/api/vuelos/${vueloId}/estado`).send({
        estado: 'COMPLETADO',
        version: initialVersion,
      }),
      apiReq('patch', `/api/vuelos/${vueloId}/estado`).send({
        estado: 'COMPLETADO',
        version: initialVersion,
      }),
    ]);

    const statuses = [resA.status, resB.status].sort();

    // Exactamente una debe ganar (200) y la otra debe ser rechazada con conflicto (409)
    expect(statuses).toEqual([200, 409]);

    const conflictRes = resA.status === 409 ? resA : resB;
    expect(conflictRes.body.message).toMatch(/cambi(ó|aron) en otro dispositivo/i);
  });

  it('soporta re-agendamientos sucesivos incrementando version: 0 -> 1 -> 2 sin conflicto', async () => {
    // 1. Setup
    const resPilotoA = await apiReq('post', '/api/pilotos').send({
      nombre: 'Piloto Sucesivo A',
      email: `piloto-suc-a-${Date.now()}@example.com`,
      telefono: '911111111',
      peso: 75,
      tieneLicencia: true,
    });
    const resPilotoB = await apiReq('post', '/api/pilotos').send({
      nombre: 'Piloto Sucesivo B',
      email: `piloto-suc-b-${Date.now()}@example.com`,
      telefono: '922222222',
      peso: 80,
      tieneLicencia: true,
    });

    const resReserva = await apiReq('post', '/api/reservas').send({
      nombreTitular: 'Titular Sucesivo',
      email: `suc-${Date.now()}@example.com`,
      telefono: '987654321',
      valorTotal: 50000,
      abono: 0,
      fechaReserva: new Date().toISOString(),
      pasajeros: [{ nombre: 'Pasajero Sucesivo', peso: 70 }],
    });
    const pasajeroId = resReserva.body.pasajeros[0].id;

    // Vuelo inicial (v0)
    const fechaBase = new Date(Date.now() + 172800000);
    const resVuelo = await apiReq('post', '/api/vuelos').send({
      fechaHora: fechaBase.toISOString(),
      valorPactado: 50000,
      estado: 'AGENDADO',
      pilotoId: resPilotoA.body.id,
      pasajeroId,
    });
    const vueloId = resVuelo.body.id;
    let currentVersion = resVuelo.body.version;

    // Re-agendamiento 1: Cambiar a Piloto B
    const resUpdate1 = await apiReq('put', `/api/vuelos/${vueloId}`).send({
      fechaHora: fechaBase.toISOString(),
      valorPactado: 50000,
      estado: 'AGENDADO',
      pilotoId: resPilotoB.body.id,
      pasajeroId,
      version: currentVersion,
    });
    expect(resUpdate1.status).toBe(200);
    expect(resUpdate1.body.pilotoId).toBe(resPilotoB.body.id);
    currentVersion = resUpdate1.body.version;

    // Re-agendamiento 2: Cambiar de nuevo a Piloto A con la versión recién incrementada
    const resUpdate2 = await apiReq('put', `/api/vuelos/${vueloId}`).send({
      fechaHora: fechaBase.toISOString(),
      valorPactado: 50000,
      estado: 'AGENDADO',
      pilotoId: resPilotoA.body.id,
      pasajeroId,
      version: currentVersion,
    });
    expect(resUpdate2.status).toBe(200);
    expect(resUpdate2.body.pilotoId).toBe(resPilotoA.body.id);
    expect(resUpdate2.body.version).toBeGreaterThan(currentVersion);
  });
});
