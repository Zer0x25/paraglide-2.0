import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

export function useVuelos() {
  const query = useQuery({
    queryKey: ['vuelos'],
    queryFn: async () => (await api.vuelos.listar({ pageSize: 500 })).data,
  });

  return {
    vuelos: query.data ?? [],
    error: query.error as Error | null,
    loading: query.isPending,
    refetch: query.refetch,
  };
}