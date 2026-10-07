import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GoogleCalendarService } from '../google-calendar.service';
import { config } from '../../config';
import { prisma } from '../../plugins/prisma';

// Mocks
const mockRequest = vi.fn();

vi.mock('google-auth-library', () => {
  return {
    JWT: vi.fn().mockImplementation(function (this: any) {
      this.request = mockRequest;
      return this;
    }),
  };
});

vi.mock('../../plugins/prisma', () => ({
  prisma: {
    vuelo: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    empresa: {
      findFirst: vi.fn(),
    },
  },
}));

describe('GoogleCalendarService', () => {
  let service: GoogleCalendarService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new GoogleCalendarService();

    // Default valid config
    config.googleCalendarId = 'test-cal-id@group.calendar.google.com';
    config.googleCalendarClientEmail = 'bot@project.iam.gserviceaccount.com';
    config.googleCalendarPrivateKey = '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...\n-----END PRIVATE KEY-----';
  });

  describe('isEnabled', () => {
    it('debe retornar true si todas las credenciales están configuradas', () => {
      expect(service.isEnabled()).toBe(true);
    });

    it('debe retornar false si falta el ID de calendario', () => {
      config.googleCalendarId = '';
      expect(service.isEnabled()).toBe(false);
    });

    it('debe retornar false si falta el email de la Service Account', () => {
      config.googleCalendarClientEmail = '';
      expect(service.isEnabled()).toBe(false);
    });

    it('debe retornar false si falta la clave privada', () => {
      config.googleCalendarPrivateKey = '';
      expect(service.isEnabled()).toBe(false);
    });
  });

  describe('syncVueloCreated', () => {
    it('no debe hacer nada si el servicio está deshabilitado', async () => {
      config.googleCalendarId = '';
      const result = await service.syncVueloCreated(1);
      expect(result).toBeNull();
      expect(mockRequest).not.toHaveBeenCalled();
    });

    it('debe insertar evento en Google Calendar y persistir googleEventId', async () => {
      const mockVuelo = {
        id: 1,
        fechaHora: new Date('2026-09-20T10:00:00Z'),
        valorPactado: 50000,
        estado: 'AGENDADO',
        googleEventId: null,
        piloto: { nombre: 'Carlos Piloto' },
        pasajero: {
          nombre: 'Ana Pasajera',
          peso: 65,
          firmaDeslinde: true,
          telefonoEmergencia: '+56912345678',
          reserva: { numeroReserva: 'RES-001', telefono: '+56912345678' },
        },
      };

      vi.mocked(prisma.vuelo.findFirst).mockResolvedValue(mockVuelo as any);
      mockRequest.mockResolvedValueOnce({ data: { id: 'gcal-event-123' } });
      vi.mocked(prisma.vuelo.update).mockResolvedValue({} as any);

      const eventId = await service.syncVueloCreated(1);

      expect(eventId).toBe('gcal-event-123');
      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: expect.stringContaining('/events'),
          data: expect.objectContaining({
            summary: '🪂 Vuelo: Ana Pasajera (Carlos Piloto)',
            start: { dateTime: '2026-09-20T10:00:00.000Z' },
          }),
        })
      );
      expect(prisma.vuelo.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { googleEventId: 'gcal-event-123' },
      });
    });

    it('no debe lanzar error si la API de Google falla', async () => {
      vi.mocked(prisma.vuelo.findFirst).mockResolvedValue({
        id: 1,
        fechaHora: new Date(),
        valorPactado: 50000,
        estado: 'AGENDADO',
        googleEventId: null,
        piloto: { nombre: 'Carlos' },
        pasajero: { nombre: 'Ana' },
      } as any);

      mockRequest.mockRejectedValueOnce(new Error('Google Network Failure 503'));

      const result = await service.syncVueloCreated(1);
      expect(result).toBeNull(); // No explota, retorna null de forma segura
    });
  });

  describe('syncVueloUpdated', () => {
    it('debe actualizar el evento con PATCH si ya tiene googleEventId', async () => {
      const mockVuelo = {
        id: 1,
        fechaHora: new Date('2026-09-20T11:00:00Z'),
        valorPactado: 50000,
        estado: 'AGENDADO',
        googleEventId: 'existing-event-999',
        piloto: { nombre: 'Carlos Piloto' },
        pasajero: { nombre: 'Ana Pasajera' },
      };

      vi.mocked(prisma.vuelo.findFirst).mockResolvedValue(mockVuelo as any);
      mockRequest.mockResolvedValueOnce({ data: { id: 'existing-event-999' } });

      await service.syncVueloUpdated(1);

      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'PATCH',
          url: expect.stringContaining('/events/existing-event-999'),
        })
      );
    });

    it('si el vuelo fue cancelado, debe eliminar el evento de Google Calendar', async () => {
      const mockVuelo = {
        id: 1,
        fechaHora: new Date(),
        valorPactado: 50000,
        estado: 'CANCELADO',
        googleEventId: 'event-to-cancel',
        piloto: { nombre: 'Carlos' },
        pasajero: { nombre: 'Ana' },
      };

      vi.mocked(prisma.vuelo.findFirst).mockResolvedValue(mockVuelo as any);
      mockRequest.mockResolvedValueOnce({ data: {} });

      await service.syncVueloUpdated(1);

      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'DELETE',
          url: expect.stringContaining('/events/event-to-cancel'),
        })
      );
    });
  });

  describe('syncVueloDeleted', () => {
    it('debe invocar DELETE a la API de Google y limpiar googleEventId en DB', async () => {
      vi.mocked(prisma.vuelo.findUnique).mockResolvedValue({
        id: 1,
        googleEventId: 'event-to-delete',
      } as any);

      mockRequest.mockResolvedValueOnce({ data: {} });
      vi.mocked(prisma.vuelo.update).mockResolvedValue({} as any);

      await service.syncVueloDeleted(1);

      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'DELETE',
          url: expect.stringContaining('/events/event-to-delete'),
        })
      );
      expect(prisma.vuelo.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { googleEventId: null },
      });
    });

    it('debe tolerar 404 silenciosamente si el evento ya fue borrado en Google', async () => {
      mockRequest.mockRejectedValueOnce({
        response: { status: 404 },
      });

      await expect(service.syncVueloDeleted(1, 'already-deleted-id')).resolves.not.toThrow();
    });
  });

  describe('syncReservaVuelosDeleted', () => {
    it('debe buscar y eliminar todos los eventos de vuelos de la reserva', async () => {
      vi.mocked(prisma.vuelo.findMany).mockResolvedValue([
        { id: 10, googleEventId: 'event-1' },
        { id: 11, googleEventId: 'event-2' },
      ] as any);

      mockRequest.mockResolvedValue({ data: {} });
      vi.mocked(prisma.vuelo.update).mockResolvedValue({} as any);

      await service.syncReservaVuelosDeleted(100);

      expect(mockRequest).toHaveBeenCalledTimes(2);
      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'DELETE',
          url: expect.stringContaining('/events/event-1'),
        })
      );
      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'DELETE',
          url: expect.stringContaining('/events/event-2'),
        })
      );
    });
  });

  describe('reconcileVuelos', () => {
    it('debe reconciliar vuelos activos creando eventos faltantes y actualizando existentes', async () => {
      // 1. Vuelos activos
      vi.mocked(prisma.vuelo.findMany)
        .mockResolvedValueOnce([
          { id: 1, googleEventId: null }, // Requiere creación
          { id: 2, googleEventId: 'existing-event-2' }, // Requiere actualización
        ] as any)
        // 2. Vuelos cancelados con googleEventId
        .mockResolvedValueOnce([
          { id: 3, googleEventId: 'canceled-event-3' }, // Requiere eliminación
        ] as any);

      // Mocks para las llamadas internas
      vi.spyOn(service, 'syncVueloCreated').mockResolvedValueOnce('new-event-1');
      vi.spyOn(service, 'syncVueloUpdated').mockResolvedValueOnce(undefined);
      vi.spyOn(service, 'syncVueloDeleted').mockResolvedValueOnce(undefined);

      const stats = await service.reconcileVuelos();

      expect(stats.total).toBe(2);
      expect(stats.creados).toBe(1);
      expect(stats.actualizados).toBe(1);
      expect(stats.eliminados).toBe(1);
      expect(stats.fallidos).toBe(0);

      expect(service.syncVueloCreated).toHaveBeenCalledWith(1);
      expect(service.syncVueloUpdated).toHaveBeenCalledWith(2);
      expect(service.syncVueloDeleted).toHaveBeenCalledWith(3, 'canceled-event-3');
    });

    it('no debe hacer nada si el servicio está deshabilitado', async () => {
      config.googleCalendarId = '';
      const stats = await service.reconcileVuelos();
      expect(stats.total).toBe(0);
      expect(prisma.vuelo.findMany).not.toHaveBeenCalled();
    });
  });
});

