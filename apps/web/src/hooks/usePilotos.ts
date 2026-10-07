import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

export function usePilotos() {
  const query = useQuery({
    queryKey: ['pilotos'],
    queryFn: async () => (await api.pilotos.listar({ pageSize: 500 })).data,
  });

  return {
    pilotos: query.data ?? [],
    loading: query.isPending,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}