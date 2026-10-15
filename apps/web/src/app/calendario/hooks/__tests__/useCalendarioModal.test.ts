// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '../../../../test/render';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { VueloDTO } from '@parapente/shared';
import { useCalendarioModal } from '../useCalendarioModal';
import { typedApiOutbox } from '../../../../services/apiOutbox';

vi.mock('../../../../services/apiOutbox', () => ({
  typedApiOutbox: {
    vuelos: {
      crear: vi.fn(),
      actualizar: vi.fn(),
      agendarGrupo: vi.fn(),
    },
  },
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

describe('useCalendarioModal — antirregresión A-07', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  it('bloquea envíos concurrentes duplicados mediante submittingRef', async () => {
    let resolverApi: (val: VueloDTO) => void = () => {};
    vi.mocked(typedApiOutbox.vuelos.crear).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolverApi = resolve;
        }),
    );

    type ModalProps = Parameters<typeof useCalendarioModal>[0];
    const baseProps: ModalProps = {
      vuelos: [],
      pilotos: [
        { id: 1, nombre: 'Piloto Test', activo: true } as unknown as ModalProps['pilotos'][number],
      ],
      pasajeros: [
        {
          id: 10,
          nombre: 'Pasajero Test',
          reservaId: 100,
        } as unknown as ModalProps['pasajeros'][number],
      ],
      reservas: [],
      refetchVuelos: vi.fn(),
      refetchReservas: vi.fn(),
      refetchPasajeros: vi.fn(),
      getDateKey: (d: Date) => d.toISOString().slice(0, 10),
    };

    const { result } = renderHook(() => useCalendarioModal(baseProps), { wrapper });

    // Configurar formulario válido para agendar vuelo individual
    act(() => {
      result.current.setFormData({
        pilotoId: '1',
        pasajeroId: '10',
        fecha: '2030-10-14',
        hora: '14:00',
        valorPactado: '70000',
      });
    });

    const fakeEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent;

    // Disparar primer submit (queda pendiente en resolverApi)
    let p1: Promise<void>;
    act(() => {
      p1 = result.current.handleSubmit(fakeEvent);
    });

    expect(result.current.isSubmitting).toBe(true);

    // Disparar segundo submit inmediatamente antes de que el primero termine
    await act(async () => {
      await result.current.handleSubmit(fakeEvent);
    });

    // Desbloquear el primer submit
    await act(async () => {
      resolverApi({ id: 123 } as unknown as VueloDTO);
      await p1!;
    });

    // typedApiOutbox.vuelos.crear SOLO debe haberse llamado UNA sola vez
    expect(typedApiOutbox.vuelos.crear).toHaveBeenCalledTimes(1);
    expect(result.current.isSubmitting).toBe(false);
  });
});
