import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import metricasRoutes from '../metricas.routes';

vi.mock('../../plugins/prisma', () => {
  return {
    prisma: {
      vuelo: {
        groupBy: vi.fn(),
        aggregate: vi.fn(),
      },
      gasto: {
        groupBy: vi.fn(),
        aggregate: vi.fn(),
      },
      piloto: {
        findMany: vi.fn(),
      },
      $queryRaw: vi.fn(),
    },
  };
});

import { prisma } from '../../plugins/prisma';

describe('Metricas Routes (Unit Tests)', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify();
    await app.register(metricasRoutes, { prefix: '/metricas' });
    await app.ready();
  });

  it('GET /metricas/financiero - calcula métricas financieras correctamente en paralelo', async () => {
    (prisma.vuelo.groupBy as any)
      .mockResolvedValueOnce([
        { estado: 'COMPLETADO', _count: { _all: 10 } },
        { estado: 'CANCELADO', _count: { _all: 2 } },
      ])
      .mockResolvedValueOnce([
        {
          pilotoId: 1,
          _count: { _all: 10 },
          _sum: { valorPactado: 500000, pagoPiloto: 200000 },
        },
      ]);

    (prisma.vuelo.aggregate as any).mockResolvedValue({
      _count: { _all: 10 },
      _sum: { valorPactado: 500000, pagoPiloto: 200000 },
    });

    (prisma.gasto.groupBy as any).mockResolvedValue([
      { categoria: 'COMBUSTIBLE', _sum: { monto: 50000 } },
    ]);

    (prisma.gasto.aggregate as any).mockResolvedValue({
      _sum: { monto: 50000 },
    });

    (prisma.$queryRaw as any).mockResolvedValue([
      { dia: new Date('2026-10-10T03:00:00.000Z'), estado: 'COMPLETADO', cnt: 10 },
    ]);

    (prisma.piloto.findMany as any).mockResolvedValue([{ id: 1, nombre: 'Piloto Halcon' }]);

    const res = await app.inject({
      method: 'GET',
      url: '/metricas/financiero?month=9&year=2026',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);

    expect(body.ingresosTotales).toBe(500000);
    expect(body.pagosPilotos).toBe(200000);
    expect(body.gastosOperativos).toBe(50000);
    expect(body.pagoEscuela).toBe(250000);
    expect(body.totalCompletados).toBe(10);
    expect(body.pilotosTop).toHaveLength(1);
    expect(body.pilotosTop[0].nombre).toBe('Piloto Halcon');
  });
});
