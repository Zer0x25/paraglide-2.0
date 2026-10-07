import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import reportesRoutes from '../reportes.routes';

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

describe('Reportes & Manifiestos Routes (Unit Tests)', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify();
    await app.register(reportesRoutes);
    await app.ready();
  });

  it('GET /manifiesto - debería retornar el manifiesto diario de vuelos', async () => {
    (prisma.vuelo.findMany as any).mockResolvedValue([
      {
        id: 1,
        fechaHora: new Date('2026-08-14T15:30:00Z'),
        estado: 'AGENDADO',
        pilotoId: 10,
        piloto: {
          nombre: 'Carlos Piloto',
          tieneLicencia: true,
          categoria: 'MASTER',
        },
        pasajeroId: 20,
        pasajero: {
          nombre: 'Ana Pasajera',
          rutDni: '18.123.456-7',
          peso: 65,
          pesoVerificado: 66,
          contactoEmergencia: 'Papá',
          telefonoEmergencia: '+56911223344',
          condicionFisica: 'Buena',
          firmaDeslinde: true,
          reservaId: 100,
          reserva: {
            numeroReserva: '260814-0001',
            nombreTitular: 'Ana Pasajera',
            telefono: '+56999887766',
          },
        },
      },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/manifiesto?fecha=2026-08-14',
    });

    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.fecha).toBe('2026-08-14');
    expect(data.totalVuelos).toBe(1);
    expect(data.totalFirmados).toBe(1);
    expect(data.vuelos[0].pilotoNombre).toBe('Carlos Piloto');
    expect(data.vuelos[0].pasajeroNombre).toBe('Ana Pasajera');
    expect(data.vuelos[0].pasajeroFirmaDeslinde).toBe(true);
  });

  it('GET /liquidaciones - debería calcular las liquidaciones por piloto', async () => {
    (prisma.piloto.findMany as any).mockResolvedValue([
      {
        id: 10,
        nombre: 'Carlos Piloto',
        tarifaPorVuelo: 25000,
        email: 'carlos@example.com',
        telefono: '+56912345678',
      },
    ]);

    (prisma.vuelo.findMany as any).mockResolvedValue([
      {
        id: 1,
        pilotoId: 10,
        fechaHora: new Date('2026-08-10T11:00:00Z'),
        valorPactado: 75000,
        pagoPiloto: 25000,
        estado: 'COMPLETADO',
        pasajero: { nombre: 'Pasajero Uno' },
      },
      {
        id: 2,
        pilotoId: 10,
        fechaHora: new Date('2026-08-11T12:00:00Z'),
        valorPactado: 75000,
        pagoPiloto: 25000,
        estado: 'COMPLETADO',
        pasajero: { nombre: 'Pasajero Dos' },
      },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/liquidaciones?mes=7&year=2026',
    });

    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.totalVuelosGlobal).toBe(2);
    expect(data.totalMontoGlobal).toBe(50000);
    expect(data.pilotos[0].totalVuelosCompletados).toBe(2);
    expect(data.pilotos[0].totalAPagar).toBe(50000);
  });

  it('GET /liquidaciones/csv - debería generar y retornar archivo CSV con encabezados', async () => {
    (prisma.vuelo.findMany as any).mockResolvedValue([
      {
        id: 1,
        fechaHora: new Date('2026-08-10T11:00:00Z'),
        valorPactado: 75000,
        pagoPiloto: 25000,
        estado: 'COMPLETADO',
        piloto: { nombre: 'Carlos Piloto', tarifaPorVuelo: 25000 },
        pasajero: { nombre: 'Pasajero Uno', rutDni: '12.345.678-9' },
      },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/liquidaciones/csv?mes=7&year=2026',
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment; filename="liquidaciones_2026_08.csv"');
    expect(res.body).toContain('Carlos Piloto');
    expect(res.body).toContain('25000');
  });

  it('GET /manifiesto/pdf - debería generar PDF landscape con cabecera %PDF-', async () => {
    (prisma.vuelo.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 1,
        fechaHora: new Date('2026-08-14T15:30:00Z'),
        estado: 'AGENDADO',
        pilotoId: 10,
        piloto: {
          nombre: 'Carlos Piloto',
          tieneLicencia: true,
          categoria: 'MASTER',
        },
        pasajeroId: 20,
        pasajero: {
          nombre: 'Ana Pasajera',
          rutDni: '18.123.456-7',
          peso: 65,
          pesoVerificado: 66,
          contactoEmergencia: 'Papá',
          telefonoEmergencia: '+56911223344',
          firmaDeslinde: true,
          reservaId: 100,
          reserva: {
            numeroReserva: '260814-0001',
            nombreTitular: 'Ana Pasajera',
            telefono: '+56999887766',
          },
        },
      },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/manifiesto/pdf?fecha=2026-08-14',
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toContain('attachment; filename="manifiesto_2026-08-14.pdf"');
    // pdfkit genera binario: validar cabecera %PDF- vía rawPayload o body
    const buf: Buffer =
      (res.rawPayload as unknown as Buffer) ?? Buffer.from(res.body, 'binary');
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(100);
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('GET /liquidaciones/xlsx - debería generar Excel con cabecera ZIP PK y headers correctos', async () => {
    (prisma.vuelo.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 1,
        fechaHora: new Date('2026-08-10T11:00:00Z'),
        valorPactado: 75000,
        pagoPiloto: 25000,
        estado: 'COMPLETADO',
        piloto: { nombre: 'Carlos Piloto', tarifaPorVuelo: 25000 },
        pasajero: { nombre: 'Pasajero Uno', rutDni: '12.345.678-9' },
      },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/liquidaciones/xlsx?mes=7&year=2026',
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(res.headers['content-disposition']).toContain(
      'attachment; filename="liquidaciones_2026_08.xlsx"',
    );
    // exceljs genera ZIP (xlsx): validar cabecera PK vía rawPayload o body
    const buf: Buffer =
      (res.rawPayload as unknown as Buffer) ?? Buffer.from(res.body, 'binary');
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(100);
    expect(buf.subarray(0, 2).toString()).toBe('PK');
  });
});
