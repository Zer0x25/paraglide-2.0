import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  actualizarEstadoPasajerosReserva,
  cancelarReserva,
  desagendarReserva,
  deleteReserva,
  cerrarReservaContable,
  reabrirReservaContable,
} from '../reservas/reservas.ciclo-vida';
import { Prisma } from '@prisma/client';
import { ConflictError, checkVersion } from '../concurrencia.service';
import { broadcastDatos } from '../eventos.service';
import { googleCalendarService } from '../google-calendar.service';

const { mockTx, prismaMock } = vi.hoisted(() => {
  const mockTx: any = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    reserva: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    vuelo: {
      updateMany: vi.fn(),
    },
    pasajero: {
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    devolucion: {
      create: vi.fn(),
      aggregate: vi.fn(),
      updateMany: vi.fn(),
    },
    pago: {
      aggregate: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  };

  const prismaMock: any = {
    $transaction: vi.fn(async (cb: any) => cb(mockTx)),
    $queryRaw: mockTx.$queryRaw,
    reserva: mockTx.reserva,
    vuelo: mockTx.vuelo,
    pasajero: mockTx.pasajero,
    devolucion: mockTx.devolucion,
    pago: mockTx.pago,
  };

  return { mockTx, prismaMock };
});

vi.mock('../../plugins/prisma', () => ({
  prisma: prismaMock,
  mockTx,
}));

vi.mock('../concurrencia.service', async () => {
  const actual =
    await vi.importActual<typeof import('../concurrencia.service')>('../concurrencia.service');
  return {
    ...actual,
    checkVersion: vi.fn((actualVer: number, sent?: number | null, msg?: string) => {
      return actual.checkVersion(actualVer, sent, msg);
    }),
  };
});

vi.mock('../eventos.service', () => ({
  broadcastDatos: vi.fn(),
}));

vi.mock('../google-calendar.service', () => ({
  googleCalendarService: {
    syncReservaVuelosDeleted: vi.fn().mockResolvedValue(undefined),
  },
}));

import { prisma } from '../../plugins/prisma';

describe('Reservas Ciclo de Vida - Suite Consolidada', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.$transaction as any).mockImplementation(async (cb: any) => cb(mockTx));
  });

  describe('actualizarEstadoPasajerosReserva', () => {
    it('Lanza error si la reserva no es encontrada', async () => {
      const mockTx = {
        $queryRaw: vi.fn(),
        reserva: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      };
      (prisma.$transaction as any).mockImplementation(async (cb: any) => cb(mockTx));

      await expect(actualizarEstadoPasajerosReserva(1, { pasajeros: [] })).rejects.toThrow(
        'Reserva no encontrada',
      );
    });

    it('Lanza error si la reserva ya está cerrada contablemente', async () => {
      const mockTx = {
        $queryRaw: vi.fn(),
        reserva: {
          findFirst: vi.fn().mockResolvedValue({
            id: 1,
            cerradaAt: new Date(),
          }),
        },
      };
      (prisma.$transaction as any).mockImplementation(async (cb: any) => cb(mockTx));

      await expect(actualizarEstadoPasajerosReserva(1, { pasajeros: [] })).rejects.toThrow(
        'No se pueden modificar los pasajeros de una reserva cerrada contablemente',
      );
    });

    it('Lanza error si el estado de la reserva es CANCELADA', async () => {
      const mockTx = {
        $queryRaw: vi.fn(),
        reserva: {
          findFirst: vi.fn().mockResolvedValue({
            id: 1,
            cerradaAt: null,
            estado: 'CANCELADA',
          }),
        },
      };
      (prisma.$transaction as any).mockImplementation(async (cb: any) => cb(mockTx));

      await expect(actualizarEstadoPasajerosReserva(1, { pasajeros: [] })).rejects.toThrow(
        'No se puede marcar el estado de vuelo de una reserva cancelada o completada',
      );
    });

    it('Lanza error si el estado de la reserva es COMPLETADA', async () => {
      const mockTx = {
        $queryRaw: vi.fn(),
        reserva: {
          findFirst: vi.fn().mockResolvedValue({
            id: 1,
            cerradaAt: null,
            estado: 'COMPLETADA',
          }),
        },
      };
      (prisma.$transaction as any).mockImplementation(async (cb: any) => cb(mockTx));

      await expect(actualizarEstadoPasajerosReserva(1, { pasajeros: [] })).rejects.toThrow(
        'No se puede marcar el estado de vuelo de una reserva cancelada o completada',
      );
    });

    it('Lanza error si falla la validación de pertenencia de pasajeros', async () => {
      const mockTx = {
        $queryRaw: vi.fn(),
        reserva: {
          findFirst: vi.fn().mockResolvedValue({
            id: 1,
            cerradaAt: null,
            estado: 'AGENDADA',
            version: 1,
          }),
        },
        pasajero: {
          findMany: vi.fn().mockResolvedValue([{ id: 1 }]), // Solo devuelve 1 pasajero pero pedimos 2
        },
      };
      (prisma.$transaction as any).mockImplementation(async (cb: any) => cb(mockTx));

      await expect(
        actualizarEstadoPasajerosReserva(1, {
          version: 1,
          pasajeros: [
            { id: 1, estado: 'POR_VOLAR' },
            { id: 2, estado: 'POR_VOLAR' },
          ],
        }),
      ).rejects.toThrow('Uno o más pasajeros no pertenecen a la reserva');
    });

    it('Llama a checkVersion con las versiones correctas', async () => {
      const mockTx = {
        $queryRaw: vi.fn(),
        reserva: {
          findFirst: vi.fn().mockResolvedValue({
            id: 1,
            cerradaAt: null,
            estado: 'AGENDADA',
            version: 5,
          }),
        },
        pasajero: {
          findMany: vi.fn().mockResolvedValue([{ id: 1 }]),
          update: vi.fn(),
        },
        vuelo: { updateMany: vi.fn() },
      };
      (prisma.$transaction as any).mockImplementation(async (cb: any) => cb(mockTx));
      (checkVersion as any).mockImplementationOnce(() => {
        throw new Error('Version mismatch');
      });

      await expect(
        actualizarEstadoPasajerosReserva(1, {
          version: 2, // Intentional mismatch to test exception thrown by checkVersion
          pasajeros: [{ id: 1, estado: 'POR_VOLAR' }],
        }),
      ).rejects.toThrow('Version mismatch');

      expect(checkVersion).toHaveBeenCalledWith(
        5,
        2,
        'La reserva cambió en otro dispositivo. Recarga e intenta de nuevo.',
      );
    });

    it('Actualiza correctamente los pasajeros y sincroniza el estado de los vuelos a COMPLETADO y CANCELADO', async () => {
      const mockTx = {
        $queryRaw: vi.fn(),
        reserva: {
          findFirst: vi.fn().mockResolvedValue({
            id: 10,
            cerradaAt: null,
            estado: 'AGENDADA',
            version: 1,
          }),
          // El método devuelve la reserva actualizada
          update: vi.fn().mockResolvedValue({ id: 10, estado: 'AGENDADA' }),
        },
        pasajero: {
          // Primera llamada para validar membresía, segunda llamada para verificar 'todosVolaron'
          findMany: vi
            .fn()
            .mockResolvedValueOnce([{ id: 1 }, { id: 2 }]) // Pertenencia
            .mockResolvedValueOnce([{ estado: 'VUELO_COMPLETADO' }, { estado: 'CANCELADO' }]), // estadosFinales
          update: vi.fn(),
        },
        vuelo: { updateMany: vi.fn() },
      };
      (prisma.$transaction as any).mockImplementation(async (cb: any) => {
        await cb(mockTx);
        return mockTx.reserva.update.mock.results[0]?.value || { id: 10, estado: 'AGENDADA' }; // Fake return
      });

      const result = await actualizarEstadoPasajerosReserva(10, {
        version: 1,
        pasajeros: [
          { id: 1, estado: 'VUELO_COMPLETADO' },
          { id: 2, estado: 'CANCELADO' },
        ],
      });

      // Verify that passengers are updated
      expect(mockTx.pasajero.update).toHaveBeenCalledTimes(2);
      expect(mockTx.pasajero.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { estado: 'VUELO_COMPLETADO' },
      });
      expect(mockTx.pasajero.update).toHaveBeenCalledWith({
        where: { id: 2 },
        data: { estado: 'CANCELADO' },
      });

      // Verify synchronization of flight statuses
      expect(mockTx.vuelo.updateMany).toHaveBeenCalledTimes(2);
      expect(mockTx.vuelo.updateMany).toHaveBeenCalledWith({
        where: {
          pasajeroId: { in: [1] },
          deletedAt: null,
          estado: { not: 'CANCELADO' },
        },
        data: {
          estado: 'COMPLETADO',
          version: { increment: 1 },
        },
      });
      expect(mockTx.vuelo.updateMany).toHaveBeenCalledWith({
        where: {
          pasajeroId: { in: [2] },
          deletedAt: null,
          estado: { not: 'COMPLETADO' },
        },
        data: {
          estado: 'CANCELADO',
          version: { increment: 1 },
        },
      });

      // Si todos no volaron, el estado no debe cambiar. La función siempre llama a reserva.update al final, pero
      // sin pasar `estado` en data si no cambió.
      expect(mockTx.reserva.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 10 },
          data: { version: { increment: 1 } },
        }),
      );
      expect(result.estado).toBe('AGENDADA');
    });

    it('Completa la reserva si todos los pasajeros tienen estado VUELO_COMPLETADO y cumple el saldo', async () => {
      const mockReservaFinal = { id: 20, estado: 'COMPLETADA' };
      const mockTx = {
        $queryRaw: vi.fn(),
        reserva: {
          findFirst: vi.fn().mockResolvedValue({
            id: 20,
            cerradaAt: null,
            estado: 'AGENDADA',
            estadoPago: 'PAGADO', // Necessary for derivarEstadoReservaPorPasajeros
            version: 1,
            valorTotal: 50000,
          }),
          update: vi.fn().mockResolvedValue(mockReservaFinal),
        },
        pasajero: {
          findMany: vi
            .fn()
            .mockResolvedValueOnce([{ id: 1 }]) // Pertenencia
            .mockResolvedValueOnce([{ estado: 'VUELO_COMPLETADO' }]), // estadosFinales
          update: vi.fn(),
        },
        vuelo: { updateMany: vi.fn() },
        pago: {
          aggregate: vi.fn().mockResolvedValue({ _sum: { monto: 50000 } }),
          count: vi.fn().mockResolvedValue(1),
        },
      };

      (prisma.$transaction as any).mockImplementation(async (cb: any) => {
        await cb(mockTx);
        return mockTx.reserva.update.mock.results[0]?.value;
      });

      const result = await actualizarEstadoPasajerosReserva(20, {
        version: 1,
        pasajeros: [{ id: 1, estado: 'VUELO_COMPLETADO' }],
      });

      // Verify transaction resolves total and allows completion
      expect(mockTx.pago.aggregate).toHaveBeenCalledWith({
        _sum: { monto: true },
        where: { reservaId: 20, deletedAt: null },
      });

      expect(mockTx.reserva.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 20 },
          data: {
            estado: 'COMPLETADA',
            version: { increment: 1 },
          },
        }),
      );

      expect(result.estado).toBe('COMPLETADA');
    });
  });

  describe('Reservas Ciclo Vida - cancelarReserva', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('debe cancelar exitosamente una reserva (happy path)', async () => {
      let capturedTx: any;
      (prisma.$transaction as any).mockImplementationOnce(async (cb: any) => {
        capturedTx = {
          $queryRaw: vi.fn(),
          reserva: {
            findFirst: vi.fn().mockResolvedValue({
              id: 1,
              version: 1,
              estado: 'AGENDADA',
              estadoPago: 'PENDIENTE',
              pasajeros: [{ id: 10 }, { id: 11 }],
            }),
            update: vi.fn().mockResolvedValue({
              id: 1,
              estado: 'CANCELADA',
            }),
          },
          vuelo: {
            updateMany: vi.fn(),
          },
          pasajero: {
            updateMany: vi.fn(),
          },
          devolucion: {
            create: vi.fn(),
            aggregate: vi.fn(),
          },
          pago: {
            aggregate: vi.fn(),
          },
        };
        return cb(capturedTx);
      });

      const result = await cancelarReserva(1, { motivo: 'Motivo de prueba', version: 1 });

      expect(capturedTx.reserva.findFirst).toHaveBeenCalledWith({
        where: { id: 1, deletedAt: null },
        include: expect.any(Object),
      });

      expect(capturedTx.vuelo.updateMany).toHaveBeenCalledWith({
        where: { reservaId: 1, deletedAt: null, estado: { not: 'COMPLETADO' } },
        data: { estado: 'CANCELADO', deletedAt: expect.any(Date), version: { increment: 1 } },
      });

      expect(capturedTx.pasajero.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [10, 11] }, deletedAt: null, estado: { not: 'VUELO_COMPLETADO' } },
        data: { estado: 'CANCELADO' },
      });

      expect(capturedTx.reserva.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          estado: 'CANCELADA',
          motivoCancelacion: 'Motivo de prueba',
          fechaCancelacion: expect.any(Date),
        }),
        include: expect.any(Object),
      });

      expect(checkVersion).toHaveBeenCalledWith(1, 1, expect.any(String));
      expect(broadcastDatos).toHaveBeenCalledWith('vuelo', 'actualizar');
      expect(googleCalendarService.syncReservaVuelosDeleted).toHaveBeenCalledWith(1);
      expect(result.estado).toBe('CANCELADA');
    });

    it('debe cancelar y generar devolucion si se envía en el payload', async () => {
      let capturedTx: any;
      (prisma.$transaction as any).mockImplementationOnce(async (cb: any) => {
        capturedTx = {
          $queryRaw: vi.fn(),
          reserva: {
            findFirst: vi.fn().mockResolvedValue({
              id: 2,
              version: 1,
              estado: 'AGENDADA',
              estadoPago: 'PAGADO',
              valorTotal: 50000,
              montoDevuelto: 0,
              pasajeros: [],
            }),
            update: vi.fn().mockResolvedValue({
              id: 2,
              estado: 'CANCELADA',
              estadoPago: 'DEVUELTO',
              montoDevuelto: 50000,
            }),
          },
          vuelo: {
            updateMany: vi.fn(),
          },
          pasajero: {
            updateMany: vi.fn(),
          },
          devolucion: {
            create: vi.fn().mockResolvedValue({ id: 100 }),
            aggregate: vi.fn().mockResolvedValue({ _sum: { monto: 0 } }),
          },
          pago: {
            aggregate: vi.fn().mockResolvedValue({ _sum: { monto: 50000 } }),
          },
        };
        return cb(capturedTx);
      });

      const result = await cancelarReserva(2, {
        motivo: 'Reembolso por mal tiempo',
        version: 1,
        devolucion: {
          monto: 50000,
          metodoPago: 'EFECTIVO',
        },
      });

      expect(capturedTx.devolucion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          reservaId: 2,
          monto: 50000,
          metodoPago: 'EFECTIVO',
        }),
      });

      expect(capturedTx.reserva.update).toHaveBeenCalledWith({
        where: { id: 2 },
        data: expect.objectContaining({
          estado: 'CANCELADA',
          montoDevuelto: 50000,
          estadoPago: 'DEVUELTO',
        }),
        include: expect.any(Object),
      });

      expect(result.estado).toBe('CANCELADA');
    });

    it('debe arrojar error si la devolución supera lo pagado', async () => {
      let capturedTx: any;
      (prisma.$transaction as any).mockImplementationOnce(async (cb: any) => {
        capturedTx = {
          $queryRaw: vi.fn(),
          reserva: {
            findFirst: vi.fn().mockResolvedValue({
              id: 3,
              version: 1,
              estado: 'AGENDADA',
              estadoPago: 'PAGADO',
              valorTotal: 50000,
              montoDevuelto: 0,
              pasajeros: [],
            }),
          },
          vuelo: {
            updateMany: vi.fn(),
          },
          pasajero: {
            updateMany: vi.fn(),
          },
          devolucion: {
            aggregate: vi.fn().mockResolvedValue({ _sum: { monto: 0 } }),
          },
          pago: {
            aggregate: vi.fn().mockResolvedValue({ _sum: { monto: 30000 } }), // Pagado solo 30000
          },
        };
        return cb(capturedTx);
      });

      await expect(
        cancelarReserva(3, {
          motivo: 'Reembolso por mal tiempo',
          version: 1,
          devolucion: {
            monto: 50000, // Intentando devolver 50000
            metodoPago: 'EFECTIVO',
          },
        }),
      ).rejects.toThrow('No se puede devolver más de lo pagado');
    });

    it('debe arrojar error si la reserva está cerrada contablemente', async () => {
      let capturedTx: any;
      (prisma.$transaction as any).mockImplementationOnce(async (cb: any) => {
        capturedTx = {
          $queryRaw: vi.fn(),
          reserva: {
            findFirst: vi.fn().mockResolvedValue({
              id: 4,
              version: 1,
              cerradaAt: new Date(),
              estado: 'AGENDADA',
              pasajeros: [],
            }),
          },
        };
        return cb(capturedTx);
      });

      await expect(
        cancelarReserva(4, {
          motivo: 'Motivo',
          version: 1,
        }),
      ).rejects.toThrow('No se puede cancelar una reserva cerrada contablemente');
    });

    it('debe arrojar error si la reserva ya está finalizada (CANCELADA o COMPLETADA)', async () => {
      let capturedTx: any;
      (prisma.$transaction as any).mockImplementationOnce(async (cb: any) => {
        capturedTx = {
          $queryRaw: vi.fn(),
          reserva: {
            findFirst: vi.fn().mockResolvedValue({
              id: 5,
              version: 1,
              estado: 'COMPLETADA',
              pasajeros: [],
            }),
          },
        };
        return cb(capturedTx);
      });

      await expect(
        cancelarReserva(5, {
          motivo: 'Motivo',
          version: 1,
        }),
      ).rejects.toThrow('Reserva ya finalizada');
    });
  });

  describe('Reservas Ciclo de Vida - desagendarReserva', () => {
    let mockTx: any;

    beforeEach(() => {
      vi.clearAllMocks();

      mockTx = {
        $queryRaw: vi.fn(),
        reserva: {
          findFirst: vi.fn(),
          update: vi.fn(),
        },
        vuelo: {
          updateMany: vi.fn(),
        },
        pasajero: {
          updateMany: vi.fn(),
        },
      };

      (prisma.$transaction as any).mockImplementation((cb: any) => cb(mockTx));
    });

    it('debe desagendar la reserva exitosamente (revierte a SIN_AGENDAR, borra vuelos, restablece pasajeros)', async () => {
      // Arrange
      const reservaId = 1;
      const mockReserva = {
        id: reservaId,
        estado: 'CONFIRMADA',
        cerradaAt: null,
        version: 2,
        pasajeros: [{ id: 101 }, { id: 102 }],
      };

      mockTx.reserva.findFirst.mockResolvedValue(mockReserva);
      mockTx.reserva.update.mockResolvedValue({ id: reservaId, estado: 'SIN_AGENDAR' });
      mockTx.vuelo.updateMany.mockResolvedValue({ count: 2 });
      mockTx.pasajero.updateMany.mockResolvedValue({ count: 2 });

      // Act
      const result = await desagendarReserva(reservaId, { version: 2 });

      // Assert
      expect(mockTx.$queryRaw).toHaveBeenCalled();
      expect(mockTx.reserva.findFirst).toHaveBeenCalledWith({
        where: { id: reservaId, deletedAt: null },
        include: {
          pasajeros: {
            where: { deletedAt: null },
            select: { id: true },
          },
        },
      });
      expect(checkVersion).toHaveBeenCalledWith(2, 2, expect.any(String));

      expect(mockTx.vuelo.updateMany).toHaveBeenCalledWith({
        where: {
          reservaId,
          deletedAt: null,
          estado: { not: 'COMPLETADO' },
        },
        data: {
          deletedAt: expect.any(Date),
          version: { increment: 1 },
        },
      });

      expect(mockTx.pasajero.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: [101, 102] },
          deletedAt: null,
          estado: { not: 'VUELO_COMPLETADO' },
        },
        data: { estado: 'POR_VOLAR' },
      });

      expect(mockTx.reserva.update).toHaveBeenCalledWith({
        where: { id: reservaId },
        data: {
          estado: 'SIN_AGENDAR',
          fechaAgenda: null,
          horaAgenda: null,
          version: { increment: 1 },
        },
        include: expect.any(Object),
      });

      expect(broadcastDatos).toHaveBeenCalledWith('vuelo', 'actualizar');
      expect(broadcastDatos).toHaveBeenCalledWith('reserva', 'actualizar');
      expect(googleCalendarService.syncReservaVuelosDeleted).toHaveBeenCalledWith(reservaId);
      expect(result).toEqual({ id: reservaId, estado: 'SIN_AGENDAR' });
    });

    it('debe lanzar error si la reserva no es encontrada', async () => {
      mockTx.reserva.findFirst.mockResolvedValue(null);
      await expect(desagendarReserva(1)).rejects.toThrow('Reserva no encontrada');
    });

    it('debe lanzar error si la reserva está cerrada contablemente', async () => {
      mockTx.reserva.findFirst.mockResolvedValue({ id: 1, cerradaAt: new Date() });
      await expect(desagendarReserva(1)).rejects.toThrow(
        'No se puede desagendar una reserva cerrada contablemente',
      );
    });

    it('debe lanzar error si la reserva está CANCELADA', async () => {
      mockTx.reserva.findFirst.mockResolvedValue({ id: 1, estado: 'CANCELADA', cerradaAt: null });
      await expect(desagendarReserva(1)).rejects.toThrow(
        'No se puede desagendar una reserva cancelada o completada',
      );
    });

    it('debe lanzar error si la reserva está COMPLETADA', async () => {
      mockTx.reserva.findFirst.mockResolvedValue({ id: 1, estado: 'COMPLETADA', cerradaAt: null });
      await expect(desagendarReserva(1)).rejects.toThrow(
        'No se puede desagendar una reserva cancelada o completada',
      );
    });

    it('debe lanzar error si la reserva ya se encuentra SIN_AGENDAR', async () => {
      mockTx.reserva.findFirst.mockResolvedValue({ id: 1, estado: 'SIN_AGENDAR', cerradaAt: null });
      await expect(desagendarReserva(1)).rejects.toThrow('La reserva ya se encuentra sin agendar');
    });

    it('debe manejar gracefully errores de sincronización con Google Calendar', async () => {
      mockTx.reserva.findFirst.mockResolvedValue({
        id: 1,
        estado: 'CONFIRMADA',
        cerradaAt: null,
        version: 1,
        pasajeros: [],
      });
      mockTx.reserva.update.mockResolvedValue({ id: 1, estado: 'SIN_AGENDAR' });

      // Simulate error in Calendar sync
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      (googleCalendarService.syncReservaVuelosDeleted as any).mockRejectedValueOnce(
        new Error('Calendar API error'),
      );

      const result = await desagendarReserva(1);

      // We expect the promise to settle without error in desagendarReserva
      expect(result).toEqual({ id: 1, estado: 'SIN_AGENDAR' });
      // Since sync is async without await in the actual function, we have to wait a microtask for the catch to trigger.
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[GoogleCalendar] Error sincronizando desagendamiento de reserva:',
        expect.any(Error),
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('Reservas Ciclo de Vida - deleteReserva', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('debe eliminar la reserva, notificar por SSE y a Google Calendar (happy path)', async () => {
      mockTx.reserva.findFirst.mockResolvedValue({
        id: 1,
        estado: 'CONFIRMADA',
        estadoPago: 'PENDIENTE',
      });

      await deleteReserva(1);

      // Verificar soft deletes
      expect(mockTx.vuelo.updateMany).toHaveBeenCalledWith({
        where: { reservaId: 1, deletedAt: null },
        data: { deletedAt: expect.any(Date) },
      });
      expect(mockTx.pasajero.updateMany).toHaveBeenCalledWith({
        where: { reservaId: 1, deletedAt: null },
        data: { deletedAt: expect.any(Date) },
      });
      expect(mockTx.pago.updateMany).toHaveBeenCalledWith({
        where: { reservaId: 1, deletedAt: null },
        data: { deletedAt: expect.any(Date) },
      });
      expect(mockTx.devolucion.updateMany).toHaveBeenCalledWith({
        where: { reservaId: 1, deletedAt: null },
        data: { deletedAt: expect.any(Date) },
      });
      expect(mockTx.reserva.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { deletedAt: expect.any(Date), version: { increment: 1 } },
      });

      // Verificar notificaciones
      expect(broadcastDatos).toHaveBeenCalledWith('vuelo', 'actualizar');
      expect(broadcastDatos).toHaveBeenCalledWith('reserva', 'actualizar');

      // Verificar Google Calendar
      expect(googleCalendarService.syncReservaVuelosDeleted).toHaveBeenCalledWith(1);
    });

    it('debe lanzar error si la reserva no existe', async () => {
      mockTx.reserva.findFirst.mockResolvedValue(null);

      await expect(deleteReserva(1)).rejects.toThrow('Reserva no encontrada');
    });

    it('debe lanzar error si la reserva está cerrada contablemente', async () => {
      mockTx.reserva.findFirst.mockResolvedValue({
        id: 1,
        cerradaAt: new Date(),
      });

      await expect(deleteReserva(1)).rejects.toThrow(
        'No se puede eliminar una reserva cerrada contablemente',
      );
    });

    it('debe lanzar error si el estado es CANCELADA', async () => {
      mockTx.reserva.findFirst.mockResolvedValue({
        id: 1,
        estado: 'CANCELADA',
      });

      await expect(deleteReserva(1)).rejects.toThrow(
        'No se puede eliminar una reserva completada o cancelada',
      );
    });

    it('debe lanzar error si el estado es COMPLETADA', async () => {
      mockTx.reserva.findFirst.mockResolvedValue({
        id: 1,
        estado: 'COMPLETADA',
      });

      await expect(deleteReserva(1)).rejects.toThrow(
        'No se puede eliminar una reserva completada o cancelada',
      );
    });

    it('debe lanzar error si el estadoPago es PAGADO o ABONADO', async () => {
      mockTx.reserva.findFirst.mockResolvedValue({
        id: 1,
        estado: 'CONFIRMADA',
        estadoPago: 'PAGADO',
      });

      await expect(deleteReserva(1)).rejects.toThrow(
        'No se puede eliminar una reserva con pagos registrados. Registra una devolución antes',
      );

      mockTx.reserva.findFirst.mockResolvedValue({
        id: 1,
        estado: 'CONFIRMADA',
        estadoPago: 'ABONADO',
      });

      await expect(deleteReserva(1)).rejects.toThrow(
        'No se puede eliminar una reserva con pagos registrados. Registra una devolución antes',
      );
    });

    it('debe capturar y loggear error de Google Calendar sin fallar la transacción', async () => {
      mockTx.reserva.findFirst.mockResolvedValue({
        id: 1,
        estado: 'CONFIRMADA',
        estadoPago: 'PENDIENTE',
      });

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const syncError = new Error('Calendar error');
      vi.mocked(googleCalendarService.syncReservaVuelosDeleted).mockRejectedValueOnce(syncError);

      await deleteReserva(1);

      expect(mockTx.reserva.update).toHaveBeenCalled();
      // Allow the promise chain to resolve the caught catch
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(consoleSpy).toHaveBeenCalledWith(
        '[GoogleCalendar] Error sincronizando eliminación de reserva:',
        syncError,
      );

      consoleSpy.mockRestore();
    });
  });

  describe('reservas.ciclo-vida - cerrarReservaContable', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('debe cerrar correctamente una reserva completada y generar el snapshot', async () => {
      const mockReserva = {
        id: 1,
        numeroReserva: 'RES-001',
        nombreTitular: 'Juan Perez',
        rutDniTitular: '12345678-9',
        email: 'juan@example.com',
        telefono: '+56912345678',
        valorTotal: '50000',
        abono: '50000',
        montoDevuelto: '0',
        descuento: '0',
        estado: 'COMPLETADA',
        estadoPago: 'PAGADO',
        version: 1,
        cerradaAt: null,
        pasajeros: [
          {
            id: 10,
            nombre: 'Juan Perez',
            rutDni: '12345678-9',
            peso: 75,
            firmaDeslinde: true,
            estado: 'VUELO_COMPLETADO',
          },
        ],
        pagos: [
          {
            id: 20,
            monto: '50000',
            metodoPago: 'TRANSFERENCIA',
            fecha: new Date('2023-01-01T10:00:00Z'),
          },
        ],
        devoluciones: [],
        vuelos: [{ id: 30, estado: 'COMPLETADO' }],
      };

      (prisma.reserva.findFirst as any).mockResolvedValue(mockReserva);
      (prisma.reserva.update as any).mockImplementation(({ data }) =>
        Promise.resolve({ ...mockReserva, ...data }),
      );

      const result = await cerrarReservaContable(1, 1);

      expect(prisma.reserva.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1, deletedAt: null },
        }),
      );

      expect(prisma.reserva.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: expect.objectContaining({
            cerradaAt: expect.any(Date),
            snapshotJson: expect.objectContaining({
              numeroReserva: 'RES-001',
              nombreTitular: 'Juan Perez',
              valorTotal: 50000,
              estado: 'COMPLETADA',
            }),
            version: { increment: 1 },
          }),
        }),
      );

      expect(broadcastDatos).toHaveBeenCalledWith('reserva', 'actualizar');
      expect(result.cerradaAt).toBeDefined();
      expect(result.snapshotJson).toBeDefined();
    });

    it('debe retornar la reserva sin cambios si ya esta cerrada', async () => {
      const mockReserva = {
        id: 2,
        cerradaAt: new Date(),
        estado: 'COMPLETADA',
        version: 1,
      };

      (prisma.reserva.findFirst as any).mockResolvedValue(mockReserva);

      const result = await cerrarReservaContable(2, 1);

      expect(prisma.reserva.update).not.toHaveBeenCalled();
      expect(result).toEqual(mockReserva);
    });

    it('debe lanzar error si la reserva no existe', async () => {
      (prisma.reserva.findFirst as any).mockResolvedValue(null);

      await expect(cerrarReservaContable(999)).rejects.toThrow('Reserva no encontrada');
    });

    it('debe lanzar error si el estado no es COMPLETADA ni CANCELADA', async () => {
      const mockReserva = {
        id: 3,
        estado: 'AGENDADA',
        cerradaAt: null,
        version: 1,
      };

      (prisma.reserva.findFirst as any).mockResolvedValue(mockReserva);

      await expect(cerrarReservaContable(3, 1)).rejects.toThrow(
        'Solo se pueden cerrar contablemente reservas completadas o canceladas',
      );
    });
  });

  describe('reservas.ciclo-vida - reabrirReservaContable', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('debe rechazar si el motivo está vacío', async () => {
      await expect(reabrirReservaContable(1, '')).rejects.toThrow(
        /motivo de reapertura es obligatorio/i,
      );
      await expect(reabrirReservaContable(1, '   ')).rejects.toThrow(
        /motivo de reapertura es obligatorio/i,
      );
    });

    it('debe lanzar error si la reserva no es encontrada', async () => {
      (prisma.reserva.findFirst as any).mockResolvedValue(null);

      await expect(reabrirReservaContable(1, 'Motivo válido')).rejects.toThrow(
        /Reserva no encontrada/i,
      );
    });

    it('debe lanzar ConflictError si la versión no coincide', async () => {
      (prisma.reserva.findFirst as any).mockResolvedValue({
        id: 1,
        version: 2,
        cerradaAt: new Date(),
      });

      await expect(reabrirReservaContable(1, 'Motivo válido', 1)).rejects.toThrow(ConflictError);
    });

    it('debe lanzar error si la reserva no está cerrada contablemente', async () => {
      (prisma.reserva.findFirst as any).mockResolvedValue({
        id: 1,
        version: 2,
        cerradaAt: null, // No cerrada
      });

      await expect(reabrirReservaContable(1, 'Motivo válido')).rejects.toThrow(
        /La reserva no está cerrada contablemente/i,
      );
    });

    it('debe reabrir exitosamente, quitar cerradaAt, resetear snapshotJson e incrementar versión', async () => {
      const mockReserva = {
        id: 1,
        version: 2,
        cerradaAt: new Date(),
      };

      const mockReabierta = {
        ...mockReserva,
        cerradaAt: null,
        snapshotJson: Prisma.DbNull,
        version: 3,
      };

      (prisma.reserva.findFirst as any).mockResolvedValue(mockReserva);
      (prisma.reserva.update as any).mockResolvedValue(mockReabierta);

      const result = await reabrirReservaContable(1, 'Motivo válido auditoría', 2);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.reserva.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1, deletedAt: null },
        }),
      );
      expect(prisma.reserva.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: expect.objectContaining({
            cerradaAt: null,
            snapshotJson: Prisma.DbNull,
            version: { increment: 1 },
          }),
        }),
      );
      expect(broadcastDatos).toHaveBeenCalledWith('reserva', 'actualizar');
      expect(result).toEqual(mockReabierta);
    });
  });
});
