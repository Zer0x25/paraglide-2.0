import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import api from '../services/api';
import { LogAuditoriaDTO } from '@parapente/shared';

interface AuditoriaEnvelope {
  data: LogAuditoriaDTO[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number; hasMore: boolean; nextPage?: number | null; nextCursor?: string | null };
}

// Pilar 5.2: listas infinitas — keyset cursor (id desc) vía useInfiniteQuery.
// El servidor responde `nextCursor`; cargar más pide la página siguiente
// sin offset, estable bajo escrituras concurrentes.
export function useAuditoria() {
  const [filtros, setFiltros] = useState<{ entidad?: string; accion?: string; busqueda?: string }>({});

  const query = useInfiniteQuery<AuditoriaEnvelope>({
    queryKey: ['auditoria', filtros],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams();
      if (filtros.entidad && filtros.entidad !== 'TODAS') params.append('entidad', filtros.entidad);
      if (filtros.accion && filtros.accion !== 'TODAS') params.append('accion', filtros.accion);
      if (filtros.busqueda?.trim()) params.append('busqueda', filtros.busqueda.trim());
      params.append('pageSize', '50');
      if (typeof pageParam === 'string') params.append('cursor', pageParam);
      else if (typeof pageParam === 'number') params.append('page', String(pageParam));
      return api.auditoria.listar(Object.fromEntries(params.entries()));
    },
    initialPageParam: undefined,
    getNextPageParam: (last) =>
      last.pagination.hasMore ? (last.pagination.nextCursor ?? last.pagination.nextPage ?? undefined) : undefined,
  });

  const logs = query.data?.pages.flatMap((p) => p.data) ?? [];
  const total = query.data?.pages[0]?.pagination.total ?? 0;
  const totalPages = query.data?.pages[0]?.pagination.totalPages ?? 1;

  const refetch = (entidad?: string, accion?: string, busqueda?: string) => {
    setFiltros({ entidad, accion, busqueda });
  };

  return {
    logs,
    loading: query.isPending,
    error: query.error as Error | null,
    total,
    totalPages,
    refetch,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
  };
}