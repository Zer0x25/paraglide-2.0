import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deleteReserva } from '../reservas/reservas.ciclo-vida';
import { prisma } from '../../plugins/prisma';
import { broadcastDatos } from '../eventos.service';
import { googleCalendarService } from '../google-calendar.service';

const mockTx = {
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
  pago: {
    updateMany: vi.fn(),
  },
  devolucion: {
    updateMany: vi.fn(),
  },
};

vi.mock('../../plugins/prisma', () => {
  return {
    prisma: {
      $transaction: vi.fn((callback) => callback(mockTx)),
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

    await expect(deleteReserva(1)).rejects.toThrow('No se puede eliminar una reserva cerrada contablemente');
  });

  it('debe lanzar error si el estado es CANCELADA', async () => {
    mockTx.reserva.findFirst.mockResolvedValue({
      id: 1,
      estado: 'CANCELADA',
    });

    await expect(deleteReserva(1)).rejects.toThrow('No se puede eliminar una reserva completada o cancelada');
  });

  it('debe lanzar error si el estado es COMPLETADA', async () => {
    mockTx.reserva.findFirst.mockResolvedValue({
      id: 1,
      estado: 'COMPLETADA',
    });

    await expect(deleteReserva(1)).rejects.toThrow('No se puede eliminar una reserva completada o cancelada');
  });

  it('debe lanzar error si el estadoPago es PAGADO o ABONADO', async () => {
    mockTx.reserva.findFirst.mockResolvedValue({
      id: 1,
      estado: 'CONFIRMADA',
      estadoPago: 'PAGADO',
    });

    await expect(deleteReserva(1)).rejects.toThrow('No se puede eliminar una reserva con pagos registrados. Registra una devolución antes');

    mockTx.reserva.findFirst.mockResolvedValue({
      id: 1,
      estado: 'CONFIRMADA',
      estadoPago: 'ABONADO',
    });

    await expect(deleteReserva(1)).rejects.toThrow('No se puede eliminar una reserva con pagos registrados. Registra una devolución antes');
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
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(consoleSpy).toHaveBeenCalledWith('[GoogleCalendar] Error sincronizando eliminación de reserva:', syncError);

    consoleSpy.mockRestore();
  });
});
