import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import eventosRoutes from '../eventos.routes';

/**
 * Tests de las rutas SSE con tickets de un solo uso (hallazgo 2b).
 * `authenticate` se simula con un stub, igual que hace el scope protegido de
 * `app.ts` en la app completa.
 */
function crearApp(autenticado = true): FastifyInstance {
  // forceCloseConnections: destruye los sockets keep-alive al cerrar (el test
  // de stream usa fetch real y no debe dejar conexiones colgadas).
  const app = Fastify({ forceCloseConnections: true });
  app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!autenticado) {
      reply.code(401).send({ error: 'No autorizado' });
      return;
    }
    (request as { user?: unknown }).user = { id: 42, role: 'ADMIN' };
  });
  return app;
}

async function crearAppLista(autenticado = true): Promise<FastifyInstance> {
  const app = crearApp(autenticado);
  await app.register(eventosRoutes, { prefix: '/api' });
  await app.ready();
  return app;
}

describe('eventos.routes — tickets SSE de un solo uso (2b)', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await crearAppLista();
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST /api/eventos/ticket - emite un ticket con expiración', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/eventos/ticket',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.ticket).toBeTruthy();
    expect(typeof body.ticket).toBe('string');
    expect(new Date(body.expiraEn).getTime()).toBeGreaterThan(Date.now());
  });

  it('POST /api/eventos/ticket - rechaza peticiones no autenticadas', async () => {
    const appSinAuth = await crearAppLista(false);
    try {
      const response = await appSinAuth.inject({
        method: 'POST',
        url: '/api/eventos/ticket',
      });
      expect(response.statusCode).toBe(401);
    } finally {
      await appSinAuth.close();
    }
  });

  it('GET /api/eventos - retorna 401 sin ticket', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/eventos' });
    expect(response.statusCode).toBe(401);
  });

  it('GET /api/eventos - retorna 401 con ticket desconocido', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/eventos?ticket=falso-123',
    });
    expect(response.statusCode).toBe(401);
  });

  it('GET /api/eventos - el ticket abre el stream y no puede reutilizarse', async () => {
    await app.listen({ port: 0, host: '127.0.0.1' });
    const address = app.server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const base = `http://127.0.0.1:${port}`;

    // 1) Canje del ticket (autenticado)
    const ticketRes = await fetch(`${base}/api/eventos/ticket`, { method: 'POST' });
    expect(ticketRes.status).toBe(200);
    const { ticket } = (await ticketRes.json()) as { ticket: string };
    expect(ticket).toBeTruthy();

    // 2) El ticket abre la sesión SSE
    const controller = new AbortController();
    const streamRes = await fetch(`${base}/api/eventos?ticket=${encodeURIComponent(ticket)}`, {
      signal: controller.signal,
      headers: { Accept: 'text/event-stream' },
    });
    expect(streamRes.status).toBe(200);
    expect(streamRes.headers.get('content-type')).toContain('text/event-stream');

    const reader = streamRes.body!.getReader();
    const { value } = await reader.read();
    expect(new TextDecoder().decode(value)).toContain('retry: 3000');
    await reader.cancel();

    // 3) El mismo ticket ya fue consumido: no reutilizable
    const reuseRes = await fetch(`${base}/api/eventos?ticket=${encodeURIComponent(ticket)}`);
    expect(reuseRes.status).toBe(401);
  });
});
