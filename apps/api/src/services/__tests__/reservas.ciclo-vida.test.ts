import { describe, it, expect, vi, beforeEach } from 'vitest';
import { desagendarReserva } from '../reservas/reservas.ciclo-vida';
import { prisma } from '../../plugins/prisma';
import { broadcastDatos } from '../eventos.service';
import { googleCalendarService } from '../google-calendar.service';
import { checkVersion } from '../concurrencia.service';

vi.mock('../../plugins/prisma', () => {
  return {
    prisma: {
      $transaction: vi.fn(),
    },
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

vi.mock('../concurrencia.service', () => ({
  checkVersion: vi.fn(),
}));

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
      pasajeros: [
        { id: 101 },
        { id: 102 }
      ],
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
    await expect(desagendarReserva(1)).rejects.toThrow('No se puede desagendar una reserva cerrada contablemente');
  });

  it('debe lanzar error si la reserva está CANCELADA', async () => {
    mockTx.reserva.findFirst.mockResolvedValue({ id: 1, estado: 'CANCELADA', cerradaAt: null });
    await expect(desagendarReserva(1)).rejects.toThrow('No se puede desagendar una reserva cancelada o completada');
  });

  it('debe lanzar error si la reserva está COMPLETADA', async () => {
    mockTx.reserva.findFirst.mockResolvedValue({ id: 1, estado: 'COMPLETADA', cerradaAt: null });
    await expect(desagendarReserva(1)).rejects.toThrow('No se puede desagendar una reserva cancelada o completada');
  });

  it('debe lanzar error si la reserva ya se encuentra SIN_AGENDAR', async () => {
    mockTx.reserva.findFirst.mockResolvedValue({ id: 1, estado: 'SIN_AGENDAR', cerradaAt: null });
    await expect(desagendarReserva(1)).rejects.toThrow('La reserva ya se encuentra sin agendar');
  });

  it('debe manejar gracefully errores de sincronización con Google Calendar', async () => {
    mockTx.reserva.findFirst.mockResolvedValue({
      id: 1, estado: 'CONFIRMADA', cerradaAt: null, version: 1, pasajeros: []
    });
    mockTx.reserva.update.mockResolvedValue({ id: 1, estado: 'SIN_AGENDAR' });

    // Simulate error in Calendar sync
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    (googleCalendarService.syncReservaVuelosDeleted as any).mockRejectedValueOnce(new Error('Calendar API error'));

    const result = await desagendarReserva(1);

    // We expect the promise to settle without error in desagendarReserva
    expect(result).toEqual({ id: 1, estado: 'SIN_AGENDAR' });
    // Since sync is async without await in the actual function, we have to wait a microtask for the catch to trigger.
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(consoleWarnSpy).toHaveBeenCalledWith('[GoogleCalendar] Error sincronizando desagendamiento de reserva:', expect.any(Error));

    consoleWarnSpy.mockRestore();
  });
});
