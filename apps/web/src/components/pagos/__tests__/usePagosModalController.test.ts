// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '../../../test/render';
import { usePagosModalController } from '../usePagosModalController';
import { typedApiOutbox } from '../../../services/apiOutbox';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../services/apiOutbox', () => ({
  typedApiOutbox: {
    reservas: {
      agregarPago: vi.fn(),
      eliminarPago: vi.fn(),
      actualizarEstadoPasajeros: vi.fn(),
      crearDevolucion: vi.fn(),
      eliminarDevolucion: vi.fn(),
    },
  },
}));

describe('usePagosModalController — antirregresión A-03', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('encolado offline secuencial incrementa la versión optimista y notifica con toast.info sin error', async () => {
    const onSuccess = vi.fn();
    const onClose = vi.fn();

    const mockReserva = {
      id: 10,
      version: 1,
      valorTotal: 100000,
      pagos: [],
      pasajeros: [
        {
          id: 101,
          nombre: 'Ana',
          estado: 'POR_VOLAR' as const,
        },
      ],
    };

    // Simular error de encolado offline en ambas mutaciones
    vi.mocked(typedApiOutbox.reservas.agregarPago).mockRejectedValueOnce({
      queued: true,
      message: 'Encolado en Outbox',
    });
    vi.mocked(typedApiOutbox.reservas.actualizarEstadoPasajeros).mockRejectedValueOnce({
      queued: true,
      message: 'Encolado en Outbox',
    });

    const { result } = renderHook(() =>
      usePagosModalController({
        reserva: mockReserva as any,
        onSuccess,
        onClose,
      }),
    );

    // Preparar abono pendiente y marcar vuelo como completado
    act(() => {
      result.current.setMonto(50000);
      result.current.setComprobante('TR-1234');
      result.current.setNotas('Pago 50%');
    });

    act(() => {
      result.current.handleAddPago({ preventDefault: () => {} } as any);
      result.current.setVueloCompletado(true);
    });

    // Ejecutar guardado
    await act(async () => {
      await result.current.handleSave();
    });

    // 1. agregarPago debió invocarse con la versión inicial (1)
    expect(typedApiOutbox.reservas.agregarPago).toHaveBeenCalledWith(
      10,
      expect.objectContaining({
        monto: 50000,
        version: 1,
      }),
    );

    // 2. actualizarEstadoPasajeros debió invocarse con versión incrementada (2) optimísticamente
    expect(typedApiOutbox.reservas.actualizarEstadoPasajeros).toHaveBeenCalledWith(
      10,
      expect.objectContaining({
        version: 2,
      }),
    );

    // 3. No debió dispararse toast.error de red ni conflicto
    expect(toast.error).not.toHaveBeenCalled();

    // 4. Se informó al usuario de forma no intrusiva con toast.info
    expect(toast.info).toHaveBeenCalledWith(
      'Sin conexión: los cambios se enviarán automáticamente al reconectar',
    );

    // 5. Se completó el cierre del modal
    expect(onSuccess).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
