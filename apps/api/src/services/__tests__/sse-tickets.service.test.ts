import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  emitirSseTicket,
  consumirSseTicket,
  SSE_TICKET_TTL_MS,
} from '../sse-tickets.service';

describe('sse-tickets.service — tickets SSE de un solo uso (hallazgo 2b)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('emite un ticket que se puede consumir una sola vez', () => {
    const { ticket, expiraEn } = emitirSseTicket(42);

    expect(ticket).toBeTruthy();
    expect(new Date(expiraEn).getTime()).toBeGreaterThan(Date.now());

    const primero = consumirSseTicket(ticket);
    expect(primero).toEqual({ ok: true, userId: 42 });

    // Un solo uso: el segundo intento falla.
    const segundo = consumirSseTicket(ticket);
    expect(segundo).toEqual({ ok: false, motivo: 'INVALIDO' });
  });

  it('cada emisión produce un ticket distinto', () => {
    const a = emitirSseTicket(1).ticket;
    const b = emitirSseTicket(1).ticket;
    expect(a).not.toBe(b);
  });

  it('rechaza tickets desconocidos o vacíos', () => {
    expect(consumirSseTicket('no-existe')).toEqual({ ok: false, motivo: 'INVALIDO' });
    expect(consumirSseTicket('')).toEqual({ ok: false, motivo: 'INVALIDO' });
  });

  it('rechaza tickets expirados y los consume igualmente (no reutilizables)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T12:00:00.000Z'));

    const { ticket } = emitirSseTicket(7);
    vi.setSystemTime(new Date(Date.now() + SSE_TICKET_TTL_MS + 1));

    expect(consumirSseTicket(ticket)).toEqual({ ok: false, motivo: 'EXPIRADO' });
    // Incluso tras el rechazo por expiración queda consumido.
    expect(consumirSseTicket(ticket)).toEqual({ ok: false, motivo: 'INVALIDO' });
  });

  it('un ticket caducado no se recicla al emitir nuevos tickets', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T12:00:00.000Z'));

    const { ticket: caducado } = emitirSseTicket(7);
    vi.setSystemTime(new Date(Date.now() + SSE_TICKET_TTL_MS + 1));
    emitirSseTicket(7); // esta emisión limpia los expirados del mapa

    expect(consumirSseTicket(caducado)).toEqual({ ok: false, motivo: 'INVALIDO' });
  });
});
