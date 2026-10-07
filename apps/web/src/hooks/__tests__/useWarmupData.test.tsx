import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import Cookies from 'js-cookie';
import { useWarmupData } from '../useWarmupData';

const mockPrefetch = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    prefetch: mockPrefetch,
    push: vi.fn(),
  }),
}));

vi.mock('js-cookie', () => ({
  default: {
    get: vi.fn(),
  },
}));

vi.mock('../../services/api', () => ({
  default: {
    dashboard: { stats: vi.fn().mockResolvedValue({}) },
    pilotos: { listar: vi.fn().mockResolvedValue({ data: [] }) },
    pasajeros: { listar: vi.fn().mockResolvedValue({ data: [] }) },
    reservas: { listar: vi.fn().mockResolvedValue({ data: [], pagination: {} }) },
    vuelos: { listar: vi.fn().mockResolvedValue({ data: [] }) },
    configuracion: {
      listar: vi.fn().mockResolvedValue([]),
      resolver: vi.fn().mockResolvedValue({}),
    },
    tarifas: { listar: vi.fn().mockResolvedValue({ data: [] }) },
    promociones: { listar: vi.fn().mockResolvedValue({ data: [] }) },
    reglasOperativas: { listar: vi.fn().mockResolvedValue([]) },
    deslindes: { listar: vi.fn().mockResolvedValue([]) },
    empresa: { obtener: vi.fn().mockResolvedValue({}) },
    faqs: { listar: vi.fn().mockResolvedValue({ data: [] }) },
  },
}));

function crearWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, gcTime: Infinity },
    },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, Wrapper };
}

describe('useWarmupData (ADR 009 - precarga offline de ±15 días)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('no ejecuta prefetch si no hay token de autenticación', () => {
    (Cookies.get as unknown as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
    const { queryClient, Wrapper } = crearWrapper();
    const spyPrefetch = vi.spyOn(queryClient, 'prefetchQuery');

    renderHook(() => useWarmupData(), { wrapper: Wrapper });

    expect(spyPrefetch).not.toHaveBeenCalled();
  });

  it('ejecuta prefetch de datos operativos y calentamiento RSC cuando hay token', async () => {
    (Cookies.get as unknown as ReturnType<typeof vi.fn>).mockReturnValue('mock-jwt-token');
    const spyFetch = vi.spyOn(window, 'fetch').mockImplementation(() => Promise.resolve(new Response()));
    const { queryClient, Wrapper } = crearWrapper();
    const spyPrefetch = vi.spyOn(queryClient, 'prefetchQuery');
    const spyPrefetchInfinite = vi.spyOn(queryClient, 'prefetchInfiniteQuery');

    renderHook(() => useWarmupData(), { wrapper: Wrapper });

    expect(spyPrefetch).toHaveBeenCalled();
    expect(spyPrefetchInfinite).toHaveBeenCalled();

    const queryKeys = spyPrefetch.mock.calls.map((call) => call[0].queryKey);
    expect(queryKeys.some((k) => k[0] === 'dashboard')).toBe(true);
    expect(queryKeys.some((k) => k[0] === 'pilotos')).toBe(true);
    expect(queryKeys.some((k) => k[0] === 'reservas')).toBe(true);
    expect(queryKeys.some((k) => k[0] === 'vuelos')).toBe(true);
    expect(queryKeys.some((k) => k[0] === 'configuracion-bloques')).toBe(true);
    expect(queryKeys.some((k) => k[0] === 'tarifas')).toBe(true);
    expect(queryKeys.some((k) => k[0] === 'promociones')).toBe(true);
    expect(queryKeys.some((k) => k[0] === 'reglas-operativas')).toBe(true);
    expect(queryKeys.some((k) => k[0] === 'deslindes')).toBe(true);
    expect(queryKeys.some((k) => k[0] === 'equipos')).toBe(true);
    expect(queryKeys.some((k) => k[0] === 'plantillas')).toBe(true);

    expect(mockPrefetch).toHaveBeenCalledWith('/');
    expect(mockPrefetch).toHaveBeenCalledWith('/reservas');
    expect(mockPrefetch).toHaveBeenCalledWith('/calendario');
    expect(mockPrefetch).toHaveBeenCalledWith('/pilotos');

    // Verifica que se ejecutó el precalentamiento activo de RSC hacia el Service Worker
    await waitFor(() => {
      const fetchCalls = spyFetch.mock.calls;
      expect(fetchCalls.some((call) => String(call[0]).includes('/reservas') && (call[1] as unknown as { headers?: Record<string,string> } | undefined)?.headers?.RSC === '1')).toBe(true);
      expect(fetchCalls.some((call) => String(call[0]).includes('/calendario') && (call[1] as unknown as { headers?: Record<string,string> } | undefined)?.headers?.RSC === '1')).toBe(true);
    });
    spyFetch.mockRestore();
  });
});
