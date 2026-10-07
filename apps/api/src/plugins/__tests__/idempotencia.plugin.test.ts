import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';

/**
 * Tests unitarios del plugin de idempotencia del outbox offline (ADR 009).
 *
 * Patrón de la suite (unitario): Prisma mockeado y app mínima con una ruta
 * ficticia POST/DELETE. El plugin real se registra sobre la mini-app con
 * `prisma` decorado (mockeado) y un hook que simula al usuario autenticado,
 * igual que hace el scope protegido de `app.ts` en la app completa.
 */
vi.mock('../../plugins/prisma', () => ({
  prisma: {
    idempotencia: {
      findUnique: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import { prisma } from '../../plugins/prisma';
import idempotenciaPlugin from '../idempotencia.plugin';

const idempotencia = prisma.idempotencia;

/** ClientId válido: uuid v4 (formato que genera crypto.randomUUID()). */
const CLIENT_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const USUARIO_ID = 1;

function buildApp(): FastifyInstance {
  const app = Fastify();
  // Decorar prisma ANTES de registrar el plugin (el plugin lee app.prisma).
  app.decorate('prisma', prisma);
  // Simular authenticate: el plugin exige request.user.id numérico.
  app.addHook('onRequest', async (request) => {
    request.user = { id: USUARIO_ID, role: 'ADMIN' } as never;
  });

  let contador = 0;
  app.post('/cosa', async () => ({ ok: true, n: ++contador }));
  app.delete('/cosa/:id', async (_request, reply) => {
    void _request;
    return reply.status(204).send();
  });
  app.get('/cosa', async () => ({ ok: true, n: 99 }));

  return app;
}

async function buildReadyApp(): Promise<FastifyInstance> {
  const app = buildApp();
  await app.register(idempotenciaPlugin);
  await app.ready();
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Idempotencia plugin — dedupe por X-Client-Id (ADR 009)', () => {
  it('POST sin header X-Client-Id ejecuta el handler ambas veces y no guarda nada', async () => {
    const app = await buildReadyApp();
    (idempotencia.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (idempotencia.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const r1 = await app.inject({ method: 'POST', url: '/cosa' });
    const r2 = await app.inject({ method: 'POST', url: '/cosa' });

    expect(r1.statusCode).toBe(200);
    expect(r2.statusCode).toBe(200);
    expect(r1.json()).toEqual({ ok: true, n: 1 });
    expect(r2.json()).toEqual({ ok: true, n: 2 });
    expect(idempotencia.findUnique).not.toHaveBeenCalled();
    expect(idempotencia.create).not.toHaveBeenCalled();
    await app.close();
  });

  it('POST con X-Client-Id válido la primera vez ejecuta el handler y guarda la respuesta', async () => {
    const app = await buildReadyApp();
    (idempotencia.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (idempotencia.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const res = await app.inject({
      method: 'POST',
      url: '/cosa',
      headers: { 'x-client-id': CLIENT_ID },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, n: 1 });
    expect(idempotencia.create).toHaveBeenCalledTimes(1);
    expect(idempotencia.create).toHaveBeenCalledWith({
      data: {
        clientId: CLIENT_ID,
        metodo: 'POST',
        url: '/cosa',
        usuarioId: USUARIO_ID,
        statusCode: 200,
        respuesta: { ok: true, n: 1 },
      },
    });
    // La lookup usa la clave compuesta clientId+metodo+url.
    expect(idempotencia.findUnique).toHaveBeenCalledWith({
      where: {
        clientId_metodo_url: { clientId: CLIENT_ID, metodo: 'POST', url: '/cosa' },
      },
    });
    await app.close();
  });

  it('segunda petición con el MISMO X-Client-Id devuelve la respuesta almacenada sin re-ejecutar', async () => {
    const app = await buildReadyApp();
    // Replay: findUnique encuentra el registro guardado previamente.
    (idempotencia.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      clientId: CLIENT_ID,
      metodo: 'POST',
      url: '/cosa',
      usuarioId: USUARIO_ID,
      statusCode: 201,
      respuesta: { ok: true, n: 7 },
      createdAt: new Date(),
    });
    (idempotencia.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const res = await app.inject({
      method: 'POST',
      url: '/cosa',
      headers: { 'x-client-id': CLIENT_ID },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ ok: true, n: 7 });
    expect(idempotencia.create).not.toHaveBeenCalled();
    await app.close();
  });

  it('la respuesta cacheada de OTRO usuario no se devuelve (clave incluye usuarioId)', async () => {
    const app = await buildReadyApp();
    (idempotencia.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      clientId: CLIENT_ID,
      metodo: 'POST',
      url: '/cosa',
      usuarioId: 999, // registro de otro usuario
      statusCode: 201,
      respuesta: { ok: true, n: 42 },
      createdAt: new Date(),
    });
    (idempotencia.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const res = await app.inject({
      method: 'POST',
      url: '/cosa',
      headers: { 'x-client-id': CLIENT_ID },
    });

    // Se ejecuta el handler normal (n=1), nunca la respuesta ajena.
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, n: 1 });
    await app.close();
  });

  it('mismo X-Client-Id con distinta URL/metodo NO reutiliza la respuesta (clave compuesta)', async () => {
    const app = await buildReadyApp();
    // La lookup por clave compuesta no encuentra nada para esta URL.
    (idempotencia.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (idempotencia.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const res = await app.inject({
      method: 'POST',
      url: '/otra',
      headers: { 'x-client-id': CLIENT_ID },
    });

    // Ruta /otra no existe → 404, pero lo importante es que findUnique fue
    // consultado con la URL de ESTA petición, no con la almacenada (/cosa).
    expect(res.statusCode).toBe(404);
    expect(idempotencia.findUnique).toHaveBeenCalledWith({
      where: {
        clientId_metodo_url: { clientId: CLIENT_ID, metodo: 'POST', url: '/otra' },
      },
    });
    await app.close();
  });

  it('DELETE reenviado con X-Client-Id ya visto devuelve el 204 almacenado (sin 409 espurio)', async () => {
    const app = await buildReadyApp();
    (idempotencia.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      clientId: CLIENT_ID,
      metodo: 'DELETE',
      url: '/cosa/1',
      usuarioId: USUARIO_ID,
      statusCode: 204,
      respuesta: {},
      createdAt: new Date(),
    });
    (idempotencia.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const res = await app.inject({
      method: 'DELETE',
      url: '/cosa/1',
      headers: { 'x-client-id': CLIENT_ID },
    });

    // La ruta de prueba respondería 404 si se ejecutara; el replay devuelve
    // el 204 original sin tocar el handler.
    expect(res.statusCode).toBe(204);
    expect(res.body).toBe('');
    await app.close();
  });

  it('DELETE 204 (body vacío) la primera vez SÍ guarda el registro para el replay', async () => {
    const app = await buildReadyApp();
    (idempotencia.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (idempotencia.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

    // Regresión: un 204 no tiene body; antes del fix el onSend descartaba
    // el payload vacío y NUNCA guardaba → el replay re-ejecutaba y daba 409/500.
    const res = await app.inject({
      method: 'DELETE',
      url: '/cosa/1',
      headers: { 'x-client-id': CLIENT_ID },
    });

    expect(res.statusCode).toBe(204);
    expect(idempotencia.create).toHaveBeenCalledTimes(1);
    expect(idempotencia.create).toHaveBeenCalledWith({
      data: {
        clientId: CLIENT_ID,
        metodo: 'DELETE',
        url: '/cosa/1',
        usuarioId: USUARIO_ID,
        statusCode: 204,
        respuesta: {},
      },
    });
    await app.close();
  });

  it('respuesta no-2xx NO se guarda como idempotente', async () => {
    const app = await buildReadyApp();
    (idempotencia.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (idempotencia.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

    // POST a ruta inexistente → 404 (no-2xx).
    await app.inject({
      method: 'POST',
      url: '/inexistente',
      headers: { 'x-client-id': CLIENT_ID },
    });

    expect(idempotencia.create).not.toHaveBeenCalled();
    await app.close();
  });

  it('GET con X-Client-Id nunca se deduplica ni se guarda', async () => {
    const app = await buildReadyApp();
    (idempotencia.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (idempotencia.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const res = await app.inject({
      method: 'GET',
      url: '/cosa',
      headers: { 'x-client-id': CLIENT_ID },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, n: 99 });
    expect(idempotencia.findUnique).not.toHaveBeenCalled();
    expect(idempotencia.create).not.toHaveBeenCalled();
    await app.close();
  });

  it('header sin formato uuid se ignora: handler ejecuta y no se guarda', async () => {
    const app = await buildReadyApp();
    (idempotencia.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (idempotencia.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const res = await app.inject({
      method: 'POST',
      url: '/cosa',
      headers: { 'x-client-id': 'corto' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, n: 1 });
    expect(idempotencia.findUnique).not.toHaveBeenCalled();
    expect(idempotencia.create).not.toHaveBeenCalled();
    await app.close();
  });

  it('findUnique rechaza (tabla inexistente aún) y la petición sigue normal', async () => {
    const app = await buildReadyApp();
    (idempotencia.findUnique as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('La tabla Idempotencia no existe'),
    );
    (idempotencia.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const res = await app.inject({
      method: 'POST',
      url: '/cosa',
      headers: { 'x-client-id': CLIENT_ID },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, n: 1 });
    await app.close();
  });
});
