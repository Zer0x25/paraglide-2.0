import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlantillasService } from '../plantillas.service';

vi.mock('../../plugins/prisma', () => {
  return {
    prisma: {
      plantillaMensaje: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    },
  };
});

import { prisma } from '../../plugins/prisma';

describe('Plantillas & Messaging Service (Unit Tests)', () => {
  let service: PlantillasService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PlantillasService();
  });

  it('render debería reemplazar todas las variables dinámicas correctamente', () => {
    const template = 'Hola {{nombre}}, tu vuelo es el {{fecha}} a las {{hora}}. Saldo: {{saldo}}';
    const result = service.render(template, {
      nombre: 'Camila',
      fecha: '15/08/2026',
      hora: '11:00',
      saldo: '$0',
    });

    expect(result).toBe('Hola Camila, tu vuelo es el 15/08/2026 a las 11:00. Saldo: $0');
  });

  it('render no debe lanzar ni corromper el texto con claves con meta-caracteres regex', () => {
    const template = 'Hola {{a.b}}, total {{precio(taxa)}}';
    const result = service.render(template, { 'a.b': 'X', 'precio(taxa)': '100' });

    expect(result).toBe('Hola X, total 100');
  });

  it('render debe dejar intactas las variables desconocidas', () => {
    const template = 'Hola {{nombre}} {{link_pantalla}}';
    const result = service.render(template, { nombre: 'Camila' });

    expect(result).toBe('Hola Camila {{link_pantalla}}');
  });

  it('getAll debería retornar las plantillas registradas', async () => {
    (prisma.plantillaMensaje.findFirst as any).mockResolvedValue({ id: 1 });
    (prisma.plantillaMensaje.findMany as any).mockResolvedValue([
      { id: 1, tipo: 'CONFIRMACION_RESERVA', titulo: 'Confirmación' },
    ]);
    (prisma.plantillaMensaje.count as any).mockResolvedValue(1);

    const res = await service.getAll();
    expect(res.data.length).toBe(1);
    expect(res.data[0].tipo).toBe('CONFIRMACION_RESERVA');
    expect(res.pagination.total).toBe(1);
  });
});
