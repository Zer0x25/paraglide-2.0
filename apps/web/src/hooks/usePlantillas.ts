import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { typedApiOutbox } from '../services/apiOutbox';
import type { PlantillaMensajeDTO, CreatePlantillaMensajePayload } from '@parapente/shared';
import { toast } from 'sonner';

export function usePlantillas() {
  const queryClient = useQueryClient();

  const query = useQuery<PlantillaMensajeDTO[]>({
    queryKey: ['plantillas'],
    queryFn: async () => (await api.plantillas.listar({ pageSize: 500 })).data,
  });

  const plantillas = query.data ?? [];

  const createPlantilla = async (data: CreatePlantillaMensajePayload) => {
    try {
      const res = await typedApiOutbox.plantillas.crear(data);
      toast.success('Plantilla creada exitosamente');
      queryClient.invalidateQueries({ queryKey: ['plantillas'] });
      return res;
    } catch (err: unknown) {
      // ADR 009: sin conexión la creación queda encolada para el replay.
      const error = err as { queued?: boolean; response?: { data?: { message?: string } }; message?: string };
      if (error?.queued) {
        toast.info('Sin conexión: la plantilla se enviará automáticamente al reconectar');
        return undefined as never;
      }
      const msg = error.response?.data?.message || error.message || 'Error al crear plantilla';
      toast.error(msg);
      throw err;
    }
  };

  const updatePlantilla = async (id: number, data: Partial<CreatePlantillaMensajePayload>) => {
    try {
      const res = await typedApiOutbox.plantillas.actualizar(id, data);
      toast.success('Plantilla actualizada');
      queryClient.invalidateQueries({ queryKey: ['plantillas'] });
      return res;
    } catch (err: unknown) {
      // ADR 009: sin conexión la actualización queda encolada para el replay.
      const error = err as { queued?: boolean; response?: { data?: { message?: string } }; message?: string };
      if (error?.queued) {
        toast.info('Sin conexión: los cambios se enviarán automáticamente al reconectar');
        return undefined as never;
      }
      const msg = error.response?.data?.message || error.message || 'Error al actualizar plantilla';
      toast.error(msg);
      throw err;
    }
  };

  const deletePlantilla = async (id: number) => {
    try {
      await typedApiOutbox.plantillas.eliminar(id);
      toast.success('Plantilla eliminada');
      queryClient.invalidateQueries({ queryKey: ['plantillas'] });
    } catch (err: unknown) {
      // ADR 009: sin conexión la eliminación queda encolada para el replay.
      const error = err as { queued?: boolean; response?: { data?: { message?: string } }; message?: string };
      if (error?.queued) {
        toast.info('Sin conexión: la eliminación se enviará automáticamente al reconectar');
        return;
      }
      const msg = error.response?.data?.message || error.message || 'Error al eliminar plantilla';
      toast.error(msg);
      throw err;
    }
  };

  const renderTemplate = async (tipoOrCuerpo: string, variables: Record<string, string>, isCuerpo = false) => {
    try {
      const payload = isCuerpo 
        ? { plantillaDraft: { cuerpo: tipoOrCuerpo, tipo: 'draft', titulo: 'draft', activo: true, canal: 'WHATSAPP' as const }, variables: JSON.stringify(variables) } 
        : { plantillaId: parseInt(tipoOrCuerpo), variables: JSON.stringify(variables) };
      const res = await api.plantillas.renderizar(payload as Record<string, unknown>);
      return res?.cuerpo || (res as Record<string, unknown>)?.texto || '';
    } catch (err) {
      console.error(err);
      return '';
    }
  };

  return {
    plantillas,
    loading: query.isPending,
    error: query.error as Error | null,
    refetch: query.refetch,
    createPlantilla,
    updatePlantilla,
    deletePlantilla,
    renderTemplate,
  };
}