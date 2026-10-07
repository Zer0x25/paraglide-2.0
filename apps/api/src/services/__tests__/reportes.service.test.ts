import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReportesService } from '../reportes.service';

vi.mock('../../plugins/prisma', () => {
  return {
    prisma: {
      vuelo: {
        findMany: vi.fn(),
      },
      piloto: {
        findMany: vi.fn(),
      },
    },
  };
});

import { prisma } from '../../plugins/prisma';

describe('ReportesService (Unit Tests)', () => {
  let service: ReportesService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ReportesService();
  });

  describe('getManifiestoDiario', () => {
    it('debería retornar el manifiesto diario con conteos correctos', async () => {
      (prisma.vuelo.findMany as any).mockResolvedValue([
        {
          id: 1,
          fechaHora: new Date('2026-08-14T15:30:00Z'),
          estado: 'COMPLETADO',
          pilotoId: 10,
          piloto: { nombre: 'Piloto Uno', tieneLicencia: true, categoria: 'TANDEM' },
          pasajeroId: 20,
          pasajero: {
            nombre: 'Pasajero Uno',
            rutDni: '12345678-9',
            peso: 70,
            pesoVerificado: 71,
            contactoEmergencia: 'Madre',
            telefonoEmergencia: '+56912345678',
            condicionFisica: 'Optima',
            firmaDeslinde: true,
            reservaId: 100,
            reserva: { numeroReserva: 'RES-001', nombreTitular: 'Pasajero Uno', telefono: '+56912345678' },
          },
        },
        {
          id: 2,
          fechaHora: new Date('2026-08-14T16:30:00Z'),
          estado: 'AGENDADO',
          pilotoId: 10,
          piloto: { nombre: 'Piloto Uno', tieneLicencia: true, categoria: 'TANDEM' },
          pasajeroId: 21,
          pasajero: {
            nombre: 'Pasajero Dos',
            rutDni: null,
            peso: 80,
            pesoVerificado: null,
            contactoEmergencia: null,
            telefonoEmergencia: null,
            condicionFisica: null,
            firmaDeslinde: false,
            reservaId: 101,
            reserva: null,
          },
        },
      ]);

      const result = await service.getManifiestoDiario('2026-08-14');

      expect(result.fecha).toBe('2026-08-14');
      expect(result.totalVuelos).toBe(2);
      expect(result.totalCompletados).toBe(1);
      expect(result.totalFirmados).toBe(1);
      expect(result.vuelos).toHaveLength(2);
      expect(result.vuelos[0].pilotoNombre).toBe('Piloto Uno');
    });

    it('debería propagar el error si la base de datos falla (sin manifiesto vacío inventado)', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      (prisma.vuelo.findMany as any).mockRejectedValue(new Error('DB connection failure'));

      await expect(service.getManifiestoDiario('2026-08-14')).rejects.toThrow('DB connection failure');
      warnSpy.mockRestore();
    });
  });

  describe('generarManifiestoPdf', () => {
    it('debería generar un buffer PDF válido para la fecha indicada', async () => {
      (prisma.vuelo.findMany as any).mockResolvedValue([]);

      const { buffer, filename } = await service.generarManifiestoPdf('2026-08-14');

      expect(filename).toBe('manifiesto_2026-08-14.pdf');
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.slice(0, 5).toString()).toBe('%PDF-');
    });
  });

  describe('getLiquidaciones', () => {
    it('debería calcular liquidaciones agrupadas por piloto', async () => {
      (prisma.piloto.findMany as any).mockResolvedValue([
        { id: 1, nombre: 'Piloto A', email: 'a@p.cl', telefono: '123', tarifaPorVuelo: 25000 },
      ]);
      (prisma.vuelo.findMany as any).mockResolvedValue([
        {
          id: 1,
          pilotoId: 1,
          estado: 'COMPLETADO',
          pagoPiloto: 30000,
          valorPactado: 70000,
          fechaHora: new Date('2026-08-10T10:00:00Z'),
          pasajero: { nombre: 'Cliente 1' },
        },
      ]);

      const result = await service.getLiquidaciones({ mes: 7, year: 2026, pilotoId: 1 });

      expect(result.periodo).toBe('Agosto 2026');
      expect(result.totalVuelosGlobal).toBe(1);
      expect(result.totalMontoGlobal).toBe(30000);
      expect(result.pilotos[0].totalAPagar).toBe(30000);
    });
  });
});
