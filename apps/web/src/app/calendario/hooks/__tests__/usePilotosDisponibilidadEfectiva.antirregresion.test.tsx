import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { usePilotosDisponibilidadEfectiva } from '../usePilotosDisponibilidadEfectiva';
import type { PilotoDia } from '../../agendas.util';
import api from '@/services/api';

vi.mock('@/services/api', () => ({
  default: {
    pilotos: {
      obtenerDisponibilidad: vi.fn(),
    },
  },
}));

function crearWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 60_000, gcTime: Infinity },
    },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, Wrapper };
}

describe('usePilotosDisponibilidadEfectiva — Anti-regresión M-01', () => {
  const pilotosBase: PilotoDia[] = [
    {
      id: 2,
      nombre: 'Beto',
      activo: true,
      prioridad: 2,
      disponibilidadTotal: true,
      excepciones: [],
    },
    {
      id: 1,
      nombre: 'Ana',
      activo: true,
      prioridad: 1,
      disponibilidadTotal: false,
      excepciones: [],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('no re-dispara peticiones HTTP cuando el usuario cambia de fecha (dateKey)', async () => {
    vi.mocked(api.pilotos.obtenerDisponibilidad).mockImplementation(async (id: number) => ({
      excepciones: [{ fecha: '2026-08-20' }],
      disponibilidadBloques: [{ fecha: '2026-08-20', horaInicio: '10:00', horaFin: '12:00' }],
      disponibilidadTotal: true,
    }));

    const { queryClient, Wrapper } = crearWrapper();
    const spyFetch = vi.spyOn(api.pilotos, 'obtenerDisponibilidad');

    const { result, rerender } = renderHook(
      ({ dateKey }) => usePilotosDisponibilidadEfectiva(pilotosBase, dateKey),
      {
        wrapper: Wrapper,
        initialProps: { dateKey: '2026-08-20' },
      },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Se llamó 2 veces (1 por cada piloto)
    expect(spyFetch).toHaveBeenCalledTimes(2);

    // Cambiar de fecha (ej. el usuario navega con flecha derecha al día siguiente)
    rerender({ dateKey: '2026-08-21' });

    // La queryKey no contiene dateKey, por lo que usa la caché en memoria y NO dispara nuevas llamadas
    expect(spyFetch).toHaveBeenCalledTimes(2);
    expect(
      queryClient
        .getQueryCache()
        .getAll()
        .map((q) => q.queryKey),
    ).toEqual([['pilotos', 'disponibilidad', '1,2']]);
  });

  it('el resultado de la query es un Record plano serializable (sin Map que quede {} al persistir)', async () => {
    vi.mocked(api.pilotos.obtenerDisponibilidad).mockImplementation(async (id: number) => ({
      excepciones: [{ fecha: '2026-08-20' }],
      disponibilidadBloques: [{ fecha: '2026-08-20', horaInicio: '10:00', horaFin: '12:00' }],
      disponibilidadTotal: id === 1,
    }));

    const { queryClient, Wrapper } = crearWrapper();

    const { result } = renderHook(
      () => usePilotosDisponibilidadEfectiva(pilotosBase, '2026-08-20'),
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const cached = queryClient.getQueryData(['pilotos', 'disponibilidad', '1,2']);
    // No debe ser instancia de Map
    expect(cached instanceof Map).toBe(false);
    expect(typeof cached).toBe('object');

    // JSON.stringify sobre el record produce datos no vacíos (crucial para PersistQueryClientProvider offline)
    const json = JSON.stringify(cached);
    expect(json).not.toBe('{}');
    expect(json).toContain('"1"');
    expect(json).toContain('"2"');

    // Verifica que disponibilidadBloques se preserve en pilotosEfectivos
    const p1 = result.current.pilotosEfectivos.find((p) => p.id === 1);
    expect(p1?.disponibilidadBloques).toEqual([
      { fecha: '2026-08-20', horaInicio: '10:00', horaFin: '12:00' },
    ]);
  });

  it('soporta rehidratación de caché tanto desde Record plano como desde Map (retrocompatibilidad)', async () => {
    const { queryClient, Wrapper } = crearWrapper();

    // Simular que el persister inyectó en caché un Record rehidratado de IndexedDB
    queryClient.setQueryData(['pilotos', 'disponibilidad', '1,2'], {
      1: {
        excepciones: [{ fecha: '2026-08-25' }],
        disponibilidadBloques: [{ fecha: '2026-08-25', horaInicio: '14:00', horaFin: '16:00' }],
        disponibilidadTotal: false,
      },
      2: {
        excepciones: [],
        disponibilidadBloques: [],
        disponibilidadTotal: true,
      },
    });

    const { result } = renderHook(
      () => usePilotosDisponibilidadEfectiva(pilotosBase, '2026-08-25'),
      { wrapper: Wrapper },
    );

    const p1 = result.current.pilotosEfectivos.find((p) => p.id === 1);
    expect(p1?.excepciones).toEqual([{ fecha: '2026-08-25' }]);
    expect(p1?.disponibilidadBloques).toEqual([
      { fecha: '2026-08-25', horaInicio: '14:00', horaFin: '16:00' },
    ]);
    expect(p1?.disponibilidadTotal).toBe(false);
  });
});
