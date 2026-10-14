import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PilotosService } from '../pilotos.service';
import { prisma } from '../../plugins/prisma';

vi.mock('../../plugins/prisma', () => ({
  prisma: {
    piloto: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    pasajero: {
      findUnique: vi.fn(),
    },
  },
}));

describe('PilotosService', () => {
  let service: PilotosService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PilotosService();
  });

  describe('getAll', () => {
    it('debería retornar pilotos con parámetros por defecto', async () => {
      const mockPilotos = [
        { id: 1, nombre: 'Piloto 1' },
        { id: 2, nombre: 'Piloto 2' },
      ];
      (prisma.piloto.findMany as any).mockResolvedValue(mockPilotos);
      (prisma.piloto.count as any).mockResolvedValue(2);

      const result = await service.getAll();

      expect(prisma.piloto.findMany).toHaveBeenCalledWith({
        where: { deletedAt: null },
        orderBy: { prioridad: 'asc' },
        skip: 0,
        take: 100, // Default PAGE_SIZE_DEFAULT from pagination.util is 100
      });
      expect(prisma.piloto.count).toHaveBeenCalledWith({
        where: { deletedAt: null },
      });
      expect(result.data).toEqual(mockPilotos);
      expect(result.pagination).toEqual({
        page: 1,
        pageSize: 100, // Default pageSize
        total: 2,
        totalPages: 1,
        hasMore: false,
        nextPage: null,
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
              { telefono: { contains: 'juan', mode: 'insensitive' } },
            ],
          },
        }),
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
            activo: true,
          },
        }),
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
            activo: false,
          },
        }),
      );
    });

    it('debería aplicar ordenamiento (sort)', async () => {
      (prisma.piloto.findMany as any).mockResolvedValue([]);
      (prisma.piloto.count as any).mockResolvedValue(0);

      await service.getAll({ sort: 'nombre.desc' });

      expect(prisma.piloto.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { nombre: 'desc' },
        }),
      );
    });

    it('debería ignorar ordenamiento inválido y usar fallback', async () => {
      (prisma.piloto.findMany as any).mockResolvedValue([]);
      (prisma.piloto.count as any).mockResolvedValue(0);

      await service.getAll({ sort: 'invalidField.desc' });

      expect(prisma.piloto.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { prioridad: 'asc' },
        }),
      );
    });

    it('debería retornar fallback en caso de error de base de datos', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      (prisma.piloto.count as any).mockRejectedValue(new Error('DB Error'));

      const result = await service.getAll();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Advertencia DB en PilotosService.getAll, retornando arreglo vacío:',
        expect.any(Error),
      );
      expect(result).toEqual({
        data: [],
        pagination: { page: 1, pageSize: 100, total: 0, totalPages: 0, hasMore: false },
      });

      consoleWarnSpy.mockRestore();
    });
  });

  describe('sugerirPiloto — antirregresión A-02', () => {
    it('descarta pilotos fuera de su bloque horario habilitado y pilotos con vuelo en la misma hora', async () => {
      const fechaHoraTarget = '2026-10-14T14:00:00-03:00';
      const targetDate = new Date(fechaHoraTarget);

      // Piloto 1: restringido a bloque matutino (09:00 - 13:00)
      const pilotoFueraDeBloque = {
        id: 1,
        nombre: 'Piloto Matutino',
        activo: true,
        tieneLicencia: true,
        disponibilidadTotal: true,
        pesoMinimoPasajero: 40,
        pesoMaximoPasajero: 100,
        excepciones: [],
        disponibilidadBloques: [{ horaInicio: '09:00', horaFin: '13:00' }],
        vuelos: [],
      };

      // Piloto 2: bloque vespertino (13:00 - 18:00), pero ya tiene un vuelo a las 14:00
      const pilotoOcupado = {
        id: 2,
        nombre: 'Piloto Ocupado',
        activo: true,
        tieneLicencia: true,
        disponibilidadTotal: true,
        pesoMinimoPasajero: 40,
        pesoMaximoPasajero: 100,
        excepciones: [],
        disponibilidadBloques: [{ horaInicio: '13:00', horaFin: '18:00' }],
        vuelos: [{ fechaHora: targetDate, estado: 'AGENDADO' }],
      };

      // Piloto 3: bloque vespertino (13:00 - 18:00) y disponible
      const pilotoDisponible = {
        id: 3,
        nombre: 'Piloto Libre',
        activo: true,
        tieneLicencia: true,
        disponibilidadTotal: true,
        pesoMinimoPasajero: 40,
        pesoMaximoPasajero: 100,
        excepciones: [],
        disponibilidadBloques: [{ horaInicio: '13:00', horaFin: '18:00' }],
        vuelos: [],
      };

      (prisma.piloto.findMany as any).mockResolvedValue([
        pilotoFueraDeBloque,
        pilotoOcupado,
        pilotoDisponible,
      ]);

      const resultado = await service.sugerirPiloto({
        fechaHora: fechaHoraTarget,
        pesoPasajero: 70,
      });

      expect(resultado.candidatos).toHaveLength(3);

      const p1 = resultado.candidatos.find((c) => c.id === 1);
      expect(p1?.estaDisponible).toBe(false);
      expect(p1?.motivo).toContain('Fuera de bloque horario habilitado');

      const p2 = resultado.candidatos.find((c) => c.id === 2);
      expect(p2?.estaDisponible).toBe(false);
      expect(p2?.motivo).toContain('Ocupado en el bloque');

      const p3 = resultado.candidatos.find((c) => c.id === 3);
      expect(p3?.estaDisponible).toBe(true);
      expect(p3?.motivo).toBe('Disponible para asignación');
      expect(resultado.pilotoRecomendado?.id).toBe(3);
    });
  });
});
