import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { typedApiOutbox } from '../services/apiOutbox';
import type { EquipoDTO, CreateEquipoPayload, CreateMantenimientoPayload, MantenimientoEquipoDTO } from '@parapente/shared';
import { useDomainMutation } from './useDomainMutation';

const EQUIPOS_KEY = ['equipos'] as const;

export function useEquipos() {
  const query = useQuery<EquipoDTO[]>({
    queryKey: EQUIPOS_KEY,
    queryFn: async () => (await api.equipos.listar({ pageSize: 500 })).data,
  });

  const createMutation = useDomainMutation<EquipoDTO, CreateEquipoPayload>({
    mutationFn: (data) => typedApiOutbox.equipos.crear(data),
    invalidateKeys: [EQUIPOS_KEY],
    outbox: true,
    successMessage: 'Equipo registrado exitosamente',
    errorMessage: 'Error al registrar equipo',
  });

  const updateMutation = useDomainMutation<EquipoDTO, { id: number; data: CreateEquipoPayload }>({
    mutationFn: ({ id, data }) => typedApiOutbox.equipos.actualizar(id, data),
    invalidateKeys: [EQUIPOS_KEY],
    outbox: true,
    // Actualización optimista: refleja el cambio al instante; el rollback
    // ante cualquier error ya lo hace la primitiva (snapshot automático).
    optimisticUpdate: {
      queryKey: EQUIPOS_KEY,
      // version +1: si la mutación se encola offline, la caché no queda con
      // una versión obsoleta que provoque 409 al reenviar (ADR 004/009).
      updater: (previo, { id, data }) =>
        Array.isArray(previo)
          ? (previo as EquipoDTO[]).map((e) =>
              e.id === id ? { ...e, ...data, version: (e.version ?? 0) + 1 } : e,
            )
          : previo,
    },
    successMessage: 'Equipo actualizado exitosamente',
    errorMessage: 'Error al actualizar equipo',
  });

  const deleteMutation = useDomainMutation<void, number>({
    mutationFn: (id) => typedApiOutbox.equipos.eliminar(id),
    invalidateKeys: [EQUIPOS_KEY],
    outbox: true,
    // Actualización optimista: quita el equipo de la lista al instante;
    // el rollback en error lo maneja la primitiva automáticamente.
    optimisticUpdate: {
      queryKey: EQUIPOS_KEY,
      updater: (previo, id) =>
        Array.isArray(previo) ? (previo as EquipoDTO[]).filter((e) => e.id !== id) : previo,
    },
    successMessage: 'Equipo eliminado',
    errorMessage: 'Error al eliminar equipo',
  });

  const addMantenimientoMutation = useDomainMutation<MantenimientoEquipoDTO, { equipoId: number; data: CreateMantenimientoPayload }>({
    mutationFn: ({ equipoId, data }) => typedApiOutbox.equipos.agregarMantenimiento(equipoId, data),
    invalidateKeys: [EQUIPOS_KEY],
    outbox: true,
    successMessage: 'Mantenimiento registrado e historial actualizado',
    errorMessage: 'Error al registrar mantenimiento',
  });

  const deleteMantenimientoMutation = useDomainMutation<void, { equipoId: number; mantenimientoId: number }>({
    mutationFn: ({ equipoId, mantenimientoId }) =>
      typedApiOutbox.equipos.eliminarMantenimiento(equipoId, mantenimientoId),
    invalidateKeys: [EQUIPOS_KEY],
    outbox: true,
    successMessage: 'Registro de mantenimiento eliminado',
    errorMessage: 'Error al eliminar mantenimiento',
  });

  // Backward-compatible API — pages call these functions the same way
  const createEquipo = async (data: CreateEquipoPayload) => {
    return createMutation.mutateAsync(data);
  };

  const updateEquipo = async (id: number, data: CreateEquipoPayload) => {
    return updateMutation.mutateAsync({ id, data });
  };

  const deleteEquipo = async (id: number) => {
    return deleteMutation.mutateAsync(id);
  };

  const addMantenimiento = async (equipoId: number, data: CreateMantenimientoPayload) => {
    return addMantenimientoMutation.mutateAsync({ equipoId, data });
  };

  const deleteMantenimiento = async (equipoId: number, mantenimientoId: number) => {
    return deleteMantenimientoMutation.mutateAsync({ equipoId, mantenimientoId });
  };

  return {
    equipos: query.data ?? [],
    loading: query.isPending,
    error: query.error as Error | null,
    refetch: query.refetch,
    createEquipo,
    updateEquipo,
    deleteEquipo,
    addMantenimiento,
    deleteMantenimiento,
  };
}