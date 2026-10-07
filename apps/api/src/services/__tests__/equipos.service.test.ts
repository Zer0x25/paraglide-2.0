import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EquiposService } from '../equipos.service';

vi.mock('../../plugins/prisma', () => {
  return {
    prisma: {
      $transaction: vi.fn((cb) => cb({
        mantenimientoEquipo: {
          create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 1, ...data })),
        },
        equipo: {
          update: vi.fn().mockResolvedValue({ id: 10, estado: 'OPERATIVO' }),
        },
      })),
      equipo: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      mantenimientoEquipo: {
        update: vi.fn(),
      },
    },
  };
});

import { prisma } from '../../plugins/prisma';

describe('Equipos & Mantenimiento Service (Unit Tests)', () => {
  let service: EquiposService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new EquiposService();
  });

  it('create debería crear un equipo nuevo formateando el código a mayúsculas', async () => {
    (prisma.equipo.create as any).mockResolvedValue({
      id: 1,
      codigo: 'VELA-01',
      nombre: 'Ozone Magnum 3',
      tipo: 'VELA',
      estado: 'OPERATIVO',
    });

    const res = await service.create({
      codigo: '  vela-01  ',
      nombre: '  Ozone Magnum 3  ',
      tipo: 'VELA',
      estado: 'OPERATIVO',
      horasVueloEstimadas: 0,
      vuelosRealizados: 0,
      limiteHorasInspeccion: 100,
    });

    expect(prisma.equipo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          codigo: 'VELA-01',
          nombre: 'Ozone Magnum 3',
        }),
      })
    );
    expect(res.codigo).toBe('VELA-01');
  });

  it('addMantenimiento debería registrar el mantenimiento y actualizar la fecha de revisión en el equipo', async () => {
    const mockTx = {
      mantenimientoEquipo: {
        create: vi.fn().mockResolvedValue({ id: 99, descripcion: 'Replegado de emergencia semestral', costo: 35000 }),
      },
      equipo: {
        findUnique: vi.fn().mockResolvedValue({ id: 10, version: 0, estado: 'OPERATIVO' }),
        update: vi.fn().mockResolvedValue({ id: 10, estado: 'OPERATIVO' }),
      },
    };

    (prisma.$transaction as any).mockImplementation((cb: any) => cb(mockTx));

    const res = await service.addMantenimiento(10, {
      tipo: 'REPLEGADO_PARACAIDAS',
      descripcion: 'Replegado de emergencia semestral',
      taller: 'Taller Paraglide Air',
      costo: 35000,
      proximaRevision: '2027-02-15',
    });

    expect(mockTx.mantenimientoEquipo.create).toHaveBeenCalled();
    expect(mockTx.equipo.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 10 },
        data: expect.objectContaining({
          estado: 'OPERATIVO',
        }),
      })
    );
    expect(res.id).toBe(99);
  });
});
