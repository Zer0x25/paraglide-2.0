import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const mockCreateReserva = vi.fn().mockResolvedValue({ id: 99 });
const mockUpdateReserva = vi.fn().mockResolvedValue({ id: 1 });
const mockListarTarifas = vi.fn().mockResolvedValue({ data: [] });
const mockListarPromos = vi.fn().mockResolvedValue({ data: [] });
const mockListarReglas = vi.fn().mockResolvedValue([]);
const mockCalcularValor = vi.fn().mockResolvedValue({ valorTotal: 90000, detalle: 'Tarifa×1 - 10%', descuento: 10000 });

vi.mock('../../../hooks/useReservas', () => ({
  useReservas: vi.fn(() => ({
    reservas: [],
    total: 0,
    filtros: { tab: 'PROXIMAS' },
    loading: false,
    error: null,
    refetch: vi.fn(),
    setFiltros: vi.fn(),
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    createReserva: mockCreateReserva,
    updateReserva: mockUpdateReserva,
    deleteReserva: vi.fn(),
    cancelarReserva: vi.fn(),
    cancelando: false,
    desagendarReserva: vi.fn(),
    desagendando: false,
  })),
}));

vi.mock('../../../hooks/useMeteorologia', () => ({
  useMeteorologia: () => ({ pronostico: null }),
}));

vi.mock('../../../services/api', () => ({
  default: {
    tarifas: { listar: (...a: unknown[]) => mockListarTarifas(...a) },
    promociones: { listar: (...a: unknown[]) => mockListarPromos(...a) },
    reglasOperativas: { listar: (...a: unknown[]) => mockListarReglas(...a) },
    reservas: { calcularValor: (...a: unknown[]) => mockCalcularValor(...a) },
  },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { useReservasController } from './useReservasController';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, }});
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

const baseReserva = {
  id: 1,
  nombreTitular: 'Titular Test',
  rutDniTitular: '11111111-1',
  telefono: '+56911111111',
  email: 'a@b.cl',
  esGiftCard: false,
  valorTotal: 80000,
  abono: 0,
  estado: 'SIN_AGENDAR' as const,
  version: 2,
  pasajeros: [{ nombre: 'Pax 1', rutDni: '22222222-2', peso: 70, vuelos: [] }],
} as unknown as Parameters<ReturnType<typeof useReservasController>['handleEditModal']>[0];

describe('useReservasController — antirregresión tarifa/promoción en edición', () => {
  beforeEach(() => vi.clearAllMocks());

  it('handleEditModal restaura tarifaSeleccionada y promoSeleccionada desde la reserva', async () => {
    const { result } = renderHook(() => useReservasController(), { wrapper });
    // esperar queries iniciales
    await waitFor(() => expect(mockListarTarifas).toHaveBeenCalled());

    const reservaConTarifa = { ...baseReserva, tarifaId: 5, promocionId: 9 } as unknown as typeof baseReserva;

    act(() => { result.current.handleEditModal(reservaConTarifa); });

    expect(result.current.editingId).toBe(1);
    expect(result.current.tarifaSeleccionada).toBe(5);
    expect(result.current.promoSeleccionada).toBe(9);
  });

  it('handleEditModal con reserva sin tarifa deja selects en ""', async () => {
    const { result } = renderHook(() => useReservasController(), { wrapper });
    await waitFor(() => expect(mockListarTarifas).toHaveBeenCalled());

    act(() => { result.current.handleEditModal(baseReserva); });

    expect(result.current.tarifaSeleccionada).toBe('');
    expect(result.current.promoSeleccionada).toBe('');
  });

  it('re-editar conserva datos: dos ediciones seguidas mantienen tarifa', async () => {
    const { result } = renderHook(() => useReservasController(), { wrapper });
    await waitFor(() => expect(mockListarTarifas).toHaveBeenCalled());

    const r1 = { ...baseReserva, tarifaId: 5, promocionId: 9 } as unknown as typeof baseReserva;
    act(() => { result.current.handleEditModal(r1); });
    expect(result.current.tarifaSeleccionada).toBe(5);

    // Simular cerrar y volver a editar la misma reserva (bug original: se perdía)
    act(() => { result.current.setIsModalOpen(false); });
    act(() => { result.current.handleEditModal(r1); });
    expect(result.current.tarifaSeleccionada).toBe(5);
    expect(result.current.promoSeleccionada).toBe(9);
  });

  it('onSubmit en edición envía tarifaId/promocionId snapshot al backend', async () => {
    const { result } = renderHook(() => useReservasController(), { wrapper });
    await waitFor(() => expect(mockListarTarifas).toHaveBeenCalled());

    const r = { ...baseReserva, tarifaId: 5, promocionId: 9 } as unknown as typeof baseReserva;
    act(() => { result.current.handleEditModal(r); });

    // onSubmit recibe data del form; tarifa/promo vienen del estado del hook
    const payload = {
      nombreTitular: 'Titular Test',
      rutDniTitular: '11111111-1',
      telefono: '+56911111111',
      email: 'a@b.cl',
      esGiftCard: false,
      fechaAgenda: null,
      horaAgenda: null,
      valorTotal: 90000,
      abono: 0,
      estadoPago: 'PENDIENTE' as const,
      pasajeros: [{ nombre: 'Pax 1', rutDni: '22222222-2', peso: 70 }],
    } as unknown as Parameters<typeof result.current.onSubmit>[0];

    await act(async () => { await result.current.onSubmit(payload); });

    expect(mockUpdateReserva).toHaveBeenCalledTimes(1);
    const sent = mockUpdateReserva.mock.calls[0][1] as Record<string, unknown>;
    expect(sent.tarifaId).toBe(5);
    expect(sent.promocionId).toBe(9);
    expect(sent.version).toBe(2);
  });

  it('onSubmit en edición NO envía importes derivados (abono/montoDevuelto/estadoPago) — punto 3', async () => {
    const { result } = renderHook(() => useReservasController(), { wrapper });
    await waitFor(() => expect(mockListarTarifas).toHaveBeenCalled());

    const r = { ...baseReserva, tarifaId: 5, promocionId: 9 } as unknown as typeof baseReserva;
    act(() => { result.current.handleEditModal(r); });

    // Aunque el form traiga valores de la reserva, los importes derivados no viajan:
    // el servidor los re-deriva de los pagos/devoluciones registrados.
    const payload = {
      nombreTitular: 'Titular Test',
      rutDniTitular: '11111111-1',
      telefono: '+56911111111',
      email: 'a@b.cl',
      esGiftCard: false,
      fechaAgenda: null,
      horaAgenda: null,
      valorTotal: 90000,
      abono: 45000,
      montoDevuelto: 1000,
      estadoPago: 'ABONADO' as const,
      pasajeros: [{ nombre: 'Pax 1', rutDni: '22222222-2', peso: 70 }],
    } as unknown as Parameters<typeof result.current.onSubmit>[0];

    await act(async () => { await result.current.onSubmit(payload); });

    expect(mockUpdateReserva).toHaveBeenCalledTimes(1);
    const sent = mockUpdateReserva.mock.calls[0][1] as Record<string, unknown>;
    expect(sent.abono).toBeUndefined();
    expect(sent.montoDevuelto).toBeUndefined();
    expect(sent.estadoPago).toBeUndefined();
    expect(sent.valorTotal).toBe(90000);
  });

  it('onSubmit en edición con tarifa limpiada envía null para borrar snapshot', async () => {
    const { result } = renderHook(() => useReservasController(), { wrapper });
    await waitFor(() => expect(mockListarTarifas).toHaveBeenCalled());

    const r = { ...baseReserva, tarifaId: 5, promocionId: 9 } as unknown as typeof baseReserva;
    act(() => { result.current.handleEditModal(r); });
    // Usuario limpia la tarifa
    act(() => { result.current.setTarifaSeleccionada(''); });
    act(() => { result.current.setPromoSeleccionada(''); });

    const payload = {
      nombreTitular: 'Titular Test', rutDniTitular: '11111111-1', telefono: '+56911111111',
      email: 'a@b.cl', esGiftCard: false, fechaAgenda: null, horaAgenda: null,
      valorTotal: 80000, abono: 0, estadoPago: 'PENDIENTE' as const,
      pasajeros: [{ nombre: 'Pax 1', rutDni: '22222222-2', peso: 70 }],
    } as unknown as Parameters<typeof result.current.onSubmit>[0];

    await act(async () => { await result.current.onSubmit(payload); });

    const sent = mockUpdateReserva.mock.calls[0][1] as Record<string, unknown>;
    expect(sent.tarifaId).toBeNull();
    expect(sent.promocionId).toBeNull();
  });

  it('onSubmit en edición conserva id numérico de los pasajeros existentes', async () => {
    const { result } = renderHook(() => useReservasController(), { wrapper });
    await waitFor(() => expect(mockListarTarifas).toHaveBeenCalled());

    const r = {
      ...baseReserva,
      pasajeros: [
        { id: 42, nombre: 'Carlos Original', rutDni: '12345678-9', peso: 80, vuelos: [{ id: 101, estado: 'AGENDADO' }] },
        { id: 43, nombre: 'Maria Original', rutDni: '98765432-1', peso: 60, vuelos: [{ id: 102, estado: 'AGENDADO' }] },
      ],
    } as unknown as typeof baseReserva;

    act(() => { result.current.handleEditModal(r); });

    const payload = {
      nombreTitular: 'Titular Editado',
      rutDniTitular: '11111111-1',
      telefono: '+56911111111',
      email: 'a@b.cl',
      esGiftCard: false,
      fechaAgenda: '2026-09-15T10:00:00.000Z',
      horaAgenda: '10:00',
      valorTotal: 160000,
      abono: 0,
      estadoPago: 'PENDIENTE' as const,
      pasajeros: [
        { id: 42, nombre: 'Carlos Renombrado', rutDni: '12345678-9', peso: 82 },
        { id: 43, nombre: 'Maria Actualizada', rutDni: '98765432-1', peso: 61 },
        { nombre: 'Nuevo Pasajero 3', rutDni: '11223344-5', peso: 70 }, // nuevo sin id
      ],
    } as unknown as Parameters<typeof result.current.onSubmit>[0];

    await act(async () => { await result.current.onSubmit(payload); });

    expect(mockUpdateReserva).toHaveBeenCalledTimes(1);
    const sent = mockUpdateReserva.mock.calls[0][1] as { pasajeros: Array<{ id?: number; nombre: string }> };
    expect(sent.pasajeros).toHaveLength(3);
    expect(sent.pasajeros[0].id).toBe(42);
    expect(sent.pasajeros[0].nombre).toBe('Carlos Renombrado');
    expect(sent.pasajeros[1].id).toBe(43);
    expect(sent.pasajeros[1].nombre).toBe('Maria Actualizada');
    expect(sent.pasajeros[2].id).toBeUndefined();
    expect(sent.pasajeros[2].nombre).toBe('Nuevo Pasajero 3');
  });
});
