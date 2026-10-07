import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PilotosService } from '../pilotos.service';
import { prisma } from '../../plugins/prisma';

vi.mock('../../plugins/prisma', () => ({
  prisma: {
    piloto: {
      findMany: vi.fn(),
      count: vi.fn(),
    }
  }
}));

describe('PilotosService', () => {
  let service: PilotosService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PilotosService();
  });

  describe('getAll', () => {
    it('debería retornar pilotos con parámetros por defecto', async () => {
      const mockPilotos = [{ id: 1, nombre: 'Piloto 1' }, { id: 2, nombre: 'Piloto 2' }];
      (prisma.piloto.findMany as any).mockResolvedValue(mockPilotos);
      (prisma.piloto.count as any).mockResolvedValue(2);

      const result = await service.getAll();

      expect(prisma.piloto.findMany).toHaveBeenCalledWith({
        where: { deletedAt: null },
        orderBy: { prioridad: 'asc' },
        skip: 0,
        take: 100 // Default PAGE_SIZE_DEFAULT from pagination.util is 100
      });
      expect(prisma.piloto.count).toHaveBeenCalledWith({
        where: { deletedAt: null }
      });
      expect(result.data).toEqual(mockPilotos);
      expect(result.pagination).toEqual({
        page: 1,
        pageSize: 100, // Default pageSize
        total: 2,
        totalPages: 1,
        hasMore: false,
        nextPage: null
      });
    });

    it('debería aplicar filtro de búsqueda (q)', async () => {
      (prisma.piloto.findMany as any).mockResolvedValue([]);
      (prisma.piloto.count as any).mockResolvedValue(0);

      await service.getAll({ q: ' juan ' });

      expect(prisma.piloto.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            deletedAt: null,
            OR: [
              { nombre: { contains: 'juan', mode: 'insensitive' } },
              { email: { contains: 'juan', mode: 'insensitive' } },
              { telefono: { contains: 'juan', mode: 'insensitive' } }
            ]
          }
        })
      );
    });

    it('debería aplicar filtro activo (true)', async () => {
      (prisma.piloto.findMany as any).mockResolvedValue([]);
      (prisma.piloto.count as any).mockResolvedValue(0);

      await service.getAll({ activo: 'true' });

      expect(prisma.piloto.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            deletedAt: null,
            activo: true
          }
        })
      );
    });

    it('debería aplicar filtro activo (false)', async () => {
      (prisma.piloto.findMany as any).mockResolvedValue([]);
      (prisma.piloto.count as any).mockResolvedValue(0);

      await service.getAll({ activo: 'false' });

      expect(prisma.piloto.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            deletedAt: null,
            activo: false
          }
        })
      );
    });

    it('debería aplicar ordenamiento (sort)', async () => {
      (prisma.piloto.findMany as any).mockResolvedValue([]);
      (prisma.piloto.count as any).mockResolvedValue(0);

      await service.getAll({ sort: 'nombre.desc' });

      expect(prisma.piloto.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { nombre: 'desc' }
        })
      );
    });

    it('debería ignorar ordenamiento inválido y usar fallback', async () => {
      (prisma.piloto.findMany as any).mockResolvedValue([]);
      (prisma.piloto.count as any).mockResolvedValue(0);

      await service.getAll({ sort: 'invalidField.desc' });

      expect(prisma.piloto.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { prioridad: 'asc' }
        })
      );
    });

    it('debería retornar fallback en caso de error de base de datos', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      (prisma.piloto.count as any).mockRejectedValue(new Error('DB Error'));

      const result = await service.getAll();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Advertencia DB en PilotosService.getAll, retornando arreglo vacío:',
        expect.any(Error)
      );
      expect(result).toEqual({
        data: [],
        pagination: { page: 1, pageSize: 100, total: 0, totalPages: 0, hasMore: false }
      });

      consoleWarnSpy.mockRestore();
    });
  });
});
