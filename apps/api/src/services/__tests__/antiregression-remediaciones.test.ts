import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks globales
// ---------------------------------------------------------------------------
const mockOpenMeteo = vi.fn();
vi.mock('../openMeteo.service', () => ({
  obtenerOpenMeteo: (...args: any[]) => mockOpenMeteo(...args),
  gradosADireccion: vi.fn((g: number | null | undefined) => (g != null ? 'SO' : null)),
  estimarTechoNubes: vi.fn(() => 2000),
}));

vi.mock('../auditoria.service', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../eventos.service', () => ({
  broadcastDatos: vi.fn(),
  broadcastModulos: vi.fn(),
  broadcast: vi.fn(),
  subscribe: vi.fn(),
}));

vi.mock('../../plugins/prisma', () => {
  const mockVuelo = {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn(),
  };

  const mockReserva = {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn(),
  };

  const mockPasajero = {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  };

  const mockCondicionPista = {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
  };

  const mockEquipo = {
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };

  const mockPiloto = {
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
  };

  const mockPantallaToken = {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
  };

  const mockPlantillaMensaje = {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    count: vi.fn(),
  };

  const mockUser = {
    findFirst: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
  };

  const prismaMock = {
    vuelo: mockVuelo,
    reserva: mockReserva,
    pasajero: mockPasajero,
    condicionPista: mockCondicionPista,
    equipo: mockEquipo,
    piloto: mockPiloto,
    pantallaToken: mockPantallaToken,
    plantillaMensaje: mockPlantillaMensaje,
    user: mockUser,
    pago: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { monto: 0 } }),
    },
    $transaction: vi.fn(async (cb: any) => cb(prismaMock)),
  };

  return { prisma: prismaMock };
});

import { prisma } from '../../plugins/prisma';
import { MeteorologiaService } from '../meteorologia.service';
import { PublicService } from '../public.service';
import { getAllReservas } from '../reservas/reservas.query';
import { getAllVuelos } from '../vuelos/vuelos.crud';
import { EquiposService } from '../equipos.service';
import { VuelosController } from '../../controllers/vuelos.controller';
import { updateReserva } from '../reservas/reservas.crud';
import { PantallaTokensService } from '../pantallaTokens.service';
import { PlantillasService } from '../plantillas.service';
import { resolverConfiguracion, dateKeyLocal } from '@parapente/shared';

describe('Suite de Pruebas Antiregresión — Parches de Remediación (C-01 a C-08 y A-01)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // C-01: Seguridad Operacional de Pista y Clima en Pantalla
  // =========================================================================
  describe('C-01: Meteorología y Pista Operacional', () => {
    let metService: MeteorologiaService;

    beforeEach(() => {
      metService = new MeteorologiaService();
    });

    it('deriva estado CERRADA si la velocidad del viento es >= 35 km/h', async () => {
      mockOpenMeteo.mockResolvedValue({
        current: {
          time: new Date().toISOString(),
          wind_speed_10m: 35.5,
          wind_gusts_10m: 20,
          wind_direction_10m: 180,
          temperature_2m: 20,
          cloud_cover: 10,
        },
      });
      (prisma.condicionPista.findFirst as any).mockResolvedValue(null);

      const pronostico = await metService.obtenerPronosticoOpenMeteo();
      expect(pronostico.estadoPista).toBe('CERRADA');
    });

    it('deriva estado CERRADA si la racha del viento es >= 45 km/h', async () => {
      mockOpenMeteo.mockResolvedValue({
        current: {
          time: new Date().toISOString(),
          wind_speed_10m: 20,
          wind_gusts_10m: 46,
          wind_direction_10m: 180,
          temperature_2m: 20,
          cloud_cover: 10,
        },
      });
      (prisma.condicionPista.findFirst as any).mockResolvedValue(null);

      const pronostico = await metService.obtenerPronosticoOpenMeteo();
      expect(pronostico.estadoPista).toBe('CERRADA');
    });

    it('deriva estado PRECAUCION si viento >= 25 km/h o racha >= 35 km/h', async () => {
      mockOpenMeteo.mockResolvedValue({
        current: {
          time: new Date().toISOString(),
          wind_speed_10m: 26,
          wind_gusts_10m: 30,
          wind_direction_10m: 180,
          temperature_2m: 20,
          cloud_cover: 10,
        },
      });
      (prisma.condicionPista.findFirst as any).mockResolvedValue(null);

      const pronostico = await metService.obtenerPronosticoOpenMeteo();
      expect(pronostico.estadoPista).toBe('PRECAUCION');
    });

    it('respeta el estado manual de pista CERRADA si el director lo configuró, ignorando viento calmo', async () => {
      mockOpenMeteo.mockResolvedValue({
        current: {
          time: new Date().toISOString(),
          wind_speed_10m: 10,
          wind_gusts_10m: 15,
          wind_direction_10m: 180,
          temperature_2m: 22,
          cloud_cover: 5,
        },
      });
      // El director ingresó un registro manual CERRADA
      (prisma.condicionPista.findFirst as any).mockResolvedValue({
        id: 1,
        estadoPista: 'CERRADA',
        registradoPor: 'Director de Vuelo',
      });

      const pronostico = await metService.obtenerPronosticoOpenMeteo();
      expect(pronostico.estadoPista).toBe('CERRADA');
    });

    it('PublicService.getPantalla retorna clima null cuando no hay registro en DB (sin clima falso)', async () => {
      const pubService = new PublicService();
      (prisma.pantallaToken.findUnique as any).mockResolvedValue({
        tipo: 'DIARIO',
        expiraEn: new Date(Date.now() + 3600000),
      });
      (prisma.condicionPista.findFirst as any).mockResolvedValue(null);
      (prisma.vuelo.findMany as any).mockResolvedValue([]);

      const data = await pubService.getPantalla('token-valido-123');
      expect(data.clima).toBeNull();
    });
  });

  // =========================================================================
  // C-02: Eliminación de Respuestas Falsas HTTP 200 [] ante Caídas de BD
  // =========================================================================
  describe('C-02: Fail-Fast en Servicios ante Caídas de Base de Datos', () => {
    let consoleErrorSpy: any;

    beforeEach(() => {
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('getAllReservas relanza el error si la base de datos falla', async () => {
      (prisma.reserva.findMany as any).mockRejectedValue(new Error('Connection lost to Postgres'));
      await expect(getAllReservas()).rejects.toThrow('Connection lost to Postgres');
    });

    it('getAllVuelos relanza el error si la base de datos falla', async () => {
      (prisma.vuelo.findMany as any).mockRejectedValue(new Error('DB Timeout'));
      await expect(getAllVuelos()).rejects.toThrow('DB Timeout');
    });

    it('EquiposService.getAll relanza el error si la base de datos falla', async () => {
      const equiposService = new EquiposService();
      (prisma.equipo.findMany as any).mockRejectedValue(
        new Error('Postgres connection pool exhausted'),
      );
      await expect(equiposService.getAll()).rejects.toThrow('Postgres connection pool exhausted');
    });
  });

  // =========================================================================
  // C-03: Control de Acceso RBAC en Vuelos (Pilotos solo editan sus propios vuelos)
  // =========================================================================
  describe('C-03: RBAC en VuelosController', () => {
    let controller: VuelosController;

    beforeEach(() => {
      controller = new VuelosController();
    });

    it('rechaza con 403 si un usuario con rol PILOTO intenta actualizar un vuelo asignado a otro piloto', async () => {
      const req: any = {
        params: { id: '99' },
        body: { estado: 'EN_VUELO', version: 1 },
        user: { role: 'PILOTO', pilotoId: 5 },
      };
      const reply: any = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      // El vuelo #99 pertenece al pilotoId 10, no al pilotoId 5
      (prisma.vuelo.findFirst as any).mockResolvedValue({ pilotoId: 10 });

      await controller.updateEstado(req, reply);

      expect(reply.code).toHaveBeenCalledWith(403);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Forbidden',
          message: 'Un piloto solo puede actualizar el estado de sus propios vuelos.',
        }),
      );
    });

    it('permite a un usuario con rol PILOTO actualizar el estado de su propio vuelo', async () => {
      const req: any = {
        params: { id: '99' },
        body: { estado: 'EN_VUELO', version: 1 },
        user: { role: 'PILOTO', pilotoId: 10 },
      };
      const reply: any = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      (prisma.vuelo.findFirst as any).mockResolvedValue({ pilotoId: 10 });
      (prisma.vuelo.update as any).mockResolvedValue({ id: 99, estado: 'EN_VUELO' });

      // Mock updateEstado en service
      const vuelosServiceMod = await import('../vuelos.service');
      vi.spyOn(vuelosServiceMod.vuelosService, 'updateEstado').mockResolvedValue({
        id: 99,
        estado: 'EN_VUELO',
      } as any);

      await controller.updateEstado(req, reply);

      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({ id: 99, estado: 'EN_VUELO' }),
      );
    });
  });

  // =========================================================================
  // C-04: Limpieza de Vuelos Huérfanos al Eliminar Pasajeros en updateReserva
  // =========================================================================
  describe('C-04: Limpieza de Vuelos al Remover Pasajeros en updateReserva', () => {
    it('cancela y soft-deletea los vuelos activos de los pasajeros eliminados', async () => {
      const existingReserva = {
        id: 1,
        version: 0,
        estado: 'AGENDADA',
        numeroReserva: '260915-01',
        valorTotal: 100000,
        abono: 50000,
        montoDevuelto: 0,
        pasajeros: [
          { id: 10, numeroPasajero: '260915-01-01', nombre: 'Pasajero Uno' },
          { id: 20, numeroPasajero: '260915-01-02', nombre: 'Pasajero Dos' },
        ],
      };

      (prisma.reserva.findUnique as any).mockImplementation(({ include }: any) => {
        if (include) return Promise.resolve(existingReserva);
        return Promise.resolve(existingReserva);
      });
      (prisma.reserva.updateMany as any).mockResolvedValue({ count: 1 });
      (prisma.pasajero.findMany as any).mockResolvedValue(existingReserva.pasajeros);
      (prisma.pasajero.update as any).mockResolvedValue({ id: 10 });
      (prisma.pasajero.updateMany as any).mockResolvedValue({ count: 1 });
      (prisma.vuelo.updateMany as any).mockResolvedValue({ count: 1 });

      // Se actualiza la reserva conservando solo al pasajero id: 10 (se elimina el id: 20)
      await updateReserva(1, {
        version: 0,
        pasajeros: [{ id: 10, nombre: 'Pasajero Uno' }],
      } as any);

      // Verificación de que el vuelo del pasajero 20 fue cancelado y soft-deleted
      expect(prisma.vuelo.updateMany).toHaveBeenCalledWith({
        where: {
          pasajeroId: { in: [20] },
          deletedAt: null,
          estado: { not: 'COMPLETADO' },
        },
        data: expect.objectContaining({
          estado: 'CANCELADO',
          deletedAt: expect.any(Date),
          version: { increment: 1 },
        }),
      });

      // Verificación de soft-delete del pasajero 20
      expect(prisma.pasajero.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [20] }, deletedAt: null },
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      });
    });
  });

  // =========================================================================
  // C-05: Vigencia y Revocación de Tokens DIARIO en PantallaTokensService
  // =========================================================================
  describe('C-05: PantallaTokensService - Tokens DIARIO', () => {
    let tokensService: PantallaTokensService;

    beforeEach(() => {
      tokensService = new PantallaTokensService();
    });

    it('getOrCreate reutiliza el token existente cuando expiraEn > ahora (sin crear duplicados)', async () => {
      const ahora = new Date();
      const expiraEn = new Date(ahora.getTime() + 10 * 3600 * 1000); // 10 horas en el futuro

      (prisma.pantallaToken.findFirst as any).mockResolvedValue({
        id: 1,
        token: 'token-diario-existente-64-hex',
        expiraEn,
      });

      const res = await tokensService.getOrCreate('DIARIO');

      expect(res.token).toBe('token-diario-existente-64-hex');
      expect(prisma.pantallaToken.create).not.toHaveBeenCalled();
    });

    it('regenerar revoca tokens vigentes comparando expiraEn > ahora', async () => {
      (prisma.pantallaToken.updateMany as any).mockResolvedValue({ count: 1 });
      (prisma.pantallaToken.create as any).mockResolvedValue({
        id: 2,
        token: 'nuevo-token',
        expiraEn: new Date(),
      });

      await tokensService.regenerar('DIARIO');

      expect(prisma.pantallaToken.updateMany).toHaveBeenCalledWith({
        where: {
          tipo: 'DIARIO',
          expiraEn: { gt: expect.any(Date) },
        },
        data: { expiraEn: expect.any(Date) },
      });
    });
  });

  // =========================================================================
  // C-07: Protección contra Colisiones P2002 en Soft-Delete de PlantillaMensaje
  // =========================================================================
  describe('C-07: PlantillasService.initSeeds con Soft-Delete', () => {
    it('initSeeds busca con findUnique sin filtrar deletedAt: null para evitar P2002', async () => {
      const plantillasService = new PlantillasService();

      // findUnique encuentra el registro incluso si está soft-deleted
      (prisma.plantillaMensaje.findUnique as any).mockResolvedValue({
        id: 1,
        tipo: 'CONFIRMACION_RESERVA',
        deletedAt: new Date(),
      });

      await plantillasService.initSeeds();

      expect(prisma.plantillaMensaje.findUnique).toHaveBeenCalled();
      // Al haber encontrado la plantilla, NO debe intentar crearla de nuevo
      expect(prisma.plantillaMensaje.create).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // C-08 y A-01: Fail-Fast en Índices y Corrección de Zona Horaria en Bloques
  // =========================================================================
  describe('C-08 & A-01: Timezone en Bloques y Fail-Fast', () => {
    it('resolverConfiguracion evalúa fecha de hoy usando dateKeyLocal() y no new Date().toISOString()', () => {
      const hoyChile = dateKeyLocal();

      const configActiva = {
        id: 1,
        nombre: 'Bloque Horario Hoy',
        bloqueado: false,
        archivada: false,
        horarios: [{ horaInicio: '09:00', horaFin: '10:00' }],
      };

      // Si consultamos el día actual de Chile (hoyChile), no debe considerarse como pasada
      const res = resolverConfiguracion([configActiva], hoyChile);
      expect(res).not.toBeNull();
      expect(res?.id).toBe(1);
    });

    it('resolverConfiguracion descarta configs archivadas para hoy/futuro pero las conserva para pasado', () => {
      const hoyChile = dateKeyLocal();
      const pasado = '2020-01-01';

      const configArchivada = {
        id: 2,
        nombre: 'Bloque Histórico Archivado',
        bloqueado: false,
        archivada: true,
        archivadaEn: new Date('2025-01-01'),
        horarios: [{ horaInicio: '09:00', horaFin: '10:00' }],
      };

      // Para hoy, la archivada no aplica
      const resHoy = resolverConfiguracion([configArchivada], hoyChile);
      expect(resHoy).toBeNull();

      // Para una fecha anterior a su archivo (2020-01-01), la archivada sí aplica (snapshot)
      const resPasado = resolverConfiguracion([configArchivada], pasado);
      expect(resPasado).not.toBeNull();
      expect(resPasado?.id).toBe(2);
    });
  });
});
