import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { useReservas } from '../useReservas';

// Mock de api.reservas.listar — el hook construye filtros server-side
const mockListar = vi.fn();
vi.mock('../../services/api', () => ({
  default: {
    reservas: { listar: (...args: unknown[]) => mockListar(...args) },
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}));

// Mock de outbox (no usado en este test)
vi.mock('../../services/apiOutbox', () => ({
  typedApiOutbox: { reservas: { crear: vi.fn() } },
}));

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useReservas — antirregresión key duplicado `21` (offset pagination)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deduplica ids que aparecen en dos páginas contiguas por offset shift', async () => {
    // Página 1: ids [1, 21], página 2: [21, 2] — 21 duplicado por OR fechaAgenda null + write concurrente
    mockListar
      .mockResolvedValueOnce({
        data: [
          { id: 1, nombreTitular: 'A' },
          { id: 21, nombreTitular: 'B' },
        ],
        pagination: { page: 1, pageSize: 20, total: 3, totalPages: 2, hasMore: true, nextPage: 2 },
      })
      .mockResolvedValueOnce({
        data: [
          { id: 21, nombreTitular: 'B-dup' },
          { id: 2, nombreTitular: 'C' },
        ],
        pagination: { page: 2, pageSize: 20, total: 3, totalPages: 2, hasMore: false, nextPage: null },
      });

    const { result } = renderHook(() => useReservas(), { wrapper });

    // Espera a que cargue la primera página
    await waitFor(() => expect(result.current.reservas.length).toBeGreaterThan(0));
    expect(result.current.reservas.map((r) => r.id)).toEqual([1, 21]);

    // Fetch siguiente página
    await result.current.fetchNextPage();
    await waitFor(() => expect(mockListar).toHaveBeenCalledTimes(2));

    // Sin deduplicación habría 4 elementos con 21 repetido y React key collision en page.tsx:81
    // Con deduplicación debe haber 3 únicos en orden de primera aparición
    await waitFor(() => expect(result.current.reservas.length).toBe(3));
    const ids = result.current.reservas.map((r) => r.id);
    expect(ids).toEqual([1, 21, 2]);
    expect(new Set(ids).size).toBe(ids.length);
    // No hay dos children con key `21`
    expect(ids.filter((id) => id === 21).length).toBe(1);
  });

  it('tolera páginas con ids null/undefined sin romper el Set', async () => {
    mockListar.mockResolvedValueOnce({
      data: [
        { id: 1, nombreTitular: 'A' },
        { nombreTitular: 'sin id' } as unknown as { id: number },
      ],
      pagination: { page: 1, pageSize: 20, total: 2, totalPages: 1, hasMore: false, nextPage: null },
    });

    const { result } = renderHook(() => useReservas(), { wrapper });
    await waitFor(() => expect(result.current.reservas.length).toBe(2));
    // No lanza y conserva ambos
    expect(result.current.reservas.length).toBe(2);
  });
});
