import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { useReservas } from '../useReservas';
import { typedApiOutbox } from '../../services/apiOutbox';
import type { CreateReservaPayload, ReservaDTO } from '@parapente/shared';

vi.mock('../../services/api', () => ({
  default: {
    reservas: {
      listar: vi.fn(() => new Promise(() => {})),
    },
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}));

vi.mock('../../services/apiOutbox', () => ({
  typedApiOutbox: {
    reservas: {
      crear: vi.fn(),
    },
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

function crearWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, Wrapper };
}

describe('useReservas — Anti-regresión M-02 (Shape de Pasajero Optimista)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inyecta campos `nombre` y `estado: PENDIENTE` en el pasajero optimista durante mutaciones', async () => {
    // Nunca resuelve la promesa para poder inspeccionar la mutación optimista en curso
    vi.mocked(typedApiOutbox.reservas.crear).mockReturnValue(new Promise(() => {}));

    const { queryClient, Wrapper } = crearWrapper();
    // Pre-cargar la primera página en caché
    queryClient.setQueryData(['reservas', { tab: 'PROXIMAS' }], {
      pages: [
        {
          data: [],
          pagination: {
            page: 1,
            pageSize: 20,
            total: 0,
            totalPages: 1,
            hasMore: false,
            nextPage: null,
          },
        },
      ],
      pageParams: [undefined],
    });

    const { result } = renderHook(() => useReservas(), { wrapper: Wrapper });

    await act(async () => {
      // Disparar mutación optimista (sin esperar a que resuelva)
      result.current
        .createReserva({
          nombreTitular: 'Titular Juan',
          email: 'juan@test.com',
          telefono: '+56911111111',
          valorTotal: 50000,
          abono: 20000,
          pasajeros: [
            {
              nombre: 'Pasajero Pedro',
              rutDni: '12345678-9',
              peso: 75,
            },
          ],
        } as unknown as CreateReservaPayload)
        .catch(() => {});
    });

    // Consultar el estado optimista en caché
    interface ReservaWithPasajeros extends ReservaDTO {
      pasajeros?: Array<{
        nombre?: string;
        nombreCompleto?: string;
        estado?: string;
        estadoVuelo?: string;
      }>;
    }

    const cacheData = queryClient.getQueryData<{
      pages: { data: ReservaWithPasajeros[] }[];
    }>(['reservas', { tab: 'PROXIMAS' }]);
    expect(cacheData).toBeDefined();
    const reservaOptimista = cacheData?.pages[0].data[0];
    expect(reservaOptimista).toBeDefined();
    if (!reservaOptimista || !reservaOptimista.pasajeros) {
      throw new Error('Reserva optimista o sus pasajeros no encontrados en caché');
    }
    expect(reservaOptimista.nombreTitular).toBe('Titular Juan');

    // Verificar que el pasajero contiene ambos: nombreCompleto y nombre, más estado PENDIENTE
    const pasajeroOptimista = reservaOptimista.pasajeros[0];
    expect(pasajeroOptimista.nombre).toBe('Pasajero Pedro');
    expect(pasajeroOptimista.nombreCompleto).toBe('Pasajero Pedro');
    expect(pasajeroOptimista.estado).toBe('PENDIENTE');
    expect(pasajeroOptimista.estadoVuelo).toBe('POR_VOLAR');
  });
});
