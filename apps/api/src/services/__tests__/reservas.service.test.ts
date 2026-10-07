import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReservasService } from '../reservas.service';

vi.mock('../../plugins/prisma', () => {
  return {
    prisma: {
      $transaction: vi.fn((cb) => cb({
        reserva: {
          findUnique: vi.fn(),
          findFirst: vi.fn(),
          update: vi.fn(),
        },
        pago: {
          create: vi.fn(),
          aggregate: vi.fn(),
          findMany: vi.fn(),
          update: vi.fn(),
        },
        devolucion: {
          create: vi.fn(),
          aggregate: vi.fn(),
          update: vi.fn(),
        },
      })),
      reserva: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
    },
  };
});

import { prisma } from '../../plugins/prisma';

describe('Reservas Service - Pagos y Abonos', () => {
  let service: ReservasService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ReservasService();
  });

  it('addPago debería registrar el abono y actualizar el estado de la reserva a PAGADO si cubre el total', async () => {
    const mockTx = {
      reserva: {
        findUnique: vi.fn().mockResolvedValue({ id: 1, valorTotal: 50000, abono: 20000, estadoPago: 'ABONADO' }),
        update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 1, ...data })),
      },
      pago: {
        create: vi.fn().mockResolvedValue({ id: 10, monto: 30000, metodoPago: 'TRANSFERENCIA' }),
        aggregate: vi.fn().mockResolvedValue({
          _sum: { monto: 50000 }
        }),
      },
    };

    (prisma.$transaction as any).mockImplementation((cb: any) => cb(mockTx));

    const result = await service.addPago(1, {
      monto: 30000,
      metodoPago: 'TRANSFERENCIA',
      comprobante: 'TRX-123456',
    });

    expect(mockTx.pago.create).toHaveBeenCalled();
    expect(mockTx.reserva.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({
          abono: 50000,
          estadoPago: 'PAGADO',
        }),
      })
    );
  });

  it('addPago debería actualizar el estado a ABONADO si es un pago parcial', async () => {
    const mockTx = {
      reserva: {
        findUnique: vi.fn().mockResolvedValue({ id: 1, valorTotal: 100000, abono: 0, estadoPago: 'PENDIENTE' }),
        update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 1, ...data })),
      },
      pago: {
        create: vi.fn().mockResolvedValue({ id: 11, monto: 30000, metodoPago: 'EFECTIVO' }),
        aggregate: vi.fn().mockResolvedValue({
          _sum: { monto: 30000 }
        }),
      },
    };

    (prisma.$transaction as any).mockImplementation((cb: any) => cb(mockTx));

    await service.addPago(1, {
      monto: 30000,
      metodoPago: 'EFECTIVO',
    });

    expect(mockTx.reserva.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({
          abono: 30000,
          estadoPago: 'ABONADO',
        }),
      })
    );
  });

  it('update debería lanzar error si llega un estadoPago explícito inconsistente con la derivación', async () => {
    const mockTx = {
      reserva: {
        findUnique: vi.fn().mockResolvedValue({
          id: 1,
          valorTotal: 100000,
          abono: 0,
          estadoPago: 'PENDIENTE',
        }),
        update: vi.fn(),
      },
      // Punto 3: la derivación sale de la suma real de pagos activos
      pago: { aggregate: vi.fn().mockResolvedValue({ _sum: { monto: 0 } }) }, // sin abonos → derivación = PENDIENTE
    };

    (prisma.$transaction as any).mockImplementation((cb: any) => cb(mockTx));

    await expect(
      service.update(1, { estadoPago: 'PAGADO' } as any)
    ).rejects.toThrow('El estado de pago se deriva automáticamente de los pagos registrados');

    // No debe haber tocado la reserva
    expect(mockTx.reserva.update).not.toHaveBeenCalled();
  });

  it('update debería aceptar un estadoPago explícito que coincide con la derivación', async () => {
    const mockTx = {
      reserva: {
        findUnique: vi.fn().mockResolvedValue({
          id: 1,
          valorTotal: 100000,
          abono: 100000,
          estadoPago: 'PAGADO',
        }),
        update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 1, ...data })),
      },
      pago: { aggregate: vi.fn().mockResolvedValue({ _sum: { monto: 100000 } }) }, // derivación = PAGADO
    };

    (prisma.$transaction as any).mockImplementation((cb: any) => cb(mockTx));

    const result = await service.update(1, { estadoPago: 'PAGADO' } as any);
    expect(result).toBeDefined();
    expect(mockTx.reserva.update).toHaveBeenCalled();
  });

  it('updateReserva ignora el abono del cliente y lo re-sincroniza con la suma de pagos activos (punto 3)', async () => {
    const mockTx = {
      reserva: {
        findUnique: vi.fn().mockResolvedValue({
          id: 1,
          valorTotal: 100000,
          abono: 50000,
          estadoPago: 'ABONADO',
        }),
        update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 1, ...data })),
      },
      pago: { aggregate: vi.fn().mockResolvedValue({ _sum: { monto: 50000 } }) },
    };

    (prisma.$transaction as any).mockImplementation((cb: any) => cb(mockTx));

    await service.update(1, { nombreTitular: 'Nombre Nuevo', abono: 999999 } as any);

    expect(mockTx.reserva.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ abono: 50000 }),
      })
    );
    const data = (mockTx.reserva.update as any).mock.calls[0][0].data;
    expect(data.abono).not.toBe(999999);
    // La edición no debe crear pagos implícitos (ya no existe el Pago compensatorio)
    expect((mockTx as any).pago.create).toBeUndefined();
  });
});

describe('Reservas Service - actualizarEstadoPasajeros (estado de vuelo)', () => {
  let service: ReservasService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ReservasService();
  });

  it('debería marcar los estados de vuelo de los pasajeros y devolver la reserva actualizada', async () => {
    const mockTx = {
      reserva: {
        findFirst: vi.fn().mockResolvedValue({ id: 5, version: 3 }),
        update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 5, version: (data.version.increment ?? 0) + 3, pasajeros: [], pagos: [] })),
      },
      pasajero: {
        findMany: vi.fn().mockResolvedValue([{ id: 101 }, { id: 102 }]),
        update: vi.fn().mockImplementation(({ where, data }) => Promise.resolve({ id: where.id, ...data })),
      },
    };

    (prisma.$transaction as any).mockImplementation((cb: any) => cb(mockTx));

    const result = await service.actualizarEstadoPasajeros(5, {
      version: 3,
      pasajeros: [
        { id: 101, estado: 'VUELO_COMPLETADO' },
        { id: 102, estado: 'CANCELADO' },
      ],
    });

    expect(mockTx.pasajero.update).toHaveBeenCalledWith({ where: { id: 101 }, data: { estado: 'VUELO_COMPLETADO' } });
    expect(mockTx.pasajero.update).toHaveBeenCalledWith({ where: { id: 102 }, data: { estado: 'CANCELADO' } });
    expect(mockTx.reserva.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 5 },
        data: expect.objectContaining({ version: { increment: 1 } }),
      })
    );
    expect(result).toBeDefined();
  });

  it('debería rechazar si algún pasajero no pertenece a la reserva', async () => {
    const mockTx = {
      reserva: {
        findFirst: vi.fn().mockResolvedValue({ id: 5, version: 1 }),
      },
      pasajero: {
        // Solo encuentra 1 de los 2 pedidos → pertenencia inválida
        findMany: vi.fn().mockResolvedValue([{ id: 101 }]),
        update: vi.fn(),
      },
    };

    (prisma.$transaction as any).mockImplementation((cb: any) => cb(mockTx));

    await expect(
      service.actualizarEstadoPasajeros(5, {
        version: 1,
        pasajeros: [
          { id: 101, estado: 'VUELO_COMPLETADO' },
          { id: 999, estado: 'VUELO_COMPLETADO' },
        ],
      })
    ).rejects.toThrow('no pertenecen a la reserva');

    expect(mockTx.pasajero.update).not.toHaveBeenCalled();
  });

  it('debería lanzar 409 (ConflictError) si la version está desactualizada', async () => {
    const mockTx = {
      reserva: {
        findFirst: vi.fn().mockResolvedValue({ id: 5, version: 3 }),
      },
      pasajero: {
        findMany: vi.fn().mockResolvedValue([{ id: 101 }]),
        update: vi.fn(),
      },
    };

    (prisma.$transaction as any).mockImplementation((cb: any) => cb(mockTx));

    await expect(
      service.actualizarEstadoPasajeros(5, {
        version: 999,
        pasajeros: [{ id: 101, estado: 'VUELO_COMPLETADO' }],
      })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('debería lanzar error si la reserva no existe', async () => {
    const mockTx = {
      reserva: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      pasajero: {
        findMany: vi.fn(),
        update: vi.fn(),
      },
    };

    (prisma.$transaction as any).mockImplementation((cb: any) => cb(mockTx));

    await expect(
      service.actualizarEstadoPasajeros(999, {
        version: 1,
        pasajeros: [{ id: 101, estado: 'VUELO_COMPLETADO' }],
      })
    ).rejects.toThrow('Reserva no encontrada');

    expect(mockTx.pasajero.update).not.toHaveBeenCalled();
  });

  it('debería rechazar si la reserva ya está CANCELADA o COMPLETADA', async () => {
    const mockTx = {
      reserva: {
        findFirst: vi.fn().mockResolvedValue({ id: 5, version: 2, estado: 'CANCELADA' }),
      },
      pasajero: {
        findMany: vi.fn().mockResolvedValue([{ id: 101 }]),
        update: vi.fn(),
      },
    };

    (prisma.$transaction as any).mockImplementation((cb: any) => cb(mockTx));

    await expect(
      service.actualizarEstadoPasajeros(5, {
        version: 2,
        pasajeros: [{ id: 101, estado: 'VUELO_COMPLETADO' }],
      })
    ).rejects.toThrow('cancelada o completada');

    expect(mockTx.pasajero.update).not.toHaveBeenCalled();
  });

  it('no debería exigir version (undefined no dispara 409)', async () => {
    const mockTx = {
      reserva: {
        findFirst: vi.fn().mockResolvedValue({ id: 5, version: 3 }),
        update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 5, ...data })),
      },
      pasajero: {
        findMany: vi.fn().mockResolvedValue([{ id: 101 }]),
        update: vi.fn().mockResolvedValue({ id: 101, estado: 'VUELO_COMPLETADO' }),
      },
    };

    (prisma.$transaction as any).mockImplementation((cb: any) => cb(mockTx));

    const result = await service.actualizarEstadoPasajeros(5, {
      pasajeros: [{ id: 101, estado: 'VUELO_COMPLETADO' }],
    });
    expect(result).toBeDefined();
    expect(mockTx.reserva.update).toHaveBeenCalled();
  });

  it('no altera el estado de la reserva si hay mezcla de pasajeros volados y cancelados (no cae a INCOMPLETA)', async () => {
    const mockTx = {
      reserva: {
        findFirst: vi.fn().mockResolvedValue({ id: 5, version: 3, estado: 'AGENDADA' }),
        update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 5, ...data })),
      },
      pasajero: {
        findMany: vi.fn()
          .mockResolvedValueOnce([{ id: 101 }, { id: 102 }])
          .mockResolvedValueOnce([{ id: 101, estado: 'VUELO_COMPLETADO' }, { id: 102, estado: 'CANCELADO' }]),
        update: vi.fn().mockResolvedValue({}),
      },
    };

    (prisma.$transaction as any).mockImplementation((cb: any) => cb(mockTx));

    await service.actualizarEstadoPasajeros(5, {
      version: 3,
      pasajeros: [
        { id: 101, estado: 'VUELO_COMPLETADO' },
        { id: 102, estado: 'CANCELADO' },
      ],
    });

    expect(mockTx.reserva.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 5 },
        data: expect.objectContaining({ version: { increment: 1 } }),
      })
    );
  });

  it('debería derivar el estado de la reserva a COMPLETADA si todos los pasajeros volaron (Fase 2)', async () => {
    const mockTx = {
      reserva: {
        findFirst: vi.fn().mockResolvedValue({ id: 5, version: 2, estado: 'AGENDADA' }),
        update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 5, ...data })),
      },
      pasajero: {
        // 1ª llamada: pertenencia. 2ª llamada: estados resultantes (todos volaron).
        findMany: vi.fn()
          .mockResolvedValueOnce([{ id: 101 }, { id: 102 }])
          .mockResolvedValueOnce([{ id: 101, estado: 'VUELO_COMPLETADO' }, { id: 102, estado: 'VUELO_COMPLETADO' }]),
        update: vi.fn().mockResolvedValue({}),
      },
    };

    (prisma.$transaction as any).mockImplementation((cb: any) => cb(mockTx));

    await service.actualizarEstadoPasajeros(5, {
      version: 2,
      pasajeros: [
        { id: 101, estado: 'VUELO_COMPLETADO' },
        { id: 102, estado: 'VUELO_COMPLETADO' },
      ],
    });

    expect(mockTx.reserva.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 5 },
        data: expect.objectContaining({ estado: 'COMPLETADA' }),
      })
    );
  });

  it('addPago debería mantener DEVUELTO si la reserva ya tiene devoluciones (DEVUELTO prima)', async () => {
    const mockTx = {
      reserva: {
        findUnique: vi.fn().mockResolvedValue({ id: 1, valorTotal: 50000, abono: 50000, montoDevuelto: 50000, estadoPago: 'DEVUELTO' }),
        update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 1, ...data })),
      },
      pago: {
        create: vi.fn().mockResolvedValue({ id: 30, monto: 5000 }),
        aggregate: vi.fn().mockResolvedValue({ _sum: { monto: 50000 } }),
        findMany: vi.fn(),
        update: vi.fn(),
      },
    };

    (prisma.$transaction as any).mockImplementation((cb: any) => cb(mockTx));

    await service.addPago(1, { monto: 5000, metodoPago: 'EFECTIVO' });

    expect(mockTx.reserva.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ estadoPago: 'DEVUELTO' }),
      })
    );
  });

  it('deletePago debería rechazar si quedan devoluciones que superan el abono resultante', async () => {
    const mockTx = {
      reserva: {
        findUnique: vi.fn().mockResolvedValue({ id: 1, version: 1, valorTotal: 50000, abono: 20000, montoDevuelto: 20000, estadoPago: 'DEVUELTO' }),
        update: vi.fn(),
      },
      pago: {
        create: vi.fn(),
        aggregate: vi.fn().mockResolvedValue({ _sum: { monto: 0 } }), // se anula el único pago → abono 0
        findMany: vi.fn(),
        update: vi.fn(),
      },
    };

    (prisma.$transaction as any).mockImplementation((cb: any) => cb(mockTx));

    await expect(service.deletePago(1, 10, 1)).rejects.toThrow('No se puede anular un pago');
    expect(mockTx.reserva.update).not.toHaveBeenCalled();
  });

  it('create debería rechazar montoDevuelto mayor que el abono', async () => {
    await expect(
      service.create({
        nombreTitular: 'X',
        valorTotal: 50000,
        abono: 10000,
        montoDevuelto: 20000,
        estadoPago: 'PENDIENTE',
      } as any)
    ).rejects.toThrow('No se puede devolver más de lo pagado');
  });
});

describe('Reservas Service - Devoluciones (Fase 2 ciclo de vida)', () => {
  let service: ReservasService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ReservasService();
  });

  it('addDevolucion debería registrar la devolución y derivar estadoPago DEVUELTO en reserva CANCELADA', async () => {
    const mockTx = {
      reserva: {
        findFirst: vi.fn().mockResolvedValue({ id: 1, valorTotal: 50000, abono: 50000, estadoPago: 'PAGADO', estado: 'CANCELADA' }),
        update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 1, ...data })),
      },
      devolucion: {
        create: vi.fn().mockResolvedValue({ id: 20, monto: 20000, metodoPago: 'TRANSFERENCIA' }),
        aggregate: vi.fn().mockResolvedValue({ _sum: { monto: null } }), // sin devoluciones previas
      },
      // Tope real contra la suma de pagos activos (50000 pagados)
      pago: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { monto: 50000 } }),
      },
    };

    (prisma.$transaction as any).mockImplementation((cb: any) => cb(mockTx));

    const result = await service.addDevolucion(1, {
      monto: 20000,
      metodoPago: 'TRANSFERENCIA',
      comprobante: 'DEV-001',
    });

    expect(mockTx.devolucion.create).toHaveBeenCalled();
    expect(mockTx.reserva.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({
          montoDevuelto: 20000,
          estadoPago: 'DEVUELTO',
        }),
      })
    );
    expect(result).toBeDefined();
  });

  it('addDevolucion rechaza reservas que no están CANCELADA', async () => {
    const mockTx = {
      reserva: {
        findFirst: vi.fn().mockResolvedValue({ id: 1, valorTotal: 50000, abono: 10000, estado: 'SIN_AGENDAR' }),
        update: vi.fn(),
      },
      devolucion: {
        create: vi.fn(),
        aggregate: vi.fn(),
      },
    };

    (prisma.$transaction as any).mockImplementation((cb: any) => cb(mockTx));

    await expect(service.addDevolucion(1, { monto: 5000 } as any)).rejects.toThrow('solo se permiten');

    expect(mockTx.devolucion.create).not.toHaveBeenCalled();
    expect(mockTx.reserva.update).not.toHaveBeenCalled();
  });

  it('addDevolucion rechaza devolver más de lo pagado', async () => {
    const mockTx = {
      reserva: {
        findFirst: vi.fn().mockResolvedValue({ id: 1, valorTotal: 10000, abono: 10000, estado: 'CANCELADA' }),
        update: vi.fn(),
      },
      devolucion: {
        create: vi.fn(),
        aggregate: vi.fn().mockResolvedValue({ _sum: { monto: null } }),
      },
      // Tope real contra la suma de pagos activos (solo 10000 pagados)
      pago: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { monto: 10000 } }),
      },
    };

    (prisma.$transaction as any).mockImplementation((cb: any) => cb(mockTx));

    await expect(service.addDevolucion(1, { monto: 20000 } as any)).rejects.toThrow('No se puede devolver más de lo pagado');

    expect(mockTx.devolucion.create).not.toHaveBeenCalled();
    expect(mockTx.reserva.update).not.toHaveBeenCalled();
  });

  it('cancelar con devolución atómica cancela la reserva y registra la devolución en un solo paso', async () => {
    const mockTx = {
      reserva: {
        findFirst: vi.fn().mockResolvedValue({
          id: 1,
          nombreTitular: 'Cliente Mal Tiempo',
          valorTotal: 60000,
          abono: 60000,
          montoDevuelto: 0,
          estadoPago: 'PAGADO',
          estado: 'AGENDADA',
          version: 1,
          pasajeros: [{ id: 10 }],
        }),
        update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 1, ...data })),
      },
      vuelo: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      devolucion: {
        create: vi.fn().mockResolvedValue({ id: 99, monto: 60000 }),
        aggregate: vi.fn().mockResolvedValue({ _sum: { monto: null } }),
      },
      // Tope real contra la suma de pagos activos (60000 pagados)
      pago: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { monto: 60000 } }),
      },
    };

    (prisma.$transaction as any).mockImplementation((cb: any) => cb(mockTx));

    const resultado = await service.cancelar(1, {
      motivo: 'Mal tiempo / Lluvia torrencial',
      version: 1,
      devolucion: {
        monto: 60000,
        metodoPago: 'TRANSFERENCIA',
        notas: 'Devolución inmediata',
      },
    });

    expect(mockTx.vuelo.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ estado: 'CANCELADO' }),
      })
    );
    expect(mockTx.devolucion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ monto: 60000, metodoPago: 'TRANSFERENCIA' }),
      })
    );
    expect(mockTx.reserva.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          estado: 'CANCELADA',
          montoDevuelto: 60000,
          estadoPago: 'DEVUELTO',
        }),
      })
    );
    expect(resultado.estado).toBe('CANCELADA');
  });

  it('deleteDevolucion hace soft-delete y recalcula montoDevuelto/estadoPago', async () => {
    const mockTx = {
      reserva: {
        findFirst: vi.fn().mockResolvedValue({ id: 1, valorTotal: 50000, abono: 50000, estadoPago: 'DEVUELTO', estado: 'COMPLETADA' }),
        update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 1, ...data })),
      },
      devolucion: {
        update: vi.fn().mockResolvedValue({ id: 20, deletedAt: new Date() }),
        // Tras anular la única devolución no queda nada devuelto → PAGADO de nuevo
        aggregate: vi.fn().mockResolvedValue({ _sum: { monto: 0 } }),
      },
      // Derivación contra la suma de pagos activos (50000 pagados)
      pago: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { monto: 50000 } }),
      },
    };

    (prisma.$transaction as any).mockImplementation((cb: any) => cb(mockTx));

    await service.deleteDevolucion(1, 20);

    expect(mockTx.devolucion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 20, reservaId: 1, deletedAt: null },
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      })
    );
    expect(mockTx.reserva.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ montoDevuelto: 0, estadoPago: 'PAGADO' }),
      })
    );
  });

  it('addDevolucion lanza 409 (ConflictError) si la version está desactualizada', async () => {
    const mockTx = {
      reserva: {
        findFirst: vi.fn().mockResolvedValue({ id: 1, valorTotal: 50000, abono: 50000, estado: 'CANCELADA', version: 5 }),
        update: vi.fn(),
      },
      devolucion: {
        create: vi.fn(),
        aggregate: vi.fn(),
      },
    };

    (prisma.$transaction as any).mockImplementation((cb: any) => cb(mockTx));

    await expect(service.addDevolucion(1, { monto: 10000, version: 999 } as any)).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe('Reservas Service - getAll (Ordenamiento por fecha más pronta y paginación on-demand)', () => {
  let service: ReservasService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ReservasService();
  });

  it('ordena por fechaAgenda asc con nulls last por defecto en pestaña PROXIMAS (desde sin hasta)', async () => {
    (prisma.reserva.findMany as any).mockResolvedValue([
      { id: 1, nombreTitular: 'Cercana', fechaAgenda: new Date('2026-09-02') },
      { id: 2, nombreTitular: 'Lejana', fechaAgenda: new Date('2026-09-10') },
      { id: 3, nombreTitular: 'Sin Fecha', fechaAgenda: null },
    ]);
    (prisma.reserva.count as any).mockResolvedValue(3);

    const result = await service.getAll({ desde: '2026-09-01T00:00:00.000Z' });

    expect(prisma.reserva.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { fechaAgenda: { sort: 'asc', nulls: 'last' } },
      })
    );
    expect(result.data).toHaveLength(3);
    expect(result.pagination.total).toBe(3);
  });

  it('ordena por fechaAgenda desc con nulls last por defecto en pestaña PASADAS (hasta sin desde)', async () => {
    (prisma.reserva.findMany as any).mockResolvedValue([
      { id: 2, nombreTitular: 'Ayer', fechaAgenda: new Date('2026-08-29') },
      { id: 1, nombreTitular: 'Semana Pasada', fechaAgenda: new Date('2026-08-20') },
    ]);
    (prisma.reserva.count as any).mockResolvedValue(2);

    const result = await service.getAll({ hasta: '2026-08-30T00:00:00.000Z' });

    expect(prisma.reserva.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { fechaAgenda: { sort: 'desc', nulls: 'last' } },
      })
    );
    expect(result.data).toHaveLength(2);
  });

  it('respeta sort explícito fechaAgenda.asc con nulls last', async () => {
    (prisma.reserva.findMany as any).mockResolvedValue([]);
    (prisma.reserva.count as any).mockResolvedValue(0);

    await service.getAll({ sort: 'fechaAgenda.asc' });

    expect(prisma.reserva.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { fechaAgenda: { sort: 'asc', nulls: 'last' } },
      })
    );
  });

  it('pagina on-demand con pageSize=20 y calcula skip/take, totalPages y hasMore', async () => {
    const mockItems = Array.from({ length: 20 }, (_, i) => ({ id: i + 21, nombreTitular: `Reserva ${i + 21}` }));
    (prisma.reserva.findMany as any).mockResolvedValue(mockItems);
    (prisma.reserva.count as any).mockResolvedValue(45);

    const result = await service.getAll({ page: '2', pageSize: '20' });

    expect(prisma.reserva.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 20,
        take: 20,
      })
    );
    expect(result.pagination).toEqual({
      page: 2,
      pageSize: 20,
      total: 45,
      totalPages: 3,
      hasMore: true,
      nextPage: 3,
    });
    expect(result.data).toHaveLength(20);
  });

  describe('Flujo simplificado: desagendar, completada y no editable', () => {
    it('desagendarReserva revierte a SIN_AGENDAR y elimina vuelos activos', async () => {
      const mockTx = {
        reserva: {
          findFirst: vi.fn().mockResolvedValue({
            id: 1,
            version: 0,
            estado: 'AGENDADA',
            fechaAgenda: new Date(),
            horaAgenda: '10:00',
            pasajeros: [{ id: 10 }, { id: 11 }],
          }),
          update: vi.fn().mockResolvedValue({
            id: 1,
            estado: 'SIN_AGENDAR',
            version: 1,
          }),
        },
        vuelo: {
          updateMany: vi.fn().mockResolvedValue({ count: 2 }),
        },
        pasajero: {
          updateMany: vi.fn().mockResolvedValue({ count: 2 }),
        },
      };

      (prisma.$transaction as any).mockImplementation((cb: any) => cb(mockTx));

      const result = await service.desagendar(1);

      expect(mockTx.vuelo.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            reservaId: 1,
            estado: { not: 'COMPLETADO' },
          }),
          data: expect.objectContaining({ deletedAt: expect.any(Date) }),
        })
      );
      expect(mockTx.reserva.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: expect.objectContaining({ estado: 'SIN_AGENDAR' }),
        })
      );
      expect(result.estado).toBe('SIN_AGENDAR');
    });

    it('desagendarReserva rechaza si la reserva ya está SIN_AGENDAR o COMPLETADA', async () => {
      const mockTx = {
        reserva: {
          findFirst: vi.fn().mockResolvedValue({
            id: 1,
            estado: 'SIN_AGENDAR',
            pasajeros: [],
          }),
        },
      };

      (prisma.$transaction as any).mockImplementation((cb: any) => cb(mockTx));

      await expect(service.desagendar(1)).rejects.toThrow('ya se encuentra sin agendar');

      mockTx.reserva.findFirst.mockResolvedValueOnce({
        id: 1,
        estado: 'COMPLETADA',
        pasajeros: [],
      });
      await expect(service.desagendar(1)).rejects.toThrow('No se puede desagendar');
    });

    it('updateReserva rechaza editar reservas en estado COMPLETADA', async () => {
      const mockTx = {
        reserva: {
          findUnique: vi.fn().mockResolvedValue({
            id: 1,
            version: 0,
            estado: 'COMPLETADA',
            valorTotal: 50000,
            abono: 50000,
            estadoPago: 'PAGADO',
          }),
        },
      };

      (prisma.$transaction as any).mockImplementation((cb: any) => cb(mockTx));

      await expect(
        service.update(1, { nombreTitular: 'Nuevo Nombre' } as any)
      ).rejects.toThrow('No se puede editar una reserva completada');
    });

    it('updateReserva actualiza pasajeros existentes por id sin eliminarlos (preserva agenda)', async () => {
      const mockTx = {
        reserva: {
          findUnique: vi.fn().mockImplementation(({ include }) => {
            if (include) {
              return Promise.resolve({
                id: 1,
                version: 1,
                estado: 'AGENDADA',
                pasajeros: [
                  { id: 10, nombre: 'Carlos Renombrado', vuelos: [{ id: 101, estado: 'AGENDADO' }] },
                  { id: 20, nombre: 'Maria Actualizada', vuelos: [{ id: 102, estado: 'AGENDADO' }] },
                ],
              });
            }
            return Promise.resolve({
              id: 1,
              version: 0,
              estado: 'AGENDADA',
              numeroReserva: '260915-01',
              valorTotal: 100000,
              abono: 50000,
              montoDevuelto: 0,
            });
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        pago: { aggregate: vi.fn().mockResolvedValue({ _sum: { monto: 50000 } }) },
        pasajero: {
          findMany: vi.fn().mockResolvedValue([
            { id: 10, numeroPasajero: '260915-01-01', nombre: 'Carlos' },
            { id: 20, numeroPasajero: '260915-01-02', nombre: 'Maria' },
          ]),
          deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
          update: vi.fn().mockResolvedValue({ id: 10 }),
        },
      };

      (prisma.$transaction as any).mockImplementation((cb: any) => cb(mockTx));

      const res = await service.update(1, {
        version: 0,
        pasajeros: [
          { id: 10, nombre: 'Carlos Renombrado', peso: 85 },
          { id: 20, nombre: 'Maria Actualizada', peso: 60 },
        ],
      } as any);

      // Verificaciones críticas de no desagendamiento:
      expect(mockTx.pasajero.deleteMany).not.toHaveBeenCalled();
      expect(mockTx.pasajero.update).toHaveBeenCalledTimes(2);
      expect(mockTx.pasajero.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: expect.objectContaining({ nombre: 'Carlos Renombrado', peso: 85 }),
      });
      expect(mockTx.pasajero.update).toHaveBeenCalledWith({
        where: { id: 20 },
        data: expect.objectContaining({ nombre: 'Maria Actualizada', peso: 60 }),
      });
      expect(res.estado).toBe('AGENDADA');
    });

    it('updateReserva asocia posicionalmente pasajeros si no traen id pero la cantidad coincide', async () => {
      const mockTx = {
        reserva: {
          findUnique: vi.fn().mockImplementation(({ include }) => {
            if (include) {
              return Promise.resolve({
                id: 1,
                version: 1,
                estado: 'AGENDADA',
                pasajeros: [{ id: 10, nombre: 'Carlos Editado' }],
              });
            }
            return Promise.resolve({
              id: 1,
              version: 0,
              estado: 'AGENDADA',
              numeroReserva: '260915-01',
              valorTotal: 50000,
              abono: 50000,
              montoDevuelto: 0,
            });
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        pago: { aggregate: vi.fn().mockResolvedValue({ _sum: { monto: 50000 } }) },
        pasajero: {
          findMany: vi.fn().mockResolvedValue([
            { id: 10, numeroPasajero: '260915-01-01', nombre: 'Carlos' },
          ]),
          deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
          update: vi.fn().mockResolvedValue({ id: 10 }),
        },
      };

      (prisma.$transaction as any).mockImplementation((cb: any) => cb(mockTx));

      await service.update(1, {
        version: 0,
        pasajeros: [{ nombre: 'Carlos Editado', peso: 78 }], // sin id
      } as any);

      expect(mockTx.pasajero.deleteMany).not.toHaveBeenCalled();
      expect(mockTx.pasajero.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: expect.objectContaining({ nombre: 'Carlos Editado', peso: 78 }),
      });
    });

    it('updateReserva preserva firmaDeslinde si se modifican campos no identificatorios (peso, teléfono)', async () => {
      const fechaFirma = new Date('2026-09-10T15:00:00Z');
      const mockTx = {
        reserva: {
          findUnique: vi.fn().mockImplementation(({ include }) => {
            if (include) {
              return Promise.resolve({
                id: 1,
                version: 1,
                estado: 'CONFIRMADA',
                pasajeros: [{ id: 10, nombre: 'Juan Pérez', firmaDeslinde: true, firmaFecha: fechaFirma }],
              });
            }
            return Promise.resolve({
              id: 1,
              version: 0,
              estado: 'CONFIRMADA',
              numeroReserva: '260915-01',
              valorTotal: 50000,
              abono: 50000,
              montoDevuelto: 0,
            });
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        pago: { aggregate: vi.fn().mockResolvedValue({ _sum: { monto: 50000 } }) },
        pasajero: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 10,
              numeroPasajero: '260915-01-01',
              nombre: 'Juan Pérez',
              rutDni: '12.345.678-9',
              firmaDeslinde: true,
              firmaFecha: fechaFirma,
              deslindeFirma: { id: 1, firmaBase64: 'data:image/png;base64,abc' },
            },
          ]),
          deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
          update: vi.fn().mockResolvedValue({ id: 10 }),
        },
        deslindeFirma: {
          deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
          upsert: vi.fn().mockResolvedValue({ id: 1 }),
        },
      };

      (prisma.$transaction as any).mockImplementation((cb: any) => cb(mockTx));

      await service.update(1, {
        version: 0,
        pasajeros: [
          { id: 10, nombre: 'Juan Pérez', rutDni: '12.345.678-9', peso: 82, telefono: '+56911112222' },
        ],
      } as any);

      expect(mockTx.deslindeFirma.deleteMany).not.toHaveBeenCalled();
      expect(mockTx.pasajero.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: expect.objectContaining({
          nombre: 'Juan Pérez',
          peso: 82,
          firmaDeslinde: true,
          firmaFecha: fechaFirma,
        }),
      });
    });

    it('updateReserva invalida firmaDeslinde y elimina deslindeFirma si cambia el nombre del pasajero', async () => {
      const fechaFirma = new Date('2026-09-10T15:00:00Z');
      const mockTx = {
        reserva: {
          findUnique: vi.fn().mockImplementation(({ include }) => {
            if (include) {
              return Promise.resolve({
                id: 1,
                version: 1,
                estado: 'CONFIRMADA',
                pasajeros: [{ id: 10, nombre: 'Pedro Pascal', firmaDeslinde: false, firmaFecha: null }],
              });
            }
            return Promise.resolve({
              id: 1,
              version: 0,
              estado: 'CONFIRMADA',
              numeroReserva: '260915-01',
              valorTotal: 50000,
              abono: 50000,
              montoDevuelto: 0,
            });
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        pago: { aggregate: vi.fn().mockResolvedValue({ _sum: { monto: 50000 } }) },
        pasajero: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 10,
              numeroPasajero: '260915-01-01',
              nombre: 'Juan Pérez',
              rutDni: '12.345.678-9',
              firmaDeslinde: true,
              firmaFecha: fechaFirma,
              deslindeFirma: { id: 1, firmaBase64: 'data:image/png;base64,abc' },
            },
          ]),
          deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
          update: vi.fn().mockResolvedValue({ id: 10 }),
        },
        deslindeFirma: {
          deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
          upsert: vi.fn().mockResolvedValue({ id: 1 }),
        },
      };

      (prisma.$transaction as any).mockImplementation((cb: any) => cb(mockTx));

      await service.update(1, {
        version: 0,
        pasajeros: [
          { id: 10, nombre: 'Pedro Pascal', rutDni: '12.345.678-9', peso: 75 },
        ],
      } as any);

      // Debe eliminar la firma digital previa del cupo 10
      expect(mockTx.deslindeFirma.deleteMany).toHaveBeenCalledWith({
        where: { pasajeroId: 10 },
      });
      // Debe actualizar con firmaDeslinde: false y firmaFecha: null
      expect(mockTx.pasajero.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: expect.objectContaining({
          nombre: 'Pedro Pascal',
          firmaDeslinde: false,
          firmaFecha: null,
        }),
      });
    });

    it('updateReserva invalida firmaDeslinde si cambia el RUT a uno diferente', async () => {
      const fechaFirma = new Date('2026-09-10T15:00:00Z');
      const mockTx = {
        reserva: {
          findUnique: vi.fn().mockImplementation(({ include }) => {
            if (include) {
              return Promise.resolve({
                id: 1,
                version: 1,
                estado: 'CONFIRMADA',
                pasajeros: [{ id: 10, nombre: 'Juan Pérez', firmaDeslinde: false, firmaFecha: null }],
              });
            }
            return Promise.resolve({
              id: 1,
              version: 0,
              estado: 'CONFIRMADA',
              numeroReserva: '260915-01',
              valorTotal: 50000,
              abono: 50000,
              montoDevuelto: 0,
            });
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        pago: { aggregate: vi.fn().mockResolvedValue({ _sum: { monto: 50000 } }) },
        pasajero: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 10,
              numeroPasajero: '260915-01-01',
              nombre: 'Juan Pérez',
              rutDni: '11.111.111-1',
              firmaDeslinde: true,
              firmaFecha: fechaFirma,
              deslindeFirma: { id: 1, firmaBase64: 'data:image/png;base64,abc' },
            },
          ]),
          deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
          update: vi.fn().mockResolvedValue({ id: 10 }),
        },
        deslindeFirma: {
          deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
          upsert: vi.fn().mockResolvedValue({ id: 1 }),
        },
      };

      (prisma.$transaction as any).mockImplementation((cb: any) => cb(mockTx));

      await service.update(1, {
        version: 0,
        pasajeros: [
          { id: 10, nombre: 'Juan Pérez', rutDni: '22.222.222-2', peso: 75 },
        ],
      } as any);

      expect(mockTx.deslindeFirma.deleteMany).toHaveBeenCalledWith({
        where: { pasajeroId: 10 },
      });
      expect(mockTx.pasajero.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: expect.objectContaining({
          firmaDeslinde: false,
          firmaFecha: null,
        }),
      });
    });

    it('updateReserva preserva firmaDeslinde si se normalizan tildes o se agrega RUT al mismo nombre', async () => {
      const fechaFirma = new Date('2026-09-10T15:00:00Z');
      const mockTx = {
        reserva: {
          findUnique: vi.fn().mockImplementation(({ include }) => {
            if (include) {
              return Promise.resolve({
                id: 1,
                version: 1,
                estado: 'CONFIRMADA',
                pasajeros: [{ id: 10, nombre: 'Sebastián Pérez', firmaDeslinde: true, firmaFecha: fechaFirma }],
              });
            }
            return Promise.resolve({
              id: 1,
              version: 0,
              estado: 'CONFIRMADA',
              numeroReserva: '260915-01',
              valorTotal: 50000,
              abono: 50000,
              montoDevuelto: 0,
            });
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        pago: { aggregate: vi.fn().mockResolvedValue({ _sum: { monto: 50000 } }) },
        pasajero: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 10,
              numeroPasajero: '260915-01-01',
              nombre: 'Sebastian Perez', // sin tilde en BD
              rutDni: null, // sin rut original
              firmaDeslinde: true,
              firmaFecha: fechaFirma,
              deslindeFirma: { id: 1, firmaBase64: 'data:image/png;base64,abc' },
            },
          ]),
          deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
          update: vi.fn().mockResolvedValue({ id: 10 }),
        },
        deslindeFirma: {
          deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
          upsert: vi.fn().mockResolvedValue({ id: 1 }),
        },
      };

      (prisma.$transaction as any).mockImplementation((cb: any) => cb(mockTx));

      await service.update(1, {
        version: 0,
        pasajeros: [
          { id: 10, nombre: '  Sebastián Pérez  ', rutDni: '12.345.678-k', peso: 70 }, // con tilde y agregando RUT
        ],
      } as any);

      expect(mockTx.deslindeFirma.deleteMany).not.toHaveBeenCalled();
      expect(mockTx.pasajero.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: expect.objectContaining({
          firmaDeslinde: true,
          firmaFecha: fechaFirma,
        }),
      });
    });
  });
});

