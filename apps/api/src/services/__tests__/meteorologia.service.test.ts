import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MeteorologiaService } from '../meteorologia.service';

vi.mock('../../plugins/prisma', () => {
  return {
    prisma: {
      condicionPista: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
      },
    },
  };
});

import { prisma } from '../../plugins/prisma';

describe('Meteorologia & Runway Status Service (Unit Tests)', () => {
  let service: MeteorologiaService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new MeteorologiaService();
  });

  it('getUltimoEstado debería retornar el último registro de la base de datos', async () => {
    const mockEstado = {
      id: 1,
      fechaHora: new Date(),
      estadoPista: 'PRECAUCION',
      velocidadViento: 22,
      rachaViento: 28,
      direccionViento: 'NO',
      temperatura: 19,
      visibilidad: 'BUENA',
      observaciones: 'Viento arrachado del noroeste',
      registradoPor: 'Director de Vuelo',
    };

    (prisma.condicionPista.findFirst as any).mockResolvedValue(mockEstado);

    const res = await service.getUltimoEstado();
    expect(res.estadoPista).toBe('PRECAUCION');
    expect(res.velocidadViento).toBe(22);
  });

  it('registrar debería guardar un nuevo reporte meteorológico', async () => {
    (prisma.condicionPista.create as any).mockResolvedValue({
      id: 2,
      estadoPista: 'CERRADA',
      velocidadViento: 38,
      rachaViento: 45,
      direccionViento: 'N',
      observaciones: 'Pista cerrada por viento que excede el límite operacional',
    });

    const res = await service.registrar({
      estadoPista: 'CERRADA',
      velocidadViento: 38,
      rachaViento: 45,
      direccionViento: 'N',
      observaciones: 'Pista cerrada por viento que excede el límite operacional',
    });

    expect(prisma.condicionPista.create).toHaveBeenCalled();
    expect(res.estadoPista).toBe('CERRADA');
  });
});
