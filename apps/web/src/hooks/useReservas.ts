import { useState, useMemo } from 'react';
import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import api from '../services/api';
import { typedApiOutbox } from '../services/apiOutbox';
import { ReservaDTO, CreateReservaPayload, UpdateReservaPayload, CancelarReservaPayload, derivarEstadoPago } from '@parapente/shared';
type CreateReservaPayloadWithTemp = CreateReservaPayload & { _tempId?: number };
import { useDomainMutation, isQueuedError } from './useDomainMutation';

export interface ReservasFiltros {
  tab: 'PROXIMAS' | 'PASADAS' | 'TODAS';
  q?: string;
  estado?: string;
}

interface ReservasEnvelope {
  data: ReservaDTO[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number; hasMore: boolean; nextPage?: number | null; nextCursor?: string | null };
}

const RESERVAS_KEY = ['reservas'] as const;

// Pilar 5.3: filtros server-side (tabs → desde/hasta, búsqueda → q, pago →
// estado) + listas infinitas por offset. El servidor filtra y pagina; el
// cliente solo pide la página siguiente con nextPage.
export function useReservas() {
  const queryClient = useQueryClient();
  const [filtros, setFiltrosState] = useState<ReservasFiltros>({ tab: 'PROXIMAS' });

  const query = useInfiniteQuery<ReservasEnvelope>({
    queryKey: ['reservas', filtros],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams();
      params.append('pageSize', '20');
      if (typeof pageParam === 'number') params.append('page', String(pageParam));
      if (filtros.q?.trim()) params.append('q', filtros.q.trim());
      if (filtros.estado) params.append('estado', filtros.estado);
      if (filtros.tab === 'PROXIMAS') {
        params.append('desde', new Date().toISOString());
        params.append('sort', 'fechaAgenda.asc');
      } else if (filtros.tab === 'PASADAS') {
        params.append('hasta', new Date().toISOString());
        params.append('sort', 'fechaAgenda.desc');
      } else if (filtros.tab === 'TODAS') {
        params.append('sort', 'createdAt.desc');
      }
      return api.reservas.listar(Object.fromEntries(params.entries()));
    },
    initialPageParam: undefined,
    getNextPageParam: (last) =>
      last.pagination.hasMore ? (last.pagination.nextPage ?? last.pagination.page + 1) : undefined,
  });

  const reservas = useMemo(() => {
    const reservasRaw = query.data?.pages.flatMap((p) => p.data) ?? [];
    // Deduplica por id: el servidor pagina por offset con orden `fechaAgenda`
    // nulo-intercalado y el filtro PROXIMAS incluye `OR (fechaAgenda null)`.
    // Bajo escrituras concurrentes (crear/agendar) el mismo id puede aparecer
    // en dos páginas contiguas; React key duplicado rompe el reconciliador.
    const seen = new Set<number>();
    const out: ReservaDTO[] = [];
    for (const r of reservasRaw) {
      const id = r.id as number | undefined;
      if (id == null) {
        out.push(r);
        continue;
      }
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(r);
    }
    return out;
  }, [query.data]);
  const total = query.data?.pages[0]?.pagination.total ?? reservas.length;

  const setFiltros = (f: Partial<ReservasFiltros>) => {
    setFiltrosState((prev) => ({ ...prev, ...f }));
  };

  // Outbox (ADR 009): la creación de reservas es la operación más crítica
  // offline en pista — si no hay red, se encola y se reenvía con
  // idempotencia por X-Client-Id y X-Temp-Id para remapeo de dependencias.
  // Se inserta optimistamente en la caché local.
  const createMutation = useDomainMutation<ReservaDTO, CreateReservaPayload>({
    mutationFn: (payload) => {
      const p = payload as CreateReservaPayloadWithTemp;
      const tempId = p._tempId || -Date.now();
      p._tempId = tempId;
      return typedApiOutbox.reservas.crear(payload, {
        headers: { 'X-Temp-Id': String(tempId) },
      });
    },
    invalidateKeys: [RESERVAS_KEY],
    onMutate: async (payload) => {
      const pw = payload as CreateReservaPayloadWithTemp;
      const provisionalId = pw._tempId || -Date.now();
      pw._tempId = provisionalId;
      const provisional = {
        id: provisionalId,
        nombreTitular: payload.nombreTitular,
        rutDniTitular: payload.rutDniTitular ?? null,
        telefono: payload.telefono ?? null,
        email: payload.email ?? null,
        fechaAgenda: payload.fechaAgenda ? new Date(payload.fechaAgenda).toISOString() : null,
        horaAgenda: payload.horaAgenda ?? null,
        esGiftCard: Boolean(payload.esGiftCard),
        valorTotal: payload.valorTotal ?? 0,
        abono: payload.abono ?? 0,
        montoDevuelto: 0,
        estadoPago: derivarEstadoPago(payload.valorTotal ?? 0, payload.abono ?? 0),
        estado: 'SIN_AGENDAR' as const,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        pasajeros: (payload.pasajeros ?? []).map((raw: unknown, idx: number) => {
          const p = raw as { nombre?: string; nombreCompleto?: string; rutDni?: string | null; peso?: unknown; telefono?: string | null; contactoEmergencia?: string | null; telefonoEmergencia?: string | null; condicionFisica?: string | null };
          return {
          id: -(Math.abs(provisionalId) + idx + 1),
          reservaId: provisionalId,
          nombreCompleto: p.nombreCompleto || p.nombre || 'Pasajero',
          rutDni: p.rutDni ?? null,
          peso: p.peso != null && p.peso !== '' ? Number(p.peso) : null,
          telefono: p.telefono ?? null,
          contactoEmergencia: p.contactoEmergencia ?? null,
          telefonoEmergencia: p.telefonoEmergencia ?? null,
          condicionFisica: p.condicionFisica ?? null,
          firmaDeslinde: false,
          estadoVuelo: 'POR_VOLAR',
        };}),
      } as unknown as ReservaDTO;

      queryClient.setQueriesData<InfiniteData<ReservasEnvelope>>(
        { queryKey: RESERVAS_KEY },
        (old) => {
          if (!old || !old.pages || old.pages.length === 0) return old;
          return {
            ...old,
            pages: old.pages.map((page, index) => {
              if (index === 0) {
                return {
                  ...page,
                  data: [provisional, ...page.data],
                  pagination: {
                    ...page.pagination,
                    total: page.pagination.total + 1,
                  },
                };
              }
              return page;
            }),
          };
        }
      );
    },
    onError: (error, variables) => {
      // Rollback de la inserción optimista ante error real (400/500): sin esto,
      // la fila provisional (id negativo) quedaba visible hasta el próximo
      // refetch. Si la mutación quedó encolada en el outbox (offline), el
      // registro optimista debe permanecer visible hasta el replay (ADR 009).
      if (isQueuedError(error) || (error as { queued?: boolean })?.queued) return;
      const provisionalId = (variables as CreateReservaPayloadWithTemp)._tempId;
      if (provisionalId == null) return;
      queryClient.setQueriesData<InfiniteData<ReservasEnvelope>>(
        { queryKey: RESERVAS_KEY },
        (old) => {
          if (!old?.pages) return old;
          return {
            ...old,
            pages: old.pages.map((page) => {
              const data = page.data.filter((r) => r.id !== provisionalId);
              if (data.length === page.data.length) return page;
              return {
                ...page,
                data,
                pagination: {
                  ...page.pagination,
                  total: Math.max(0, page.pagination.total - 1),
                },
              };
            }),
          };
        }
      );
    },
  });

  // ADR 009: edición/borrado de reserva también por outbox — en pista sin
  // red la acción debe encolarse y reenviarse con idempotencia por X-Client-Id.
  const updateMutation = useDomainMutation<ReservaDTO, { id: number; payload: UpdateReservaPayload }>({
    mutationFn: ({ id, payload }) => typedApiOutbox.reservas.actualizar(id, payload),
    invalidateKeys: [RESERVAS_KEY],
  });

  const deleteMutation = useDomainMutation<void, number>({
    mutationFn: (id) => typedApiOutbox.reservas.eliminar(id),
    invalidateKeys: [RESERVAS_KEY],
  });

  // Fase 2b: cancelación formal del ciclo de vida (POST /reservas/:id/cancelar).
  // La API cancela los vuelos activos de los pasajeros y preserva los pagos.
  // El 409 lo maneja useDomainMutation (toast + invalidación); el 400
  // ("El motivo de cancelación es obligatorio" / "Reserva ya finalizada")
  // muestra el message del servidor vía errorMessage implícito.
  const cancelarMutation = useDomainMutation<
    ReservaDTO,
    { id: number; payload: CancelarReservaPayload }
  >({
    mutationFn: ({ id, payload }) => typedApiOutbox.reservas.cancelar(id, payload),
    invalidateKeys: [RESERVAS_KEY],
  });

  const desagendarMutation = useDomainMutation<
    ReservaDTO,
    { id: number; payload?: { version?: number } }
  >({
    mutationFn: ({ id, payload }) => typedApiOutbox.reservas.desagendar(id, payload),
    invalidateKeys: [RESERVAS_KEY],
  });

  const createReserva = async (payload: CreateReservaPayloadWithTemp) => {
    return createMutation.mutateAsync(payload);
  };

  const updateReserva = async (id: number, payload: UpdateReservaPayload) => {
    return updateMutation.mutateAsync({ id, payload });
  };

  const deleteReserva = async (id: number) => {
    return deleteMutation.mutateAsync(id);
  };

  const cancelarReserva = async (id: number, payload: CancelarReservaPayload) => {
    return cancelarMutation.mutateAsync({ id, payload });
  };

  const desagendarReserva = async (id: number, payload?: { version?: number }) => {
    return desagendarMutation.mutateAsync({ id, payload });
  };

  return {
    reservas,
    total,
    filtros,
    setFiltros,
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    createReserva,
    updateReserva,
    deleteReserva,
    cancelarReserva,
    cancelando: cancelarMutation.isPending,
    desagendarReserva,
    desagendando: desagendarMutation.isPending,
  };
}