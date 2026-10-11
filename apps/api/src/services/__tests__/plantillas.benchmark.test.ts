import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlantillasService } from '../plantillas.service';
import { prisma } from '../../plugins/prisma';

vi.mock('../../plugins/prisma', () => {
  return {
    prisma: {
      plantillaMensaje: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        createMany: vi.fn(),
      },
    },
  };
});

describe('Plantillas & Messaging Service Benchmark', () => {
  let service: PlantillasService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PlantillasService();
  });

  it('measures the number of database calls after optimization (when none exist)', async () => {
    (prisma.plantillaMensaje.findMany as any).mockResolvedValue([]);
    await service.initSeeds();

    // 1 findMany call and 6 create calls = 7 total calls
    expect(prisma.plantillaMensaje.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.plantillaMensaje.create).toHaveBeenCalledTimes(6);
  });

  it('measures the number of database calls after optimization (when all exist)', async () => {
    // Mocking all templates as existing
    (prisma.plantillaMensaje.findMany as any).mockResolvedValue([
      { tipo: 'CONFIRMACION_RESERVA' },
      { tipo: 'RECORDATORIO_24H' },
      { tipo: 'SOLICITUD_DESLINDE' },
      { tipo: 'AGRADECIMIENTO_RESEÑA' },
      { tipo: 'AVISO_CLIMA_CANCELACION' },
      { tipo: 'ENLACE_PANTALLA_DIA' }
    ]);
    await service.initSeeds();

    // 1 findMany call and 0 create calls = 1 total call
    expect(prisma.plantillaMensaje.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.plantillaMensaje.create).toHaveBeenCalledTimes(0);
  });
});
