/**
 * Tests de regresión para las actualizaciones optimistas de `useEquipos`
 * (ADR 004/009) sobre la queryKey ['equipos'] (caché: EquipoDTO[] plano).
 *
 * Contrato esperado (cambio en curso, firmas garantizadas):
 * - updateMutation: optimisticUpdate → map por id con {...e, ...data, version+1}; rollback al fallar.
 * - deleteMutation: optimisticUpdate → filter por id; rollback al fallar.
 * - Las 5 mutaciones salen por `typedApiOutbox` (clon de typedApi con header X-Outbox).
 *
 * `services/api` crea axios + interceptores al importar → SIEMPRE automock con
 * factory. `services/apiOutbox` también se mockea completo. `api.equipos.listar`
 * devuelve una promesa que nunca resuelve: así el refetch de fondo (staleTime 0)
 * no puede pisar la caché precargada durante el test.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import { ReactNode } from 'react';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../services/api', () => ({
  default: {
    equipos: {
      // Nunca resuelve: el refetch de fondo no pisa la caché precargada.
      listar: vi.fn(() => new Promise(() => {})),
      obtener: vi.fn(),
      crear: vi.fn(),
      actualizar: vi.fn(),
      eliminar: vi.fn(),
      agregarMantenimiento: vi.fn(),
      eliminarMantenimiento: vi.fn(),
    },
  },
  apiRaw: {},
}));

vi.mock('../../services/apiOutbox', () => ({
  typedApiOutbox: {
    equipos: {
      listar: vi.fn(),
      obtener: vi.fn(),
      crear: vi.fn(),
      actualizar: vi.fn(),
      eliminar: vi.fn(),
      agregarMantenimiento: vi.fn(),
      eliminarMantenimiento: vi.fn(),
    },
  },
}));

import { useEquipos } from '../useEquipos';
import { typedApiOutbox } from '../../services/apiOutbox';

const outboxEquipos = typedApiOutbox.equipos as unknown as Record<string, Mock>;

const KEY = ['equipos'] as const;

const equipo1 = {
  id: 1,
  codigo: 'VELA-01',
  nombre: 'Vela Alpha',
  tipo: 'VELA',
  estado: 'OPERATIVO',
  horasVueloEstimadas: 10,
  vuelosRealizados: 5,
  limiteHorasInspeccion: 100,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
const equipo2 = {
  id: 2,
  codigo: 'ARNES-01',
  nombre: 'Arnes Beta',
  tipo: 'ARNES',
  estado: 'OPERATIVO',
  horasVueloEstimadas: 0,
  vuelosRealizados: 0,
  limiteHorasInspeccion: 100,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

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

/** Promesa controlada con catch preventivo (evita unhandled rejection si el código actual no la consume). */
function crearPromesaControlada() {
  let resolver!: (v: unknown) => void;
  let rechazar!: (e: unknown) => void;
  const promesa = new Promise((res, rej) => {
    resolver = res;
    rechazar = rej;
  });
  promesa.catch(() => {});
  return { promesa, resolver, rechazar };
}

/** Tick dentro de act: garantiza que onMutate (async) ya aplicó el updater optimista. */
const tickAct = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useEquipos — actualizaciones optimistas sobre ["equipos"] (ADR 004/009)', () => {
  it('(a) updateEquipo aplica el cambio en caché inmediatamente y lo restaura (rollback) al fallar', async () => {
    const { queryClient, Wrapper } = crearWrapper();
    queryClient.setQueryData(KEY, [equipo1, equipo2]);

    const puerta = crearPromesaControlada();
    outboxEquipos.actualizar.mockReturnValue(puerta.promesa);

    const { result } = renderHook(() => useEquipos(), { wrapper: Wrapper });
    expect(result.current.equipos).toHaveLength(2);

    act(() => {
      void result.current.updateEquipo(1, { nombre: 'Vela Gamma' } as never).catch(() => {});
    });
    await tickAct();

    // Antes de resolver/rechazar la promesa del mutationFn, el cambio YA está en caché.
    // El updater también incrementa version (sin version previa → 1) para evitar
    // 409 si la mutación se encola offline y se reenvía después (ADR 009).
    expect(queryClient.getQueryData(KEY)).toEqual([
      { ...equipo1, nombre: 'Vela Gamma', version: 1 },
      equipo2,
    ]);

    // La petición falla → rollback al array previo.
    await act(async () => {
      puerta.rechazar(Object.assign(new Error('boom'), { response: { status: 500 } }));
    });
    await waitFor(() =>
      expect(queryClient.getQueryData(KEY)).toEqual([equipo1, equipo2]),
    );
  });

  it('(b) deleteEquipo elimina el equipo de la caché inmediatamente y lo restaura (rollback) al fallar', async () => {
    const { queryClient, Wrapper } = crearWrapper();
    queryClient.setQueryData(KEY, [equipo1, equipo2]);

    const puerta = crearPromesaControlada();
    outboxEquipos.eliminar.mockReturnValue(puerta.promesa);

    const { result } = renderHook(() => useEquipos(), { wrapper: Wrapper });

    act(() => {
      void result.current.deleteEquipo(2).catch(() => {});
    });
    await tickAct();

    // Eliminación optimista inmediata (filter por id).
    expect(queryClient.getQueryData(KEY)).toEqual([equipo1]);

    // La petición falla → rollback: el equipo vuelve a la caché.
    await act(async () => {
      puerta.rechazar(Object.assign(new Error('boom'), { response: { status: 500 } }));
    });
    await waitFor(() =>
      expect(queryClient.getQueryData(KEY)).toEqual([equipo1, equipo2]),
    );
  });

  it('(c) en éxito mantiene el valor optimista e invalida la query ["equipos"]', async () => {
    const { queryClient, Wrapper } = crearWrapper();
    queryClient.setQueryData(KEY, [equipo1, equipo2]);

    outboxEquipos.actualizar.mockResolvedValue({ data: { ...equipo1, nombre: 'Vela Gamma' } });
    const espiaInvalidacion = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useEquipos(), { wrapper: Wrapper });

    act(() => {
      void result.current.updateEquipo(1, { nombre: 'Vela Gamma' } as never).catch(() => {});
    });

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Equipo actualizado exitosamente'),
    );

    // Mantiene el valor optimista (el refetch posterior nunca resuelve por diseño del mock).
    expect(queryClient.getQueryData(KEY)).toEqual([
      { ...equipo1, nombre: 'Vela Gamma', version: 1 },
      equipo2,
    ]);
    expect(espiaInvalidacion).toHaveBeenCalledWith({ queryKey: KEY });
  });

  it('(d) createEquipo y deleteEquipo siguen resolviendo a través de typedApiOutbox (smoke)', async () => {
    const { queryClient, Wrapper } = crearWrapper();
    queryClient.setQueryData(KEY, [equipo1, equipo2]);

    outboxEquipos.crear.mockResolvedValue({ data: { ...equipo1, id: 3 } });
    outboxEquipos.eliminar.mockResolvedValue({ data: { ok: true } });

    const { result } = renderHook(() => useEquipos(), { wrapper: Wrapper });

    await act(async () => {
      await expect(
        result.current.createEquipo({ codigo: 'VELA-03', nombre: 'Vela Nueva' } as never),
      ).resolves.toBeDefined();
    });
    await act(async () => {
      await expect(result.current.deleteEquipo(2)).resolves.toBeDefined();
    });

    // Las mutaciones deben salir por el cliente con soporte outbox (header X-Outbox).
    expect(outboxEquipos.crear).toHaveBeenCalledTimes(1);
    expect(outboxEquipos.eliminar).toHaveBeenCalledWith(2);
  });

  it('(e) updateEquipo incrementa version existente (evita 409 al reenviar outbox offline)', async () => {
    const { queryClient, Wrapper } = crearWrapper();
    const equipoConVersion = { ...equipo1, version: 4 };
    queryClient.setQueryData(KEY, [equipoConVersion, equipo2]);

    const puerta = crearPromesaControlada();
    outboxEquipos.actualizar.mockReturnValue(puerta.promesa);

    const { result } = renderHook(() => useEquipos(), { wrapper: Wrapper });

    act(() => {
      void result.current.updateEquipo(1, { nombre: 'Vela Delta' } as never).catch(() => {});
    });
    await tickAct();

    // version 4 → 5 en el valor optimista: si la mutación se encola sin red,
    // la caché no queda con una versión obsoleta que provoque 409 al reenviar.
    expect(queryClient.getQueryData(KEY)).toEqual([
      { ...equipoConVersion, nombre: 'Vela Delta', version: 5 },
      equipo2,
    ]);
  });
});
