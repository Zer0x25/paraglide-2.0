import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { calendarPublicRoutes, calendarProtectedRoutes } from '../calendar.routes';
import { calendarService } from '../../services/calendar.service';
import { googleCalendarService } from '../../services/google-calendar.service';

// Mock prisma plugin
vi.mock('../../plugins/prisma', () => {
  // Store en memoria para la rotación de tokens de feed (hallazgo 2a).
  const rotaciones = new Map<string, { key: string; rotadoEn: Date }>();
  return {
    prisma: {
      vuelo: {
        findMany: vi.fn(),
      },
      piloto: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
      reserva: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
      },
      feedTokenRotacion: {
        findUnique: vi.fn(async ({ where }: { where: { key: string } }) => rotaciones.get(where.key) ?? null),
        upsert: vi.fn(
          async ({
            where,
            create,
            update,
          }: {
            where: { key: string };
            create: { key: string; rotadoEn: Date };
            update: { rotadoEn: Date };
          }) => {
            const existente = rotaciones.get(where.key);
            const fila = existente ? { ...existente, ...update } : { ...create };
            rotaciones.set(where.key, fila);
            return fila;
          }
        ),
      },
    },
  };
});

import { prisma } from '../../plugins/prisma';

describe('Calendar iCal Feed & Sync Routes (Unit Tests)', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify();
    await app.register(calendarPublicRoutes, { prefix: '/public/calendar' });
    await app.register(calendarProtectedRoutes, { prefix: '/calendar' });
    await app.ready();
  });

  it('GET /public/calendar/feed.ics - debe retornar 401 si no se envía token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/public/calendar/feed.ics',
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('Unauthorized');
  });

  it('GET /public/calendar/feed.ics - debe retornar 401 si el token es inválido', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/public/calendar/feed.ics?token=invalid.token123',
    });

    expect(response.statusCode).toBe(401);
  });

  it('GET /public/calendar/feed.ics - debe retornar VCALENDAR válido (200 OK) con token firmado', async () => {
    const { token: validToken } = await calendarService.generateFeedToken('all');

    (prisma.vuelo.findMany as any).mockResolvedValue([
      {
        id: 1,
        fechaHora: new Date('2026-08-20T15:00:00.000Z'),
        valorPactado: 60000,
        estado: 'AGENDADO',
        createdAt: new Date(),
        updatedAt: new Date(),
        piloto: { id: 1, nombre: 'Rodrigo Morales' },
        pasajero: {
          id: 1,
          nombre: 'Adela Ocampo',
          peso: 68,
          firmaDeslinde: true,
          reservaId: 10,
          reserva: { numeroReserva: '260820-0001', telefono: '+56912345678' },
        },
      },
    ]);

    const response = await app.inject({
      method: 'GET',
      url: `/public/calendar/feed.ics?token=${validToken}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/calendar');
    expect(response.headers['content-disposition']).toContain('parapente-vuelos.ics');
    
    // Verificar sintaxis iCalendar RFC 5545
    expect(response.body).toContain('BEGIN:VCALENDAR');
    expect(response.body).toContain('BEGIN:VEVENT');
    expect(response.body).toContain('Adela Ocampo');
    expect(response.body).toContain('Rodrigo Morales');
    expect(response.body).toContain('END:VEVENT');
    expect(response.body).toContain('END:VCALENDAR');
    expect(response.body).toContain('X-WR-CALNAME');
    expect(response.body).toContain('X-WR-TIMEZONE');
  });

  it('GET /public/calendar/reserva/:id.ics - debe retornar archivo .ics de la reserva', async () => {
    (prisma.reserva.findFirst as any).mockResolvedValue({
      id: 5,
      tokenPublico: 'tok-abc-48-hex',
      shortId: 'abc12345',
      numeroReserva: '260820-0005',
      nombreTitular: 'Carlos Santander',
      fechaReserva: new Date('2026-08-20T16:00:00.000Z'),
      pasajeros: [
        {
          id: 2,
          nombre: 'Carlos Santander Jr',
          vuelos: [
            {
              id: 8,
              fechaHora: new Date('2026-08-20T16:00:00.000Z'),
              estado: 'AGENDADO',
              piloto: { nombre: 'Camila Sepúlveda' },
            },
          ],
        },
      ],
    });

    const response = await app.inject({
      method: 'GET',
      url: '/public/calendar/reserva/tok-abc-48-hex.ics',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/calendar');
    expect(response.body).toContain('BEGIN:VCALENDAR');
    expect(response.body).toContain('Carlos Santander Jr');
    expect(response.body).toContain('Camila Sepúlveda');
    expect(response.body).toContain('X-WR-CALNAME');
    expect(response.body).toContain('X-WR-TIMEZONE');

    // Anti-enumeración: solo resuelve por tokenPublico/shortId (ADR 005).
    const where = (prisma.reserva.findFirst as any).mock.calls[0][0].where;
    expect(where.OR).toEqual([
      { tokenPublico: 'tok-abc-48-hex' },
      { shortId: 'tok-abc-48-hex' },
    ]);
    expect(where.OR.some((clause: any) => 'numeroReserva' in clause || 'id' in clause)).toBe(false);
  });

  it('GET /public/calendar/reserva/:id.ics - debe retornar 404 con identificador secuencial', async () => {
    (prisma.reserva.findFirst as any).mockResolvedValue(null);

    const response = await app.inject({
      method: 'GET',
      url: '/public/calendar/reserva/5.ics',
    });

    expect(response.statusCode).toBe(404);
  });

  it('GET /calendar/sync-info - debe devolver tokens e información de sincronización para admin y pilotos', async () => {
    (prisma.piloto.findMany as any).mockResolvedValue([
      { id: 1, nombre: 'Rodrigo Morales', categoria: 'MASTER' },
      { id: 2, nombre: 'Camila Sepúlveda', categoria: 'SENIOR' },
    ]);

    const response = await app.inject({
      method: 'GET',
      url: '/calendar/sync-info',
      headers: { host: 'localhost:3001' },
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.body);
    expect(data.universal).toBeDefined();
    expect(data.universal.expiraEn).toBeDefined();
    expect(data.universal.webcalUrl).toContain('webcal://');
    expect(data.universal.googleCalendarUrl).toContain('calendar.google.com');
    expect(data.pilotos.length).toBe(2);
    expect(data.pilotos[0].nombre).toBe('Rodrigo Morales');
    expect(data.pilotos[0].expiraEn).toBeDefined();
    expect(data.pilotos[0].webcalUrl).toContain('webcal://');
  });

  it('calendarService.generateFeed - debe respetar schoolName y timezone personalizados para feed general y piloto', async () => {
    (prisma.vuelo.findMany as any).mockResolvedValue([]);
    (prisma.piloto.findUnique as any).mockResolvedValue({ id: 1, nombre: 'Rodrigo Morales' });

    // Feed general
    const generalIcs = await calendarService.generateFeed({
      schoolName: 'Parapente Los Andes',
      timezone: 'America/Argentina/Mendoza',
    });
    expect(generalIcs).toContain('X-WR-CALNAME:Parapente Los Andes - Operaciones y Vuelos');
    expect(generalIcs).toContain('X-WR-TIMEZONE:America/Argentina/Mendoza');

    // Feed piloto
    const pilotoIcs = await calendarService.generateFeed({
      pilotoId: 1,
      schoolName: 'Parapente Los Andes',
      timezone: 'America/Argentina/Mendoza',
    });
    expect(pilotoIcs).toContain('X-WR-CALNAME:Parapente Los Andes - Vuelos de Rodrigo Morales');
    expect(pilotoIcs).toContain('X-WR-TIMEZONE:America/Argentina/Mendoza');
  });

  it('calendarService.generateReservaIcs - debe respetar schoolName y timezone personalizados', async () => {
    (prisma.reserva.findFirst as any).mockResolvedValue({
      id: 99,
      tokenPublico: 'tok-99-hex',
      shortId: 'short99x',
      numeroReserva: 'RES-99',
      nombreTitular: 'Ana Torres',
      fechaReserva: new Date('2026-08-20T16:00:00.000Z'),
      pasajeros: [],
    });

    const ics = await calendarService.generateReservaIcs('tok-99-hex', {
      schoolName: 'Parapente Los Andes',
      timezone: 'America/Argentina/Mendoza',
    });

    expect(ics).toContain('X-WR-CALNAME:Parapente Los Andes - Reserva #RES-99');
    expect(ics).toContain('X-WR-TIMEZONE:America/Argentina/Mendoza');
  });

  it('POST /calendar/reconcile - debe ejecutar la reconciliación y devolver resumen', async () => {
    vi.spyOn(googleCalendarService, 'isEnabled').mockReturnValue(true);
    vi.spyOn(googleCalendarService, 'reconcileVuelos').mockResolvedValue({
      total: 5,
      creados: 2,
      actualizados: 3,
      eliminados: 0,
      fallidos: 0,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/calendar/reconcile',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data.creados).toBe(2);
    expect(body.data.actualizados).toBe(3);
  });

  it('POST /calendar/reconcile - debe retornar 400 si Google Calendar no está habilitado', async () => {
    vi.spyOn(googleCalendarService, 'isEnabled').mockReturnValue(false);

    const response = await app.inject({
      method: 'POST',
      url: '/calendar/reconcile',
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
  });

  it('calendarService - la rotación invalida los tokens emitidos con la emisión anterior (2a)', async () => {
    const primero = await calendarService.generateFeedToken('piloto', 777);
    const segundo = await calendarService.regenerateFeedToken('piloto', 777);

    expect(segundo.token).not.toBe(primero.token);
    expect(segundo.expiraEn).toBeDefined();

    const verifPrimero = await calendarService.verifyFeedToken(primero.token);
    expect(verifPrimero.valid).toBe(false);
    expect(verifPrimero.motivo).toBe('ROTADO');

    const verifSegundo = await calendarService.verifyFeedToken(segundo.token);
    expect(verifSegundo.valid).toBe(true);
    expect(verifSegundo.payload?.pilotoId).toBe(777);
  });

  it('calendarService - los tokens expiran un año después de su emisión (2a)', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-01-01T12:00:00.000Z'));
      const { token, expiraEn } = await calendarService.generateFeedToken('piloto', 888);
      expect(new Date(expiraEn).toISOString()).toBe('2027-01-01T12:00:00.000Z');

      vi.setSystemTime(new Date('2027-01-01T11:59:00.000Z'));
      expect((await calendarService.verifyFeedToken(token)).valid).toBe(true);

      vi.setSystemTime(new Date('2027-01-01T12:00:01.000Z'));
      const vencido = await calendarService.verifyFeedToken(token);
      expect(vencido.valid).toBe(false);
      expect(vencido.motivo).toBe('EXPIRADO');
    } finally {
      vi.useRealTimers();
    }
  });

  it('POST /calendar/feed-token/regenerate - debe rotar el token e invalidar el anterior', async () => {
    const { token: anterior } = await calendarService.generateFeedToken('piloto', 778);
    (prisma.piloto.findUnique as any).mockResolvedValue({ id: 778, nombre: 'Piloto Prueba' });

    const response = await app.inject({
      method: 'POST',
      url: '/calendar/feed-token/regenerate',
      payload: { scope: 'piloto', pilotoId: 778 },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data.token).toBeDefined();
    expect(body.data.token).not.toBe(anterior);
    expect(body.data.expiraEn).toBeDefined();

    const verifAnterior = await calendarService.verifyFeedToken(anterior);
    expect(verifAnterior.valid).toBe(false);
    expect(verifAnterior.motivo).toBe('ROTADO');
    const verifNuevo = await calendarService.verifyFeedToken(body.data.token);
    expect(verifNuevo.valid).toBe(true);
  });

  it('POST /calendar/feed-token/regenerate - debe validar scope y existencia del piloto', async () => {
    const sinPiloto = await app.inject({
      method: 'POST',
      url: '/calendar/feed-token/regenerate',
      payload: { scope: 'piloto' },
    });
    expect(sinPiloto.statusCode).toBe(400);

    (prisma.piloto.findUnique as any).mockResolvedValue(null);
    const pilotoInexistente = await app.inject({
      method: 'POST',
      url: '/calendar/feed-token/regenerate',
      payload: { scope: 'piloto', pilotoId: 999 },
    });
    expect(pilotoInexistente.statusCode).toBe(404);
  });

  it('GET /public/calendar/feed.ics - debe retornar 401 con un token rotado (revocado)', async () => {
    const { token: anterior } = await calendarService.generateFeedToken('piloto', 779);
    await calendarService.regenerateFeedToken('piloto', 779);

    const response = await app.inject({
      method: 'GET',
      url: `/public/calendar/feed.ics?token=${encodeURIComponent(anterior)}`,
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.message).toContain('revocado');
  });
});
