import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calcularValor } from '../reservas/reservas.precios';
import { prisma } from '../../plugins/prisma';

vi.mock('../../plugins/prisma', () => ({
  prisma: {
    tarifa: {
      findFirst: vi.fn(),
    },
    promocion: {
      findFirst: vi.fn(),
    },
  },
}));

describe('Reservas Precios - calcularValor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calculates correct base price without a promotion', async () => {
    vi.mocked(prisma.tarifa.findFirst).mockResolvedValue({
      id: 1,
      nombre: 'Vuelo Normal',
      precio: 150000,
      activo: true,
      deletedAt: null,
    } as any);

    const result = await calcularValor({ tarifaId: 1, cantidadPasajeros: 2 });

    expect(result).toEqual({
      precioBase: 300000,
      descuento: 0,
      valorTotal: 300000,
      detalle: 'Vuelo Normal ×2',
    });
    expect(prisma.tarifa.findFirst).toHaveBeenCalledWith({
      where: { id: 1, deletedAt: null, activo: true },
    });
  });

  it('calculates correct price with a percentage discount', async () => {
    vi.mocked(prisma.tarifa.findFirst).mockResolvedValue({
      id: 1,
      nombre: 'Vuelo VIP',
      precio: 200000,
      activo: true,
      deletedAt: null,
    } as any);

    vi.mocked(prisma.promocion.findFirst).mockResolvedValue({
      id: 10,
      nombre: 'Promo 10%',
      tipoDescuento: 'PORCENTAJE',
      valor: 10, // 10%
      fechaInicio: null,
      fechaFin: null,
      activa: true,
      deletedAt: null,
    } as any);

    const result = await calcularValor({ tarifaId: 1, promocionId: 10, cantidadPasajeros: 3 });

    expect(result).toEqual({
      precioBase: 600000, // 200000 * 3
      descuento: 60000,  // 10% de 600000
      valorTotal: 540000,
      detalle: 'Vuelo VIP ×3 − Promo 10% (10%)',
    });
  });

  it('calculates correct price with a fixed discount per passenger', async () => {
    vi.mocked(prisma.tarifa.findFirst).mockResolvedValue({
      id: 1,
      nombre: 'Vuelo Normal',
      precio: 150000,
      activo: true,
      deletedAt: null,
    } as any);

    vi.mocked(prisma.promocion.findFirst).mockResolvedValue({
      id: 20,
      nombre: 'Descuento 50k',
      tipoDescuento: 'MONTO',
      valor: 50000, // $50.000
      fechaInicio: null,
      fechaFin: null,
      activa: true,
      deletedAt: null,
    } as any);

    const result = await calcularValor({ tarifaId: 1, promocionId: 20, cantidadPasajeros: 2 });

    expect(result).toEqual({
      precioBase: 300000,
      descuento: 100000, // 50000 * 2 pasajeros
      valorTotal: 200000,
      detalle: 'Vuelo Normal ×2 − Descuento 50k ($50000 ×2)',
    });
  });

  it('calculates correct price with a fixed discount for single passenger', async () => {
    vi.mocked(prisma.tarifa.findFirst).mockResolvedValue({
      id: 1,
      nombre: 'Vuelo Normal',
      precio: 150000,
      activo: true,
      deletedAt: null,
    } as any);

    vi.mocked(prisma.promocion.findFirst).mockResolvedValue({
      id: 20,
      nombre: 'Descuento 50k',
      tipoDescuento: 'MONTO',
      valor: 50000, // $50.000
      fechaInicio: null,
      fechaFin: null,
      activa: true,
      deletedAt: null,
    } as any);

    const result = await calcularValor({ tarifaId: 1, promocionId: 20, cantidadPasajeros: 1 });

    expect(result).toEqual({
      precioBase: 150000,
      descuento: 50000,
      valorTotal: 100000,
      detalle: 'Vuelo Normal ×1 − Descuento 50k ($50000)',
    });
  });


  it('caps the fixed discount per passenger if it exceeds the unit price', async () => {
    vi.mocked(prisma.tarifa.findFirst).mockResolvedValue({
      id: 1,
      nombre: 'Vuelo Barato',
      precio: 50000,
      activo: true,
      deletedAt: null,
    } as any);

    vi.mocked(prisma.promocion.findFirst).mockResolvedValue({
      id: 30,
      nombre: 'Súper Descuento',
      tipoDescuento: 'MONTO',
      valor: 100000, // $100.000 discount but ticket is only $50.000
      fechaInicio: null,
      fechaFin: null,
      activa: true,
      deletedAt: null,
    } as any);

    const result = await calcularValor({ tarifaId: 1, promocionId: 30, cantidadPasajeros: 3 });

    expect(result).toEqual({
      precioBase: 150000,
      descuento: 150000, // limited to 50000 * 3
      valorTotal: 0,
      detalle: 'Vuelo Barato ×3 − Súper Descuento ($100000 ×3)',
    });
  });

  it('throws an error if tarifa is not found', async () => {
    vi.mocked(prisma.tarifa.findFirst).mockResolvedValue(null);

    await expect(calcularValor({ tarifaId: 99, cantidadPasajeros: 1 }))
      .rejects.toThrow('Tarifa no encontrada o inactiva');
  });

  it('throws an error if promocion is not found', async () => {
    vi.mocked(prisma.tarifa.findFirst).mockResolvedValue({
      id: 1,
      precio: 100,
      activo: true,
      deletedAt: null,
    } as any);

    vi.mocked(prisma.promocion.findFirst).mockResolvedValue(null);

    await expect(calcularValor({ tarifaId: 1, promocionId: 99, cantidadPasajeros: 1 }))
      .rejects.toThrow('Promoción no encontrada o inactiva');
  });

  it('throws an error if promotion fechaInicio is in the future', async () => {
    vi.mocked(prisma.tarifa.findFirst).mockResolvedValue({
      id: 1,
      precio: 100,
      activo: true,
      deletedAt: null,
    } as any);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    vi.mocked(prisma.promocion.findFirst).mockResolvedValue({
      id: 10,
      nombre: 'Promo Futura',
      fechaInicio: tomorrow,
      fechaFin: null,
      activa: true,
      deletedAt: null,
    } as any);

    await expect(calcularValor({ tarifaId: 1, promocionId: 10, cantidadPasajeros: 1 }))
      .rejects.toThrow('La promoción "Promo Futura" aún no está vigente');
  });

  it('throws an error if promotion fechaFin is in the past', async () => {
    vi.mocked(prisma.tarifa.findFirst).mockResolvedValue({
      id: 1,
      precio: 100,
      activo: true,
      deletedAt: null,
    } as any);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    vi.mocked(prisma.promocion.findFirst).mockResolvedValue({
      id: 10,
      nombre: 'Promo Pasada',
      fechaInicio: null,
      fechaFin: yesterday,
      activa: true,
      deletedAt: null,
    } as any);

    await expect(calcularValor({ tarifaId: 1, promocionId: 10, cantidadPasajeros: 1 }))
      .rejects.toThrow('La promoción "Promo Pasada" está vencida');
  });
});
