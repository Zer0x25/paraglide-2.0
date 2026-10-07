import supertest from 'supertest';
import { FastifyInstance } from 'fastify';

/**
 * Obtiene un token JWT de ADMIN autenticando contra la API en tests de integración.
 * Es compatible con ADR 013 (Single-Session).
 */
export async function getAdminToken(app: FastifyInstance): Promise<string> {
  const res = await supertest(app.server)
    .post('/api/auth/login')
    .send({
      email: 'admin@parapente.com',
      password: 'admin123',
    });

  if (res.status !== 200 || !res.body.token) {
    throw new Error(`Error autenticando en test de integración: ${res.status} ${JSON.stringify(res.body)}`);
  }

  return res.body.token;
}

/**
 * Crea o autentica un usuario con rol RECEPCION para validar control de acceso RBAC.
 */
export async function getRecepcionToken(app: FastifyInstance, existingAdminToken?: string): Promise<string> {
  const adminToken = existingAdminToken || await getAdminToken(app);
  const email = `recepcion-${Date.now()}@parapente.com`;
  const password = 'recepcion123';

  await supertest(app.server)
    .post('/api/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      email,
      password,
      nombre: 'Recepcionista Test',
      role: 'RECEPCION',
    });

  const resLogin = await supertest(app.server)
    .post('/api/auth/login')
    .send({ email, password });

  if (resLogin.status !== 200 || !resLogin.body.token) {
    throw new Error(`Error autenticando recepcionista: ${resLogin.status} ${JSON.stringify(resLogin.body)}`);
  }

  return resLogin.body.token;
}
