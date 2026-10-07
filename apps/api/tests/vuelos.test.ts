import supertest from 'supertest';
import { buildApp } from '../src/app';
import { FastifyInstance } from 'fastify';
import { getAdminToken } from './helpers/test-auth';

describe('Vuelos API', () => {
  let app: FastifyInstance;
  let token: string;
  let pilotoId: number;
  let pasajeroId: number;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    token = await getAdminToken(app);

    // Create Piloto
    const resPiloto = await supertest(app.server)
      .post('/api/pilotos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nombre: 'Piloto Vuelo Test',
        email: `pilotovuelo-${Date.now()}@example.com`,
        telefono: '123456789',
        peso: 75,
        tieneLicencia: true
      });
    pilotoId = resPiloto.body.id;

    // Create Reserva and Pasajero
    const resReserva = await supertest(app.server)
      .post('/api/reservas')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nombreTitular: 'Titular Vuelo Test',
        email: `titularvuelo-${Date.now()}@example.com`,
        telefono: '987654321',
        estadoPago: 'PENDIENTE',
        valorTotal: 100000,
        abono: 0,
        fechaReserva: new Date().toISOString(),
        pasajeros: [
          {
            nombre: 'Pasajero Vuelo Test',
            peso: 70
          }
        ]
      });
    
    pasajeroId = resReserva.body.pasajeros[0].id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('debería registrar un vuelo', async () => {
    const res = await supertest(app.server)
      .post('/api/vuelos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fechaHora: new Date().toISOString(),
        valorPactado: 50000,
        estado: 'AGENDADO',
        pilotoId,
        pasajeroId
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.pilotoId).toBe(pilotoId);
    expect(res.body.pasajeroId).toBe(pasajeroId);
  });

  describe('Transiciones de estado (Fase 1)', () => {
    let vueloId: number;
    let versionActual: number;

    it('debería completar un vuelo AGENDADO → COMPLETADO', async () => {
      const resCreate = await supertest(app.server)
        .post('/api/vuelos')
        .set('Authorization', `Bearer ${token}`)
        .send({
          fechaHora: new Date(Date.now() + 3600_000).toISOString(),
          valorPactado: 50000,
          pilotoId,
          pasajeroId
        });
      expect(resCreate.status).toBe(201);
      vueloId = resCreate.body.id;
      versionActual = resCreate.body.version;

      const res = await supertest(app.server)
        .patch(`/api/vuelos/${vueloId}/estado`)
        .set('Authorization', `Bearer ${token}`)
        .send({ estado: 'COMPLETADO', version: versionActual });

      expect(res.status).toBe(200);
      expect(res.body.estado).toBe('COMPLETADO');
    });

    it('debería rechazar la transición inválida COMPLETADO → AGENDADO (400)', async () => {
      // El vuelo quedó COMPLETADO en el test anterior (estado terminal)
      const res = await supertest(app.server)
        .patch(`/api/vuelos/${vueloId}/estado`)
        .set('Authorization', `Bearer ${token}`)
        .send({ estado: 'AGENDADO' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Transición inválida');
      expect(res.body.message).toContain('COMPLETADO');
      expect(res.body.message).toContain('AGENDADO');
    });

    it('debería eliminar agenda de vuelo y revertir reserva a SIN_AGENDAR si no quedan vuelos', async () => {
      // Crear nueva reserva
      const resReserva = await supertest(app.server)
        .post('/api/reservas')
        .set('Authorization', `Bearer ${token}`)
        .send({
          nombreTitular: 'Titular Revert Test',
          email: `revert-${Date.now()}@example.com`,
          telefono: '987654321',
          estadoPago: 'PENDIENTE',
          valorTotal: 50000,
          abono: 0,
          fechaReserva: new Date().toISOString(),
          pasajeros: [{ nombre: 'Pasajero Revert', peso: 70 }]
        });
      const revReservaId = resReserva.body.id;
      const revPasajeroId = resReserva.body.pasajeros[0].id;

      // Crear vuelo (debe cambiar estado de reserva a AGENDADA)
      const resVuelo = await supertest(app.server)
        .post('/api/vuelos')
        .set('Authorization', `Bearer ${token}`)
        .send({
          fechaHora: new Date(Date.now() + 7200_000).toISOString(),
          valorPactado: 50000,
          pilotoId,
          pasajeroId: revPasajeroId
        });
      expect(resVuelo.status).toBe(201);
      const revVueloId = resVuelo.body.id;

      const checkAgendada = await supertest(app.server)
        .get(`/api/reservas/${revReservaId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(checkAgendada.body.estado).toBe('AGENDADA');

      // Eliminar el vuelo
      const resDel = await supertest(app.server)
        .delete(`/api/vuelos/${revVueloId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(resDel.status).toBe(200);

      // La reserva debe haber vuelto a SIN_AGENDAR
      const checkRevert = await supertest(app.server)
        .get(`/api/reservas/${revReservaId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(checkRevert.body.estado).toBe('SIN_AGENDAR');
    });
  });
});
