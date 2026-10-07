import crypto from 'crypto';

/**
 * Tickets SSE de un solo uso y vida corta (hallazgo 2b).
 *
 * El navegador (EventSource) no permite enviar headers, por lo que la sesión
 * SSE se autenticaba con el JWT en la query string, filtrable por logs de
 * proxy/historial. Ahora el cliente autenticado canjea su JWT por un ticket
 * aleatorio de un solo uso (`POST /api/eventos/ticket`) y lo consume al abrir
 * el stream (`GET /api/eventos?ticket=...`): el JWT nunca viaja en la URL.
 *
 * Estado en memoria: la API corre como instancia única (docker compose); un
 * reinicio simplemente invalida los tickets pendientes y el cliente solicita
 * uno nuevo en su reconexión. Si algún día se escala a varias instancias,
 * este mapa debe moverse a un almacén compartido (p. ej. Redis o la DB).
 */

export const SSE_TICKET_TTL_MS = 5 * 60 * 1000; // 5 minutos

interface SseTicketRecord {
  userId: number;
  expiraEn: number;
}

const tickets = new Map<string, SseTicketRecord>();

function limpiarExpirados(): void {
  const ahora = Date.now();
  for (const [clave, registro] of tickets) {
    if (registro.expiraEn <= ahora) tickets.delete(clave);
  }
}

/** Emite un ticket de un solo uso para abrir una sesión SSE. */
export function emitirSseTicket(userId: number): { ticket: string; expiraEn: string } {
  limpiarExpirados();
  const ticket = crypto.randomBytes(24).toString('base64url');
  const expiraEn = Date.now() + SSE_TICKET_TTL_MS;
  tickets.set(ticket, { userId, expiraEn });
  return { ticket, expiraEn: new Date(expiraEn).toISOString() };
}

/**
 * Consume un ticket (un solo uso): se elimina incluso si resultó estar
 * expirado, de modo que nunca pueda reutilizarse.
 */
export function consumirSseTicket(
  ticket: string
): { ok: true; userId: number } | { ok: false; motivo: 'INVALIDO' | 'EXPIRADO' } {
  const registro = typeof ticket === 'string' && ticket.length > 0 ? tickets.get(ticket) : undefined;
  if (!registro) return { ok: false, motivo: 'INVALIDO' };

  tickets.delete(ticket);
  if (registro.expiraEn <= Date.now()) return { ok: false, motivo: 'EXPIRADO' };
  return { ok: true, userId: registro.userId };
}
