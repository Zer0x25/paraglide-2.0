import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import { ReactNode } from 'react';
import { toast } from 'sonner';
import {
  useDomainMutation,
  isConflictError,
} from '../useDomainMutation';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function crearWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, Wrapper };
}

const KEY = ['pilotos'] as const;

describe('useDomainMutation — optimistic updates (ADR 004/009)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('(a) aplica el updater inmediatamente antes de resolver la mutación', async () => {
    const { queryClient, Wrapper } = crearWrapper();
    queryClient.setQueryData(KEY, ['a']);

    let resolverMutacion: (v: string) => void;
    const promesa = new Promise<string>((res) => {
      resolverMutacion = res;
    });

    const { result } = renderHook(
      () =>
        useDomainMutation<string, string>({
          invalidateKeys: [],
          mutationFn: () => promesa,
          optimisticUpdate: {
            queryKey: KEY,
            updater: (previo, variables) =>
              [...(previo as string[]), variables],
          },
        }),
      { wrapper: Wrapper },
    );

    act(() => {
      result.current.mutate('b');
    });

    // onMutate es async: esperamos un tick para que el updater optimista se aplique.
    await act(async () => {
      await Promise.resolve();
    });

    // Antes de que la mutación resuelva, el dato ya está actualizado.
    expect(queryClient.getQueryData(KEY)).toEqual(['a', 'b']);

    await act(async () => {
      resolverMutacion!('ok');
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // El éxito no restaura el snapshot: se mantiene el valor optimista.
    expect(queryClient.getQueryData(KEY)).toEqual(['a', 'b']);
  });

  it('(b) hace rollback tras un error no-409', async () => {
    const { queryClient, Wrapper } = crearWrapper();
    queryClient.setQueryData(KEY, { items: 1 });

    const { result } = renderHook(
      () =>
        useDomainMutation<void, void>({
          invalidateKeys: [],
          mutationFn: async () => {
            throw Object.assign(new Error('boom'), {
              response: { status: 500 },
            });
          },
          optimisticUpdate: {
            queryKey: KEY,
            updater: (previo) => ({ ...(previo as object), items: 99 }),
          },
        }),
      { wrapper: Wrapper },
    );

    await act(async () => {
      result.current.mutate();
    });
    await waitFor(() => expect(result.current.isError).toBe(true));

    // Snapshot restaurado.
    expect(queryClient.getQueryData(KEY)).toEqual({ items: 1 });
    // Toast de error no-409 con mensaje del error.
    expect(toast.error).toHaveBeenCalledWith('boom');
  });

  it('(c) hace rollback + invalidación tras un 409 Conflict', async () => {
    const { queryClient, Wrapper } = crearWrapper();
    queryClient.setQueryData(KEY, 'original');

    const spyInvalidacion = vi.spyOn(queryClient, 'invalidateQueries');
    const onConflict = vi.fn();

    const { result } = renderHook(
      () =>
        useDomainMutation<void, void>({
          invalidateKeys: [KEY],
          onConflict,
          mutationFn: async () => {
            throw Object.assign(new Error('conflicto'), {
              response: { status: 409 },
            });
          },
          optimisticUpdate: {
            queryKey: KEY,
            updater: () => 'optimista',
          },
        }),
      { wrapper: Wrapper },
    );

    await act(async () => {
      result.current.mutate();
    });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(isConflictError(result.current.error)).toBe(true);
    // Rollback ANTES de invalidar/toast/callback.
    expect(queryClient.getQueryData(KEY)).toBe('original');
    expect(spyInvalidacion).toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      'Los datos cambiaron en otro dispositivo. Recargando...',
    );
    expect(onConflict).toHaveBeenCalledTimes(1);
  });

  it('(d) en éxito invalida las keys y muestra toast de éxito', async () => {
    const { queryClient, Wrapper } = crearWrapper();
    queryClient.setQueryData(KEY, 0);

    const spyInvalidacion = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(
      () =>
        useDomainMutation<number, void>({
          invalidateKeys: [KEY],
          successMessage: 'Guardado',
          mutationFn: async () => 42,
          optimisticUpdate: {
            queryKey: KEY,
            updater: (previo) => (previo as number) + 1,
          },
        }),
      { wrapper: Wrapper },
    );

    await act(async () => {
      result.current.mutate();
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(spyInvalidacion).toHaveBeenCalledWith({ queryKey: KEY });
    expect(toast.success).toHaveBeenCalledWith('Guardado');
    expect(queryClient.getQueryData(KEY)).toBe(1);
  });

  it('(e) sin optimisticUpdate el comportamiento es idéntico al actual', async () => {
    const { queryClient, Wrapper } = crearWrapper();
    queryClient.setQueryData(KEY, 'sin-cambios');

    const onError = vi.fn();

    const { result } = renderHook(
      () =>
        useDomainMutation<void, void>({
          invalidateKeys: [],
          errorMessage: 'Fallo custom',
          onError,
          mutationFn: async () => {
            throw new Error('x');
          },
        }),
      { wrapper: Wrapper },
    );

    await act(async () => {
      result.current.mutate();
    });
    await waitFor(() => expect(result.current.isError).toBe(true));

    // El dato no fue tocado ni restaurado (nunca se modificó).
    expect(queryClient.getQueryData(KEY)).toBe('sin-cambios');
    expect(toast.error).toHaveBeenCalledWith('Fallo custom');
    expect(onError).toHaveBeenCalledTimes(1);

    // Y en éxito tampoco interfiere:
    const { result: r2 } = renderHook(
      () =>
        useDomainMutation<string, void>({
          invalidateKeys: [],
          successMessage: null,
          mutationFn: async () => 'hecho',
        }),
      { wrapper: Wrapper },
    );
    await act(async () => {
      r2.current.mutate();
    });
    await waitFor(() => expect(r2.current.isSuccess).toBe(true));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('encadena el onMutate del usuario después del optimistic update y fusiona contextos', async () => {
    const { queryClient, Wrapper } = crearWrapper();
    queryClient.setQueryData(KEY, 'base');

    let ctxCapturado: unknown;
    const { result } = renderHook(
      () =>
        useDomainMutation<void, void, Record<string, unknown>>({
          invalidateKeys: [],
          mutationFn: async () => {
            throw new Error('fallo para ver contexto');
          },
          onMutate: async () => ({ usuario: true }),
          optimisticUpdate: {
            queryKey: KEY,
            updater: () => 'optimista',
          },
        }),
      { wrapper: Wrapper },
    );

    await act(async () => {
      result.current.mutate(undefined, {
        onError: (_e, _v, context) => {
          ctxCapturado = context;
        },
      });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(ctxCapturado).toMatchObject({ usuario: true });
    expect((ctxCapturado as Record<string, unknown>).__optimisticPrev).toBe(
      'base',
    );
    expect(queryClient.getQueryData(KEY)).toBe('base');
  });
});
