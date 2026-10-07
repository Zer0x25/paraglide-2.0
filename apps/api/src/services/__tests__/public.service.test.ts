import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PublicService } from '../public.service';

vi.mock('../../plugins/prisma', () => {
  const mockDeslindeFirma = {
    upsert: vi.fn().mockResolvedValue({}),
  };
  const mockPasajero = {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  };

  return {
    prisma: {
      $transaction: vi.fn(async (callback: any) => {
        return callback({
          deslindeFirma: mockDeslindeFirma,
          pasajero: mockPasajero,
        });
      }),
      reserva: {
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      pasajero: mockPasajero,
      deslindeFirma: mockDeslindeFirma,
      deslindeVersion: {
        findFirst: vi.fn(),
      },
      empresa: {
        findFirst: vi.fn(),
      },
      faq: {
        findMany: vi.fn(),
      },
      reglaOperativa: {
        findMany: vi.fn(),
      },
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

describe('PublicService (Unit Tests)', () => {
  let service: PublicService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PublicService();
  });

  describe('getHealth', () => {
    it('debería retornar el estado ok, versión y uptime', () => {
      const health = service.getHealth();
      expect(health.status).toBe('ok');
      expect(typeof health.version).toBe('string');
      expect(typeof health.uptime).toBe('number');
      expect(typeof health.timestamp).toBe('string');
    });
  });

  describe('getReservaPublica', () => {
    it('debería retornar null si la reserva no existe', async () => {
      (prisma.reserva.findFirst as any).mockResolvedValue(null);

      const result = await service.getReservaPublica('token-inexistente');
      expect(result).toBeNull();
    });

    it('debería retornar la reserva pública encontrada', async () => {
      (prisma.reserva.findFirst as any).mockResolvedValue({
        id: 123,
        tokenPublico: 'token-abc',
        shortId: 'abc12345',
        numeroReserva: '260814-0001',
        nombreTitular: 'Juan Pérez',
        pasajeros: [],
      });

      const result = await service.getReservaPublica('token-abc');
      expect(result).not.toBeNull();
      expect(result?.id).toBe(123);
      expect(result?.numeroReserva).toBe('260814-0001');
    });
  });

  describe('registrarFirmaDeslinde', () => {
    it('debería lanzar error 400 si falta la firma', async () => {
      await expect(
        service.registrarFirmaDeslinde('pax-1', { firmaBase64: '' }, { ip: '127.0.0.1' })
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('debería lanzar error 404 si el pasajero no existe', async () => {
      (prisma.pasajero.findFirst as any).mockResolvedValue(null);

      await expect(
        service.registrarFirmaDeslinde('pax-inexistente', { firmaBase64: 'data:image/png;base64,...' }, {})
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('debería lanzar error 400 si la reserva está cancelada', async () => {
      (prisma.pasajero.findFirst as any).mockResolvedValue({
        id: 10,
        reserva: { estado: 'CANCELADA' },
      });

      await expect(
        service.registrarFirmaDeslinde('pax-1', { firmaBase64: 'data:image/png;base64,...' }, {})
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('debería registrar la firma y retornar el pasajero actualizado', async () => {
      (prisma.pasajero.findFirst as any).mockResolvedValue({
        id: 10,
        reserva: { estado: 'AGENDADA' },
      });
      (prisma.pasajero.findUnique as any).mockResolvedValue({
        id: 10,
        reserva: { estado: 'AGENDADA' },
      });
      (prisma.pasajero.update as any).mockResolvedValue({
        id: 10,
        numeroPasajero: 'PAX-001',
        tokenPublico: 'token-pax',
        shortId: 'pax123',
        nombre: 'Pedro Pasajero',
        firmaDeslinde: true,
        firmaFecha: new Date(),
      });

      const res = await service.registrarFirmaDeslinde(
        'pax-1',
        { firmaBase64: 'data:image/png;base64,...', rutDni: '11.222.333-4' },
        { ip: '127.0.0.1', userAgent: 'Browser/1.0' }
      );

      expect(res.message).toContain('exitosamente');
      expect(res.pasajero.firmaDeslinde).toBe(true);
    });
  });
});
