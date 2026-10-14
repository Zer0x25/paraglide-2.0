import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlantillasController } from '../plantillas.controller';
import { plantillasService } from '../../services/plantillas.service';
import { ZodError } from 'zod';

vi.mock('../../services/plantillas.service', () => ({
  plantillasService: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    render: vi.fn(),
  },
}));

vi.mock('../../services/pantallaTokens.service', () => ({
  pantallaTokensService: {},
}));

describe('PlantillasController — Anti-regresión M-03 (Validación Zod en update)', () => {
  let controller: PlantillasController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new PlantillasController();
  });

  it('valida exitosamente un payload parcial válido y delega a plantillasService.update', async () => {
    const mockReply = {
      send: vi.fn().mockImplementation((val) => val),
    } as any;

    const mockReq = {
      params: { id: '12' },
      body: {
        titulo: 'Título Actualizado',
        activo: false,
      },
    } as any;

    vi.mocked(plantillasService.update).mockResolvedValueOnce({
      id: 12,
      tipo: 'RECORDATORIO_24H',
      titulo: 'Título Actualizado',
      canal: 'WHATSAPP',
      cuerpo: 'Hola',
      variables: null,
      activo: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });

    await controller.update(mockReq, mockReply);

    expect(plantillasService.update).toHaveBeenCalledWith(12, {
      titulo: 'Título Actualizado',
      activo: false,
    });
    expect(mockReply.send).toHaveBeenCalled();
  });

  it('lanza ZodError si el payload contiene valores inválidos (ej. canal no permitido)', async () => {
    const mockReply = {
      send: vi.fn(),
    } as any;

    const mockReq = {
      params: { id: '12' },
      body: {
        canal: 'CANAL_INVENTADO', // No pertenece a enum CanalMensaje ('WHATSAPP' | 'EMAIL' | 'SMS')
      },
    } as any;

    await expect(controller.update(mockReq, mockReply)).rejects.toThrow(
      /Invalid enum value.*CANAL_INVENTADO/,
    );
    expect(plantillasService.update).not.toHaveBeenCalled();
  });
});
