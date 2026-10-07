import supertest from 'supertest';
import { buildApp } from '../src/app';
import { FastifyInstance } from 'fastify';
import { getAdminToken } from './helpers/test-auth';

describe('Public Self-Service API', () => {
  let app: FastifyInstance;
  let reservaId: number;
  let numeroReserva: string;
  let numeroPasajero: string;
  let reservaToken: string;
  let pasajeroToken: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    const token = await getAdminToken(app);

    // Crear una reserva de prueba
    const res = await supertest(app.server)
      .post('/api/reservas')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nombreTitular: 'Public User Test',
        telefono: '+56911223344',
        email: 'public@example.com',
        pasajeros: [
          {
            nombre: 'Pasajero Publico Uno',
            peso: 70,
          },
        ],
      });

    reservaId = res.body.id;
    numeroReserva = res.body.numeroReserva;
    numeroPasajero = res.body.pasajeros[0].numeroPasajero;
    // Vistas públicas: solo identificadores no secuenciales (ADR 005).
    reservaToken = res.body.tokenPublico || res.body.shortId;
    pasajeroToken = res.body.pasajeros[0].tokenPublico || res.body.pasajeros[0].shortId;
    expect(reservaToken).toBeTruthy();
    expect(pasajeroToken).toBeTruthy();
  });

  afterAll(async () => {
    await app.close();
  });

  it('debería consultar los datos de la reserva de forma pública con token', async () => {
    const res = await supertest(app.server)
      .get(`/api/public/reservas/${reservaToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(reservaId);
    expect(res.body.nombreTitular).toBe('Public User Test');
    expect(Array.isArray(res.body.pasajeros)).toBe(true);
    expect(res.body.pasajeros[0].nombre).toBe('Pasajero Publico Uno');
    expect(res.body.pasajeros[0].firmaDeslinde).toBe(false);
  });

  it('debería permitir a un pasajero firmar el deslinde públicamente con token', async () => {
    const res = await supertest(app.server)
      .post(`/api/public/pasajeros/${pasajeroToken}/firma`)
      .send({
        firmaBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        rutDni: '12.345.678-9',
        contactoEmergencia: 'Contacto Test',
        telefonoEmergencia: '+56999887766',
        condicionFisica: 'Excelente',
        pesoVerificado: 72,
      });

    expect(res.status).toBe(200);
    expect(res.body.pasajero.firmaDeslinde).toBe(true);
    expect(res.body.pasajero.firmaFecha).toBeDefined();
  });

  it('NO debería resolver la reserva por identificadores secuenciales (anti-enumeración)', async () => {
    const porNumeroReserva = await supertest(app.server)
      .get(`/api/public/reservas/${numeroReserva}`);
    expect(porNumeroReserva.status).toBe(404);

    const porIdNumerico = await supertest(app.server)
      .get(`/api/public/reservas/${reservaId}`);
    expect(porIdNumerico.status).toBe(404);
  });

  it('NO debería aceptar la firma de deslinde con numeroPasajero secuencial', async () => {
    const res = await supertest(app.server)
      .post(`/api/public/pasajeros/${numeroPasajero}/firma`)
      .send({
        firmaBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      });

    expect(res.status).toBe(404);
  });
});
