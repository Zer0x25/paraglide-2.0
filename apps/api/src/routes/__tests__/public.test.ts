import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import publicRoutes, { APP_VERSION } from '../public.routes';

// Mock prisma plugin
vi.mock('../../plugins/prisma', () => {
  const mockDeslindeFirma = {
    upsert: vi.fn().mockResolvedValue({}),
  };
  const mockPasajero = {
    findFirst: vi.fn(),
    update: vi.fn(),
  };

  return {
    prisma: {
      $transaction: vi.fn(async (callbackOrList: any) => {
        if (typeof callbackOrList === 'function') {
          return callbackOrList({
            deslindeFirma: mockDeslindeFirma,
            pasajero: mockPasajero,
          });
        }
        return callbackOrList;
      }),
      reserva: {
        findFirst: vi.fn(),
      },
      pasajero: mockPasajero,
      deslindeFirma: mockDeslindeFirma,
      pantallaToken: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      condicionPista: {
        findFirst: vi.fn(),
      },
      vuelo: {
        findMany: vi.fn(),
      },
    },
  };
});

import { prisma } from '../../plugins/prisma';

describe('Public Self-Service Routes (Unit Tests)', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify();
    await app.register(publicRoutes);
    await app.ready();
  });

  it('GET /reservas/:id - debería retornar los datos públicos de la reserva', async () => {
    (prisma.reserva.findFirst as any).mockResolvedValue({
      id: 123,
      tokenPublico: 'token-abc-48-hex',
      shortId: 'abc12345',
      numeroReserva: '260814-0001',
      nombreTitular: 'Juan Pérez',
      fechaAgenda: new Date('2026-08-20T10:00:00Z'),
      estadoPago: 'PAGADO',
      pasajeros: [
        {
          id: 1,
          nombre: 'Juan Pérez',
          rutDni: '12.345.678-9',
          firmaDeslinde: false,
        },
      ],
    });

    const response = await app.inject({
      method: 'GET',
      url: '/reservas/token-abc-48-hex',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.id).toBe(123);
    expect(body.nombreTitular).toBe('Juan Pérez');
    expect(body.pasajeros.length).toBe(1);

    // Anti-enumeración: la búsqueda solo resuelve por tokenPublico/shortId,
    // jamás por numeroReserva ni id secuencial (ADR 005).
    const where = (prisma.reserva.findFirst as any).mock.calls[0][0].where;
    expect(where.OR).toEqual([
      { tokenPublico: 'token-abc-48-hex' },
      { shortId: 'token-abc-48-hex' },
    ]);
    expect(where.OR.some((clause: any) => 'numeroReserva' in clause || 'id' in clause)).toBe(false);
  });

  it('GET /reservas/:id - debería retornar 404 si la reserva no existe', async () => {
    (prisma.reserva.findFirst as any).mockResolvedValue(null);

    const response = await app.inject({
      method: 'GET',
      url: '/reservas/999',
    });

    expect(response.statusCode).toBe(404);
  });

  it('POST /pasajeros/:id/firma - debería guardar la firma de deslinde', async () => {
    (prisma.pasajero.findFirst as any).mockResolvedValue({
      id: 1,
      tokenPublico: 'pax-token-abc',
      shortId: 'pax12345',
      nombre: 'Juan Pérez',
      firmaDeslinde: false,
    });
    (prisma.pasajero.update as any).mockResolvedValue({
      id: 1,
      nombre: 'Juan Pérez',
      firmaDeslinde: true,
      firmaFecha: new Date(),
    });

    const response = await app.inject({
      method: 'POST',
      url: '/pasajeros/pax-token-abc/firma',
      payload: {
        firmaBase64: 'data:image/png;base64,samplebase64signature',
        rutDni: '12.345.678-9',
        contactoEmergencia: 'María',
        telefonoEmergencia: '+56911223344',
        condicionFisica: 'Buena',
        pesoVerificado: 78,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.pasajero.firmaDeslinde).toBe(true);

    // Anti-enumeración: la firma solo resuelve por tokenPublico/shortId,
    // jamás por numeroPasajero ni id secuencial.
    const where = (prisma.pasajero.findFirst as any).mock.calls[0][0].where;
    expect(where.OR).toEqual([
      { tokenPublico: 'pax-token-abc' },
      { shortId: 'pax-token-abc' },
    ]);
    expect(where.OR.some((clause: any) => 'numeroPasajero' in clause || 'id' in clause)).toBe(false);
  });

  it('POST /pasajeros/:id/firma - debería retornar 400 si falta la firma', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/pasajeros/1/firma',
      payload: {
        rutDni: '12.345.678-9',
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('GET /health - debería responder ok y la versión real del paquete', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('ok');
    expect(body.version).toBe(APP_VERSION);
    expect(body.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(body.timestamp).toBeDefined();
    expect(typeof body.uptime).toBe('number');
  });

  it('resolveAppVersion - respeta variables de entorno prioritarias', async () => {
    const { resolveAppVersion } = await import('../public.routes');
    const originalAppVer = process.env.APP_VERSION;
    try {
      process.env.APP_VERSION = '9.9.9';
      expect(resolveAppVersion()).toBe('9.9.9');
    } finally {
      if (originalAppVer) {
        process.env.APP_VERSION = originalAppVer;
      } else {
        delete process.env.APP_VERSION;
      }
    }
  });

  it('GET /pantalla - debería retornar 401 si no hay token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/pantalla',
    });

    expect(response.statusCode).toBe(401);
    expect(JSON.parse(response.body).error).toBe('LINK_REQUERIDO');
  });

  it('GET /pantalla - debería retornar 401 si el token caducó o no existe', async () => {
    (prisma.pantallaToken.findUnique as any).mockResolvedValue(null);

    const response = await app.inject({
      method: 'GET',
      url: '/pantalla?token=token-invalido',
    });

    expect(response.statusCode).toBe(401);
    expect(JSON.parse(response.body).error).toBe('LINK_INVALIDO_O_EXPIRADO');
  });

  it('GET /pantalla - debería retornar los datos del tablero con token válido', async () => {
    const manana = new Date(Date.now() + 24 * 3600 * 1000);
    (prisma.pantallaToken.findUnique as any).mockResolvedValue({ tipo: 'DIARIO', expiraEn: manana });
    (prisma.condicionPista.findFirst as any).mockResolvedValue(null);
    (prisma.vuelo.findMany as any).mockResolvedValue([]);

    const response = await app.inject({
      method: 'GET',
      url: '/pantalla?token=token-valido',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body).toHaveProperty('fecha');
    expect(body).toHaveProperty('clima');
    expect(body.vuelos).toEqual([]);
  });
});
