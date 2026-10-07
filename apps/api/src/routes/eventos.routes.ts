import { FastifyPluginAsync } from 'fastify';
import { subscribe } from '../services/eventos.service';
import { consumirSseTicket, emitirSseTicket } from '../services/sse-tickets.service';
import type { SSEEvent } from '@parapente/shared';

const HEARTBEAT_INTERVAL_MS = 30_000;

const eventosRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * Emisión de tickets SSE de un solo uso (vida corta) — hallazgo 2b.
   * Se autentica con el flujo normal (Bearer / API key); el ticket sustituye
   * al JWT en la query string de la conexión SSE.
   * POST /api/eventos/ticket
   */
  fastify.post('/eventos/ticket', { onRequest: fastify.authenticate }, async (request, reply) => {
    const { ticket, expiraEn } = emitirSseTicket(request.user.id);
    return reply.send({ ticket, expiraEn });
  });

  /**
   * Stream SSE — el ticket se consume una sola vez al abrir la sesión.
   * GET /api/eventos?ticket=...
   */
  fastify.get('/eventos', async (request, reply) => {
    const ticket = (request.query as { ticket?: string }).ticket;
    const resultado = ticket
      ? consumirSseTicket(ticket)
      : ({ ok: false, motivo: 'INVALIDO' } as const);

    if (!resultado.ok) {
      const message =
        resultado.motivo === 'EXPIRADO'
          ? 'El ticket SSE expiró. Solicita uno nuevo.'
          : 'Ticket SSE inválido o ya utilizado.';
      return reply.code(401).send({ error: 'No autorizado', message });
    }

    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    reply.raw.write(`retry: 3000\n\n`);

    const unsubscribe = subscribe((event: SSEEvent) => {
      reply.raw.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    });

    // Heartbeat — prevents proxies/LBs from cutting idle connections.
    const heartbeat = setInterval(() => {
      reply.raw.write(`:heartbeat\n\n`);
    }, HEARTBEAT_INTERVAL_MS);

    request.raw.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });
};

export default eventosRoutes;
