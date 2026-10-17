import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VuelosService } from '../vuelos.service';

vi.mock('../eventos.service', () => ({
  broadcastDatos: vi.fn(),
  broadcastModulos: vi.fn(),
  broadcast: vi.fn(),
  subscribe: vi.fn(),
}));

vi.mock('../../plugins/prisma', () => {
  return {
    prisma: {
      $transaction: vi.fn((cb) =>
        cb({
          $queryRaw: vi.fn().mockResolvedValue([]),
          reserva: {
            findUnique: vi.fn(),
            findFirst: vi.fn(),
            update: vi.fn(),
          },
          piloto: {
            findUnique: vi.fn(),
            findMany: vi.fn(),
          },
          vuelo: {
            findFirst: vi.fn(),
            findMany: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            count: vi.fn(),
            groupBy: vi.fn(),
          },
          pasajero: {
            findUnique: vi.fn(),
            findMany: vi.fn(),
          },
        }),
      ),
      reserva: {
        findUnique: vi.fn(),
      },
      piloto: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
      },
      vuelo: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      pasajero: {
        findUnique: vi.fn(),
      },
    },
  };
});

import { prisma } from '../../plugins/prisma';
import { broadcastDatos } from '../eventos.service';

describe('Vuelos Service - Agendamiento de Grupo', () => {
  let service: VuelosService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new VuelosService();
  });

  it('agendarGrupo debería crear vuelos para cada pasajero de la reserva y emitir broadcastDatos', async () => {
    const mockTx = {
      reserva: {
        // La lectura ahora ocurre DENTRO de la transacción (lock + re-lectura atómica)
        findFirst: vi.fn().mockResolvedValue({
          id: 5,
          estado: 'SIN_AGENDAR',
          version: 3,
          valorTotal: 150000,
          pasajeros: [
            { id: 101, nombre: 'Ana', peso: 60 },
            { id: 102, nombre: 'Beto', peso: 80 },
          ],
        }),
        update: vi.fn().mockResolvedValue({ id: 5 }),
      },
      vuelo: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi
          .fn()
          .mockImplementation(({ data }) => Promise.resolve({ id: Math.random(), ...data })),
        update: vi.fn(),
      },
      piloto: {
        findUnique: vi.fn().mockResolvedValue({ id: 1, tarifaPorVuelo: 25000 }),
      },
    };

    (prisma.$transaction as any).mockImplementation((cb: any) => cb(mockTx));

    const vuelos = await service.agendarGrupo({
      reservaId: 5,
      fechaHora: '2026-12-25T11:00:00.000Z',
      asignaciones: {
        101: 1,
        102: 2,
      },
      valorPactadoPorPasajero: 75000,
    });

    expect(mockTx.vuelo.create).toHaveBeenCalledTimes(2);
    expect(vuelos.length).toBe(2);
    expect(broadcastDatos).toHaveBeenCalledWith('reserva', 'actualizar');
    expect(broadcastDatos).toHaveBeenCalledWith('piloto', 'actualizar');
  });

  it('agendarGrupo debería lanzar ConflictError (409) si la version de la reserva no coincide', async () => {
    const mockTx = {
      reserva: {
        findFirst: vi.fn().mockResolvedValue({
          id: 5,
          estado: 'SIN_AGENDAR',
          version: 3, // versión actual en BD
          valorTotal: 150000,
          pasajeros: [{ id: 101, nombre: 'Ana', peso: 60 }],
        }),
        update: vi.fn(),
      },
      vuelo: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
        update: vi.fn(),
      },
      piloto: {
        findUnique: vi.fn().mockResolvedValue({ id: 1, tarifaPorVuelo: 25000 }),
      },
    };

    (prisma.$transaction as any).mockImplementation((cb: any) => cb(mockTx));

    await expect(
      service.agendarGrupo({
        reservaId: 5,
        fechaHora: '2026-12-25T11:00:00.000Z',
        asignaciones: { 101: 1 },
        valorPactadoPorPasajero: 75000,
        version: 2, // obsoleta
      }),
    ).rejects.toThrow('La reserva cambió en otro dispositivo');

    expect(mockTx.vuelo.create).not.toHaveBeenCalled();
    expect(broadcastDatos).not.toHaveBeenCalled();
  });

  it('agendarGrupo debería agendar sin version (retrocompatibilidad) cuando no se envía', async () => {
    const mockTx = {
      reserva: {
        findFirst: vi.fn().mockResolvedValue({
          id: 5,
          estado: 'SIN_AGENDAR',
          version: 3,
          valorTotal: 150000,
          pasajeros: [{ id: 101, nombre: 'Ana', peso: 60 }],
        }),
        update: vi.fn(),
      },
      vuelo: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi
          .fn()
          .mockImplementation(({ data }) => Promise.resolve({ id: Math.random(), ...data })),
        update: vi.fn(),
      },
      piloto: {
        findUnique: vi.fn().mockResolvedValue({ id: 1, tarifaPorVuelo: 25000 }),
      },
    };

    (prisma.$transaction as any).mockImplementation((cb: any) => cb(mockTx));

    const vuelos = await service.agendarGrupo({
      reservaId: 5,
      fechaHora: '2026-12-25T11:00:00.000Z',
      asignaciones: { 101: 1 },
      valorPactadoPorPasajero: 75000,
    });

    expect(mockTx.vuelo.create).toHaveBeenCalledTimes(1);
    expect(vuelos.length).toBe(1);
    expect(broadcastDatos).toHaveBeenCalledWith('reserva', 'actualizar');
    expect(broadcastDatos).toHaveBeenCalledWith('piloto', 'actualizar');
  });

  it('agendarGrupo debería lanzar Error si fechaHora es en el pasado', async () => {
    await expect(
      service.agendarGrupo({
        reservaId: 5,
        fechaHora: '2020-01-01T10:00:00.000Z',
        asignaciones: { 101: 1 },
        valorPactadoPorPasajero: 75000,
      }),
    ).rejects.toThrow('No se pueden agendar vuelos en una fecha u hora pasada');
  });
});

describe('Vuelos Service - autoAssign', () => {
  let service: VuelosService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new VuelosService();
  });

  it('debe filtrar vuelos con deletedAt: null y estado: { not: "CANCELADO" } y asignar pilotos disponibles', async () => {
    const targetDate = new Date('2026-08-25T11:00:00.000Z');

    (prisma.piloto.findMany as any).mockResolvedValue([
      {
        id: 1,
        nombre: 'Carlos',
        activo: true,
        disponibilidadTotal: true,
        tieneLicencia: true,
        fechaVencimientoLicencia: new Date('2027-01-01'),
        prioridad: 1,
        categoria: 'MASTER',
        pesoMinimoPasajero: 40,
        pesoMaximoPasajero: 100,
        excepciones: [],
        vuelos: [],
      },
      {
        id: 2,
        nombre: 'David',
        activo: true,
        disponibilidadTotal: true,
        tieneLicencia: true,
        fechaVencimientoLicencia: new Date('2027-01-01'),
        prioridad: 2,
        categoria: 'SENIOR',
        pesoMinimoPasajero: 40,
        pesoMaximoPasajero: 100,
        excepciones: [],
        vuelos: [{ id: 99, fechaHora: targetDate }],
      },
    ]);

    const asignaciones = await service.autoAssign('2026-08-25T11:00:00.000Z', [
      { id: 201, peso: 70 },
    ]);

    expect(prisma.piloto.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { activo: true },
        include: expect.objectContaining({
          vuelos: {
            where: {
              fechaHora: targetDate,
              deletedAt: null,
              estado: { not: 'CANCELADO' },
            },
          },
        }),
      }),
    );

    expect(asignaciones).toEqual({ 201: 1 });
  });

  it('no asigna si el peso del pasajero excede el rango del piloto disponible', async () => {
    (prisma.piloto.findMany as any).mockResolvedValue([
      {
        id: 1,
        nombre: 'Carlos',
        activo: true,
        disponibilidadTotal: true,
        tieneLicencia: true,
        prioridad: 1,
        categoria: 'MASTER',
        pesoMinimoPasajero: 50,
        pesoMaximoPasajero: 80,
        excepciones: [],
        vuelos: [],
      },
    ]);

    const asignaciones = await service.autoAssign('2026-08-25T11:00:00.000Z', [
      { id: 201, peso: 95 },
    ]);

    expect(asignaciones).toEqual({});
  });
});

describe('Vuelos Service - validateWeightAndConflict', () => {
  let service: VuelosService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new VuelosService();
    (prisma.piloto.findUnique as any).mockResolvedValue({
      id: 1,
      nombre: 'Piloto Test',
      activo: true,
      pesoMinimoPasajero: 30,
      pesoMaximoPasajero: 110,
    });
  });

  it('filtra deletedAt: null y estado: { not: "CANCELADO" } en findFirst de conflicto', async () => {
    (prisma.pasajero.findUnique as any).mockResolvedValue({ id: 50, peso: 70 });
    (prisma.vuelo.findFirst as any).mockResolvedValue(null);

    await service.validateWeightAndConflict(1, 50, '2026-08-25T11:00:00.000Z');

    expect(prisma.vuelo.findFirst).toHaveBeenCalledWith({
      where: {
        pilotoId: 1,
        fechaHora: new Date('2026-08-25T11:00:00.000Z'),
        deletedAt: null,
        estado: { not: 'CANCELADO' },
      },
    });
  });

  it('lanza error si existe conflicto con otro vuelo activo a la misma hora', async () => {
    (prisma.pasajero.findUnique as any).mockResolvedValue({ id: 50, peso: 70 });
    (prisma.vuelo.findFirst as any).mockResolvedValue({ id: 10, pilotoId: 1 });

    await expect(
      service.validateWeightAndConflict(1, 50, '2026-08-25T11:00:00.000Z'),
    ).rejects.toThrow('Conflicto de horario');
  });

  it('lanza error aeronáutico si el peso del pasajero excede 115kg', async () => {
    (prisma.pasajero.findUnique as any).mockResolvedValue({ id: 50, peso: 120 });

    await expect(
      service.validateWeightAndConflict(1, 50, '2026-08-25T11:00:00.000Z'),
    ).rejects.toThrow('Límite de peso excedido');
  });

  it('lanza error si el piloto no existe o no se encuentra activo', async () => {
    (prisma.pasajero.findUnique as any).mockResolvedValue({ id: 50, peso: 70 });
    (prisma.piloto.findUnique as any).mockResolvedValue(null);

    await expect(
      service.validateWeightAndConflict(1, 50, '2026-08-25T11:00:00.000Z'),
    ).rejects.toThrow('El piloto seleccionado no existe o no se encuentra activo.');
  });

  it('lanza error si el peso del pasajero está fuera del rango del piloto', async () => {
    (prisma.pasajero.findUnique as any).mockResolvedValue({ id: 50, peso: 112 });
    (prisma.piloto.findUnique as any).mockResolvedValue({
      id: 1,
      nombre: 'Piloto Test',
      activo: true,
      pesoMinimoPasajero: 40,
      pesoMaximoPasajero: 90,
    });

    await expect(
      service.validateWeightAndConflict(1, 50, '2026-08-25T11:00:00.000Z'),
    ).rejects.toThrow(
      'Límite de peso fuera de rango para el piloto Piloto Test (40kg - 90kg vs 112kg)',
    );
  });
});

describe('Vuelos Service - Transiciones de Estado, Inmutabilidad y Concurrencia', () => {
  let service: VuelosService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new VuelosService();
  });

  it('updateEstado rechaza transición inválida desde estado terminal COMPLETADO -> AGENDADO', async () => {
    const mockTx = {
      vuelo: {
        findFirst: vi.fn().mockResolvedValue({ id: 99, estado: 'COMPLETADO', version: 1 }),
        update: vi.fn(),
      },
    };
    (prisma.$transaction as any).mockImplementation((cb: any) => cb(mockTx));

    await expect(service.updateEstado(99, 'AGENDADO', 1)).rejects.toThrow(
      'Transición inválida: COMPLETADO → AGENDADO',
    );
    expect(mockTx.vuelo.update).not.toHaveBeenCalled();
  });

  it('updateEstado rechaza conflicto de versión si la versión enviada no coincide (409)', async () => {
    const mockTx = {
      vuelo: {
        findFirst: vi.fn().mockResolvedValue({ id: 99, estado: 'AGENDADO', version: 2 }),
        update: vi.fn(),
      },
    };
    (prisma.$transaction as any).mockImplementation((cb: any) => cb(mockTx));

    await expect(service.updateEstado(99, 'COMPLETADO', 1)).rejects.toThrow();
    expect(mockTx.vuelo.update).not.toHaveBeenCalled();
  });

  it('updateEstado actualiza vuelo a COMPLETADO y transiciona reserva a COMPLETADA cuando todos los pasajeros completaron vuelo', async () => {
    const mockTx = {
      vuelo: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ id: 10, estado: 'AGENDADO', version: 1, pasajeroId: 101 }),
        update: vi
          .fn()
          .mockResolvedValue({ id: 10, estado: 'COMPLETADO', version: 2, pasajeroId: 101 }),
        count: vi.fn().mockImplementation(() => Promise.resolve(2)),
        groupBy: vi.fn().mockResolvedValue([{ pasajeroId: 101 }, { pasajeroId: 102 }]),
      },
      pasajero: {
        findUnique: vi.fn().mockResolvedValue({ id: 101, reservaId: 50 }),
        findMany: vi.fn().mockResolvedValue([{ id: 101 }, { id: 102 }]),
        updateMany: vi.fn().mockResolvedValue({}),
      },
      reserva: {
        findFirst: vi.fn().mockResolvedValue({ id: 50, estadoPago: 'PAGADO' }),
        update: vi.fn().mockResolvedValue({ id: 50, estado: 'COMPLETADA' }),
      },
    };
    (prisma.$transaction as any).mockImplementation((cb: any) => cb(mockTx));

    const result = await service.updateEstado(10, 'COMPLETADO', 1);

    expect(result.estado).toBe('COMPLETADO');
    expect(mockTx.pasajero.updateMany).toHaveBeenCalledWith({
      where: { id: 101, deletedAt: null },
      data: { estado: 'VUELO_COMPLETADO' },
    });
    expect(mockTx.reserva.update).toHaveBeenCalledWith({
      where: { id: 50 },
      data: { estado: 'COMPLETADA', version: { increment: 1 } },
    });
    expect(broadcastDatos).toHaveBeenCalledWith('vuelo', 'actualizar');
    expect(broadcastDatos).toHaveBeenCalledWith('reserva', 'actualizar');
  });

  it('updateEstado no transiciona reserva a COMPLETADA si estadoPago no es PAGADO', async () => {
    const mockTx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: 10 }]),
      vuelo: {
        findFirst: vi.fn().mockResolvedValue({
          id: 10,
          estado: 'AGENDADO',
          version: 1,
          pasajeroId: 101,
        }),
        update: vi.fn().mockResolvedValue({
          id: 10,
          estado: 'COMPLETADO',
          version: 2,
          pasajeroId: 101,
        }),
        count: vi.fn().mockImplementation(() => Promise.resolve(2)),
        groupBy: vi.fn().mockResolvedValue([{ pasajeroId: 101 }, { pasajeroId: 102 }]),
      },
      pasajero: {
        findUnique: vi.fn().mockResolvedValue({ id: 101, reservaId: 50 }),
        findMany: vi.fn().mockResolvedValue([{ id: 101 }, { id: 102 }]),
        updateMany: vi.fn().mockResolvedValue({}),
      },
      reserva: {
        findFirst: vi.fn().mockResolvedValue({ id: 50, estadoPago: 'ABONADO' }),
        update: vi.fn(),
      },
    };
    (prisma.$transaction as any).mockImplementation((cb: any) => cb(mockTx));

    const result = await service.updateEstado(10, 'COMPLETADO', 1);

    expect(result.estado).toBe('COMPLETADO');
    expect(mockTx.pasajero.updateMany).toHaveBeenCalledWith({
      where: { id: 101, deletedAt: null },
      data: { estado: 'VUELO_COMPLETADO' },
    });
    expect(mockTx.reserva.update).not.toHaveBeenCalled();
    expect(broadcastDatos).toHaveBeenCalledWith('vuelo', 'actualizar');
  });
});

describe('Vuelos Service - Proyección de Calendario y Versión', () => {
  let service: VuelosService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new VuelosService();
  });

  it('getAll con campos="vista-calendario" incluye version: true en select para permitir re-agendamiento concurrente', async () => {
    (prisma.vuelo.findMany as any).mockResolvedValue([
      {
        id: 1,
        fechaHora: new Date(),
        estado: 'AGENDADO',
        valorPactado: 50000,
        version: 2,
        pilotoId: 1,
        pasajeroId: 10,
      },
    ]);
    (prisma.vuelo.count as any).mockResolvedValue(1);

    await service.getAll({ campos: 'vista-calendario' });

    expect(prisma.vuelo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          id: true,
          fechaHora: true,
          estado: true,
          valorPactado: true,
          version: true,
          pilotoId: true,
          pasajeroId: true,
        }),
      }),
    );
  });
});

describe('Vuelos Service - deleteVuelo (Reversión de agenda y limpieza de fecha/hora)', () => {
  let service: VuelosService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new VuelosService();
  });

  it('al eliminar el único vuelo de una reserva, limpia fechaAgenda, horaAgenda y revierte a SIN_AGENDAR', async () => {
    (prisma.vuelo.findUnique as any).mockResolvedValue({
      id: 99,
      pasajeroId: 10,
      pasajero: { id: 10, reservaId: 1 },
      reserva: { id: 1, cerradaAt: null, estado: 'AGENDADA' },
    });

    const mockTx = {
      vuelo: {
        update: vi.fn().mockResolvedValue({ id: 99, deletedAt: new Date() }),
      },
      reserva: {
        findFirst: vi.fn().mockResolvedValue({
          id: 1,
          estado: 'AGENDADA',
          pasajeros: [
            {
              id: 10,
              vuelos: [],
            },
          ],
        }),
        update: vi.fn().mockResolvedValue({ id: 1 }),
      },
      pasajero: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };

    (prisma.$transaction as any).mockImplementation((cb: any) => cb(mockTx));

    await service.delete(99);

    expect(mockTx.vuelo.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 99 },
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      }),
    );

    expect(mockTx.reserva.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: {
          estado: 'SIN_AGENDAR',
          fechaAgenda: null,
          horaAgenda: null,
          version: { increment: 1 },
        },
      }),
    );

    expect(mockTx.pasajero.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { reservaId: 1, deletedAt: null, estado: { not: 'VUELO_COMPLETADO' } },
        data: { estado: 'POR_VOLAR' },
      }),
    );

    expect(broadcastDatos).toHaveBeenCalledWith('vuelo', 'actualizar');
    expect(broadcastDatos).toHaveBeenCalledWith('reserva', 'actualizar');
  });

  it('si aún quedan vuelos activos en la reserva, sincroniza fechaAgenda con el más próximo', async () => {
    (prisma.vuelo.findUnique as any).mockResolvedValue({
      id: 99,
      pasajeroId: 10,
      pasajero: { id: 10, reservaId: 1 },
      reserva: { id: 1, cerradaAt: null, estado: 'AGENDADA' },
    });

    const fechaRestante = new Date('2026-12-20T14:00:00.000Z');
    const mockTx = {
      vuelo: {
        update: vi.fn().mockResolvedValue({ id: 99, deletedAt: new Date() }),
      },
      reserva: {
        findFirst: vi.fn().mockResolvedValue({
          id: 1,
          estado: 'AGENDADA',
          pasajeros: [
            {
              id: 10,
              vuelos: [],
            },
            {
              id: 11,
              vuelos: [{ id: 100, fechaHora: fechaRestante, estado: 'AGENDADO' }],
            },
          ],
        }),
        update: vi.fn().mockResolvedValue({ id: 1 }),
      },
      pasajero: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };

    (prisma.$transaction as any).mockImplementation((cb: any) => cb(mockTx));

    await service.delete(99);

    expect(mockTx.reserva.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({
          fechaAgenda: expect.any(Date),
          horaAgenda: expect.any(String),
          version: { increment: 1 },
        }),
      }),
    );
  });

  describe('createVuelo — antirregresión A-02', () => {
    it('limpia vuelos activos previos del pasajero dentro de la transacción atómica', async () => {
      (prisma.pasajero.findUnique as any).mockResolvedValue({
        id: 10,
        reservaId: 1,
        peso: 70,
        deletedAt: null,
      });
      (prisma.piloto.findUnique as any).mockResolvedValue({
        id: 2,
        activo: true,
        tarifaPorVuelo: 25000,
        pesoMinimoPasajero: 30,
        pesoMaximoPasajero: 110,
        deletedAt: null,
      });
      (prisma.vuelo.findFirst as any).mockResolvedValue(null);

      const mockTx = {
        reserva: {
          findFirst: vi.fn().mockResolvedValue({
            id: 1,
            cerradaAt: null,
            pasajeros: [
              {
                id: 10,
                vuelos: [{ id: 501, fechaHora: new Date('2030-10-14T14:00:00-03:00') }],
              },
            ],
          }),
          update: vi.fn().mockResolvedValue({ id: 1 }),
        },
        vuelo: {
          findFirst: vi.fn().mockResolvedValue({ id: 999 }),
          update: vi.fn().mockResolvedValue({ id: 999, deletedAt: new Date() }),
          create: vi.fn().mockResolvedValue({
            id: 501,
            pasajeroId: 10,
            pilotoId: 2,
            reservaId: 1,
            fechaHora: new Date('2030-10-14T14:00:00-03:00'),
          }),
        },
        pasajero: {
          update: vi.fn().mockResolvedValue({ id: 10 }),
        },
      };

      (prisma.$transaction as any).mockImplementation((cb: any) => cb(mockTx));

      const res = await service.create({
        pasajeroId: 10,
        pilotoId: 2,
        fechaHora: '2030-10-14T14:00:00-03:00',
        valorPactado: 80000,
      });

      expect(mockTx.vuelo.findFirst).toHaveBeenCalledWith({
        where: {
          pasajeroId: 10,
          deletedAt: null,
          estado: { not: 'COMPLETADO' },
        },
      });
      expect(mockTx.vuelo.update).toHaveBeenCalledWith({
        where: { id: 999 },
        data: { deletedAt: expect.any(Date), version: { increment: 1 } },
      });
      expect(mockTx.vuelo.create).toHaveBeenCalled();
      expect(res.id).toBe(501);
    });
  });
});
