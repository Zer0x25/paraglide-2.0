import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

export function usePasajeros() {
  const query = useQuery({
    queryKey: ['pasajeros'],
    queryFn: async () => (await api.pasajeros.listar({ pageSize: 500 })).data,
  });

  return {
    pasajeros: query.data ?? [],
    loading: query.isPending,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}