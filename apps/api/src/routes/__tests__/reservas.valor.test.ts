import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calcularValor } from '../../services/reservas.service';

vi.mock('../../plugins/prisma', () => {
  return {
    prisma: {
      tarifa: { findFirst: vi.fn() },
      promocion: { findFirst: vi.fn() },
    },
  };
});

import { prisma } from '../../plugins/prisma';

const mockTarifa = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  nombre: 'Vuelo Tándem',
  precio: { toString: () => '50000' }, // simula Decimal(12,2)
  activo: true,
  deletedAt: null,
  ...overrides,
});

const mockPromocion = (overrides: Record<string, unknown> = {}) => ({
  id: 10,
  nombre: 'Promo Invierno',
  tipoDescuento: 'PORCENTAJE',
  valor: { toString: () => '10' },
  fechaInicio: null,
  fechaFin: null,
  activa: true,
  deletedAt: null,
  ...overrides,
});

describe('calcularValor (Fase 2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calcula con promoción PORCENTAJE correctamente', async () => {
    (prisma.tarifa.findFirst as any).mockResolvedValue(mockTarifa());
    (prisma.promocion.findFirst as any).mockResolvedValue(mockPromocion());

    const r = await calcularValor({ tarifaId: 1, promocionId: 10, cantidadPasajeros: 2 });

    expect(r.precioBase).toBe(100000);
    expect(r.descuento).toBe(10000);
    expect(r.valorTotal).toBe(90000);
    expect(r.detalle).toContain('Vuelo Tándem ×2');
    expect(r.detalle).toContain('Promo Invierno');
    expect(r.detalle).toContain('10%');
  });

  it('calcula con MONTO_FIJO y aplica tope cuando el descuento supera el precio base', async () => {
    (prisma.tarifa.findFirst as any).mockResolvedValue(mockTarifa({ precio: { toString: () => '20000' } }));
    (prisma.promocion.findFirst as any).mockResolvedValue(
      mockPromocion({ tipoDescuento: 'MONTO_FIJO', valor: { toString: () => '35000' } }),
    );

    const r = await calcularValor({ tarifaId: 1, promocionId: 10, cantidadPasajeros: 1 });

    // descuento 35000 > precioBase 20000 → clamped a 20000, total 0
    expect(r.precioBase).toBe(20000);
    expect(r.descuento).toBe(20000);
    expect(r.valorTotal).toBe(0);
  });

  it('calcula con MONTO_FIJO aplicando el descuento al valor individual de cada vuelo', async () => {
    (prisma.tarifa.findFirst as any).mockResolvedValue(mockTarifa({ precio: { toString: () => '80000' } }));
    (prisma.promocion.findFirst as any).mockResolvedValue(
      mockPromocion({ tipoDescuento: 'MONTO_FIJO', valor: { toString: () => '20000' } }),
    );

    const r = await calcularValor({ tarifaId: 1, promocionId: 10, cantidadPasajeros: 3 });

    // (3 * 80000) - (3 * 20000) = 240000 - 60000 = 180000
    expect(r.precioBase).toBe(240000);
    expect(r.descuento).toBe(60000);
    expect(r.valorTotal).toBe(180000);
    expect(r.detalle).toContain('Vuelo Tándem ×3');
    expect(r.detalle).toContain('($20000 ×3)');
  });

  it('lanza error si la promoción está vencida', async () => {
    const ayer = new Date();
    ayer.setDate(ayer.getDate() - 1);

    (prisma.tarifa.findFirst as any).mockResolvedValue(mockTarifa());
    (prisma.promocion.findFirst as any).mockResolvedValue(mockPromocion({ fechaFin: ayer }));

    await expect(calcularValor({ tarifaId: 1, promocionId: 10, cantidadPasajeros: 1 })).rejects.toThrow(/vencida/i);
  });

  it('lanza error si la tarifa está inactiva', async () => {
    (prisma.tarifa.findFirst as any).mockResolvedValue(null); // el where filtra activo:true

    await expect(calcularValor({ tarifaId: 999, cantidadPasajeros: 1 })).rejects.toThrow(/Tarifa no encontrada o inactiva/);
  });

  it('redondea a 2 decimales', async () => {
    // precio 33333.33 × 3 pasajeros con 7% → decimales flotantes
    (prisma.tarifa.findFirst as any).mockResolvedValue(mockTarifa({ precio: { toString: () => '33333.33' } }));
    (prisma.promocion.findFirst as any).mockResolvedValue(mockPromocion({ valor: { toString: () => '7' } }));

    const r = await calcularValor({ tarifaId: 1, promocionId: 10, cantidadPasajeros: 3 });

    expect(r.precioBase).toBeCloseTo(99999.99, 2);
    // descuento 7% de 99999.99 = 6999.9993 → redondeado a 7000
    expect(r.descuento).toBe(7000);
    expect(Number.isInteger(Math.round(r.descuento * 100))).toBe(true);
    expect(Number.isInteger(Math.round(r.valorTotal * 100))).toBe(true);
    // 99999.99 − 7000 = 92999.99
    expect(r.valorTotal).toBe(92999.99);
  });
});
