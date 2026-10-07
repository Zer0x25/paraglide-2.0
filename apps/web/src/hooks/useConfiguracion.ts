import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { useDomainMutation } from './useDomainMutation';

interface ConfiguracionBloque {
  id?: number;
  nombre: string;
  bloqueado: boolean;
  archivada: boolean;
  horarios: { horaInicio: string; horaFin: string }[];
  [key: string]: unknown;
}

const CONFIG_KEY = ['configuracion-bloques'] as const;

export function useConfiguracion() {
  const query = useQuery<ConfiguracionBloque[]>({
    queryKey: CONFIG_KEY,
    queryFn: () => api.configuracion.listar(),
  });

  const configuracion = query.data ?? [];

  const createMutation = useDomainMutation<Record<string, unknown>, ConfiguracionBloque>({
    mutationFn: (payload) => api.configuracion.crear(payload),
    invalidateKeys: [CONFIG_KEY],
  });

  const updateMutation = useDomainMutation<Record<string, unknown>, { id: number; payload: Partial<ConfiguracionBloque> }>({
    mutationFn: ({ id, payload }) => api.configuracion.actualizar(id, payload),
    invalidateKeys: [CONFIG_KEY],
  });

  const deleteMutation = useDomainMutation<void, number>({
    mutationFn: (id) => api.configuracion.eliminar(id),
    invalidateKeys: [CONFIG_KEY],
  });

  const createConfiguracion = async (payload: ConfiguracionBloque) => {
    return createMutation.mutateAsync(payload);
  };

  const updateConfiguracion = async (id: number, payload: Partial<ConfiguracionBloque>) => {
    return updateMutation.mutateAsync({ id, payload });
  };

  const deleteConfiguracion = async (id: number) => {
    return deleteMutation.mutateAsync(id);
  };

  return {
    configuracion,
    loading: query.isPending,
    error: query.error as Error | null,
    refetch: query.refetch,
    createConfiguracion,
    updateConfiguracion,
    deleteConfiguracion,
  };
}