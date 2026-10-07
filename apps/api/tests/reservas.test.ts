import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { buildApp } from '../src/app';
import { FastifyInstance } from 'fastify';
import { getAdminToken } from './helpers/test-auth';

describe('Reservas API', () => {
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

  let createdReservaId: number;

  it('debería crear una nueva reserva con pasajero', async () => {
    const res = await apiReq('post', '/api/reservas')
      .send({
        nombreTitular: 'Titular Test',
        email: `titular-${Date.now()}@example.com`,
        telefono: '987654321',
        estadoPago: 'PENDIENTE',
        valorTotal: 100000,
        abono: 0,
        fechaReserva: new Date().toISOString(),
        pasajeros: [
          {
            nombre: 'Pasajero Test',
            peso: 70
          }
        ]
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.nombreTitular).toBe('Titular Test');
    
    createdReservaId = res.body.id;
  });

  it('debería listar las reservas paginadas con envelope { data, pagination }', async () => {
    const res = await apiReq('get', '/api/reservas?pageSize=20&page=1');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('pagination');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toMatchObject({
      page: 1,
      pageSize: 20,
    });
    expect(typeof res.body.pagination.total).toBe('number');
    expect(typeof res.body.pagination.totalPages).toBe('number');
    expect(typeof res.body.pagination.hasMore).toBe('boolean');

    const reserva = res.body.data.find((r: any) => r.id === createdReservaId);
    expect(reserva).toBeDefined();
    expect(reserva.nombreTitular).toBe('Titular Test');
  });

  describe('Ordenamiento por fecha más pronta y reservas sin fecha (nulls last)', () => {
    let idReservaLejana: number;
    let idReservaCercana: number;
    let idReservaSinFecha: number;

    beforeAll(async () => {
      const hoy = Date.now();
      const fechaLejana = new Date(hoy + 10 * 24 * 60 * 60 * 1000).toISOString(); // +10 días
      const fechaCercana = new Date(hoy + 2 * 24 * 60 * 60 * 1000).toISOString();  // +2 días

      const resLejana = await apiReq('post', '/api/reservas')
        .send({
          nombreTitular: 'Reserva Lejana (+10d)',
          email: `lejana-${Date.now()}@example.com`,
          telefono: '911111111',
          valorTotal: 80000,
          abono: 0,
          fechaAgenda: fechaLejana,
          pasajeros: [{ nombre: 'Pasajero Lejano', peso: 75 }],
        });
      idReservaLejana = resLejana.body.id;

      const resCercana = await apiReq('post', '/api/reservas')
        .send({
          nombreTitular: 'Reserva Cercana (+2d)',
          email: `cercana-${Date.now()}@example.com`,
          telefono: '922222222',
          valorTotal: 80000,
          abono: 0,
          fechaAgenda: fechaCercana,
          pasajeros: [{ nombre: 'Pasajero Cercano', peso: 70 }],
        });
      idReservaCercana = resCercana.body.id;

      const resSinFecha = await apiReq('post', '/api/reservas')
        .send({
          nombreTitular: 'Reserva Sin Fecha (Giftcard)',
          email: `sinfecha-${Date.now()}@example.com`,
          telefono: '933333333',
          valorTotal: 80000,
          abono: 0,
          esGiftCard: true,
          fechaAgenda: null,
          pasajeros: [{ nombre: 'Pasajero Sin Fecha', peso: 65 }],
        });
      idReservaSinFecha = resSinFecha.body.id;
    });

    it('debería ordenar por fechaAgenda.asc con la más pronta primero y nulls al final al consultar pestaña PROXIMAS', async () => {
      const desde = new Date(Date.now() - 60000).toISOString();
      const res = await apiReq('get', `/api/reservas?desde=${encodeURIComponent(desde)}&sort=fechaAgenda.asc&pageSize=200`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      const data = res.body.data;

      const idxCercana = data.findIndex((r: any) => r.id === idReservaCercana);
      const idxLejana = data.findIndex((r: any) => r.id === idReservaLejana);
      const idxSinFecha = data.findIndex((r: any) => r.id === idReservaSinFecha);

      expect(idxCercana).toBeGreaterThanOrEqual(0);
      expect(idxLejana).toBeGreaterThanOrEqual(0);
      expect(idxSinFecha).toBeGreaterThanOrEqual(0);

      // La más pronta (+2d) va antes que la lejana (+10d)
      expect(idxCercana).toBeLessThan(idxLejana);
      // La reserva sin fecha va después de las que tienen fecha establecida
      expect(idxLejana).toBeLessThan(idxSinFecha);
    });

    it('debería soportar paginación con pageSize=20 y calcular totalPages y hasMore adecuadamente', async () => {
      const res = await apiReq('get', '/api/reservas?pageSize=20&page=1');

      expect(res.status).toBe(200);
      expect(res.body.pagination.pageSize).toBe(20);
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(3);
      expect(res.body.data.length).toBeLessThanOrEqual(20);
    });
  });

  describe('Cancelar reserva (Fase 1)', () => {
    let reservaId: number;
    let versionActual: number;

    beforeAll(async () => {
      const res = await apiReq('post', '/api/reservas')
        .send({
          nombreTitular: 'Titular Cancelable',
          email: `cancelable-${Date.now()}@example.com`,
          telefono: '987654321',
          valorTotal: 100000,
          abono: 0,
          fechaReserva: new Date().toISOString(),
          pasajeros: [{ nombre: 'Pasajero Cancelable', peso: 70 }],
        });
      reservaId = res.body.id;
      versionActual = res.body.version;
    });

    it('debería cancelar la reserva con motivo y devolver estado CANCELADA', async () => {
      const res = await apiReq('post', `/api/reservas/${reservaId}/cancelar`)
        .send({ motivo: 'Clima adverso', version: versionActual });

      expect(res.status).toBe(200);
      expect(res.body.estado).toBe('CANCELADA');
      expect(res.body.motivoCancelacion).toBe('Clima adverso');
      expect(res.body.fechaCancelacion).toBeDefined();
    });

    it('debería rechazar la cancelación sin motivo (400)', async () => {
      const res = await apiReq('post', `/api/reservas/${reservaId}/cancelar`)
        .send({ version: versionActual + 1 });

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toContain('El motivo de cancelación es obligatorio');
    });

    it('debería rechazar la cancelación con versión stale (409)', async () => {
      const res = await apiReq('post', '/api/reservas')
        .send({
          nombreTitular: 'Titular Stale',
          email: `stale-${Date.now()}@example.com`,
          valorTotal: 50000,
          abono: 0,
          pasajeros: [{ nombre: 'Pasajero Stale', peso: 70 }],
        });
      const idStale = res.body.id;

      const cancel = await apiReq('post', `/api/reservas/${idStale}/cancelar`)
        .send({ motivo: 'Intento con versión vieja', version: 999 });

      expect(cancel.status).toBe(409);
      expect(cancel.body.message).toContain('cambió en otro dispositivo');
    });
  });

  describe('Actualizar estado de vuelo de pasajeros', () => {
    let reservaId: number;
    let versionActual: number;
    let pasajeroId: number;

    beforeAll(async () => {
      const res = await apiReq('post', '/api/reservas')
        .send({
          nombreTitular: 'Titular Estado Pasajeros',
          email: `estado-pasajeros-${Date.now()}@example.com`,
          telefono: '987654321',
          valorTotal: 0,
          abono: 0,
          fechaReserva: new Date().toISOString(),
          pasajeros: [{ nombre: 'Pasajero Estado', peso: 70 }],
        });
      reservaId = res.body.id;
      versionActual = res.body.version;
      pasajeroId = res.body.pasajeros[0].id;
    });

    it('debería marcar a un pasajero como VUELO_COMPLETADO y devolver la reserva actualizada', async () => {
      const res = await apiReq('put', `/api/reservas/${reservaId}/estado-pasajeros`)
        .send({
          version: versionActual,
          pasajeros: [{ id: pasajeroId, estado: 'VUELO_COMPLETADO' }],
        });

      expect(res.status).toBe(200);
      expect(res.body.version).toBe(versionActual + 1);
      const pasajero = res.body.pasajeros.find((p: any) => p.id === pasajeroId);
      expect(pasajero).toBeDefined();
      expect(pasajero.estado).toBe('VUELO_COMPLETADO');
    });

    it('debería rechazar el request sin pasajeros (400)', async () => {
      const res = await apiReq('put', `/api/reservas/${reservaId}/estado-pasajeros`)
        .send({ version: versionActual + 1, pasajeros: [] });

      expect(res.status).toBe(400);
    });

    it('debería rechazar un estado inválido (400)', async () => {
      const res = await apiReq('put', `/api/reservas/${reservaId}/estado-pasajeros`)
        .send({
          version: versionActual + 1,
          pasajeros: [{ id: pasajeroId, estado: 'NO_EXISTE' }],
        });

      expect(res.status).toBe(400);
    });

    it('debería rechazar con 404 si la reserva no existe', async () => {
      const res = await apiReq('put', '/api/reservas/999999999/estado-pasajeros')
        .send({
          version: 1,
          pasajeros: [{ id: pasajeroId, estado: 'VUELO_COMPLETADO' }],
        });

      expect(res.status).toBe(404);
      expect(res.body.message).toContain('no encontrada');
    });

    it('debería rechazar con versión stale (409)', async () => {
      const freshRes = await apiReq('post', '/api/reservas')
        .send({
          nombreTitular: 'Titular Stale Pasajeros',
          email: `stale-pax-${Date.now()}@example.com`,
          valorTotal: 100000,
          abono: 0,
          fechaReserva: new Date().toISOString(),
          pasajeros: [{ nombre: 'Pax 1', peso: 70 }, { nombre: 'Pax 2', peso: 70 }],
        });
      const idStale = freshRes.body.id;
      const paxId = freshRes.body.pasajeros[0].id;

      const res = await apiReq('put', `/api/reservas/${idStale}/estado-pasajeros`)
        .send({
          version: 999,
          pasajeros: [{ id: paxId, estado: 'VUELO_COMPLETADO' }],
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('cambió en otro dispositivo');
    });

    it('debería rechazar con 400 si el pasajero no pertenece a la reserva', async () => {
      const freshRes = await apiReq('post', '/api/reservas')
        .send({
          nombreTitular: 'Titular Otro Pax',
          email: `otro-pax-${Date.now()}@example.com`,
          valorTotal: 100000,
          abono: 0,
          fechaReserva: new Date().toISOString(),
          pasajeros: [{ nombre: 'Pax 1', peso: 70 }, { nombre: 'Pax 2', peso: 70 }],
        });
      const idFresh = freshRes.body.id;
      const versionFresh = freshRes.body.version;

      const res = await apiReq('put', `/api/reservas/${idFresh}/estado-pasajeros`)
        .send({
          version: versionFresh,
          pasajeros: [{ id: 999999999, estado: 'VUELO_COMPLETADO' }],
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('no pertenecen a la reserva');
    });
  });

  describe('Edición de reserva sin importes derivados (punto 3)', () => {
    it('debería rechazar con 400 si la edición trae abono explícito', async () => {
      const freshRes = await apiReq('post', '/api/reservas')
        .send({
          nombreTitular: 'Titular Abono Prohibido',
          email: `abono-prohibido-${Date.now()}@example.com`,
          valorTotal: 100000,
          abono: 0,
          fechaReserva: new Date().toISOString(),
          pasajeros: [{ nombre: 'Pax 1', peso: 70 }],
        });

      const res = await apiReq('patch', `/api/reservas/${freshRes.body.id}`)
        .send({ nombreTitular: 'Titular Abono Prohibido v2', abono: 50000 });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('no se editan directamente');
    });

    it('debería rechazar con 400 si la edición trae montoDevuelto explícito', async () => {
      const freshRes = await apiReq('post', '/api/reservas')
        .send({
          nombreTitular: 'Titular Devuelto Prohibido',
          email: `devuelto-prohibido-${Date.now()}@example.com`,
          valorTotal: 100000,
          abono: 0,
          fechaReserva: new Date().toISOString(),
          pasajeros: [{ nombre: 'Pax 1', peso: 70 }],
        });

      const res = await apiReq('patch', `/api/reservas/${freshRes.body.id}`)
        .send({ montoDevuelto: 1000 });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('no se editan directamente');
    });

    it('debería mantener abono == suma(pagos) y re-derivar estadoPago al editar valorTotal', async () => {
      const freshRes = await apiReq('post', '/api/reservas')
        .send({
          nombreTitular: 'Titular Invariante',
          email: `invariante-${Date.now()}@example.com`,
          valorTotal: 100000,
          abono: 30000,
          fechaReserva: new Date().toISOString(),
          pasajeros: [{ nombre: 'Pax 1', peso: 70 }],
        });
      expect(freshRes.status).toBe(201);
      expect(freshRes.body.abono).toBe(30000);
      expect(freshRes.body.estadoPago).toBe('ABONADO');

      // Baja el total por debajo del abono pagado → el estado se re-deriva a PAGADO
      // y el abono NO cambia (sigue siendo la suma de los pagos activos).
      const res = await apiReq('patch', `/api/reservas/${freshRes.body.id}`)
        .send({ valorTotal: 25000 });

      expect(res.status).toBe(200);
      expect(res.body.abono).toBe(30000);
      expect(res.body.estadoPago).toBe('PAGADO');
    });
  });
});
