import supertest from 'supertest';
import { buildApp } from '../src/app';
import { FastifyInstance } from 'fastify';
import { getAdminToken } from './helpers/test-auth';

describe('Pilotos API', () => {
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

  let createdPilotoId: number;

  it('debería crear un nuevo piloto', async () => {
    const res = await supertest(app.server)
      .post('/api/pilotos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nombre: 'Piloto Test',
        email: `test-${Date.now()}@example.com`,
        telefono: '123456789',
        peso: 75,
        tieneLicencia: true
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.nombre).toBe('Piloto Test');
    
    createdPilotoId = res.body.id;
  });

  it('debería listar los pilotos', async () => {
    const res = await supertest(app.server)
      .get('/api/pilotos')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('pagination');
    expect(Array.isArray(res.body.data)).toBe(true);
    
    const piloto = res.body.data.find((p: any) => p.id === createdPilotoId);
    expect(piloto).toBeDefined();
    expect(piloto.nombre).toBe('Piloto Test');
  });

  it('debería actualizar el piloto', async () => {
    const res = await supertest(app.server)
      .patch(`/api/pilotos/${createdPilotoId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        nombre: 'Piloto Modificado'
      });

    expect(res.status).toBe(200);
    expect(res.body.nombre).toBe('Piloto Modificado');
  });
});
