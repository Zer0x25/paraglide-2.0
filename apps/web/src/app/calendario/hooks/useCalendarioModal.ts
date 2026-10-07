import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { fechaHoraLocalToIso, dateKeyLocal, horaLocalHHMM } from '@parapente/shared';
import api from '../../../services/api';
import { typedApiOutbox } from '../../../services/apiOutbox';
import { isConflictError } from '../../../hooks/useDomainMutation';
import type { Vuelo, Piloto, Pasajero, FormDataVuelo } from './types';
import type { VueloVista } from '../agendas.util';
import type { ReservaConPasajeros } from '../../../types/reservaDetalle';

export function useCalendarioModal({
  vuelos,
  pilotos,
  pasajeros,
  reservas,
  refetchVuelos,
  refetchReservas,
  refetchPasajeros,
  getDateKey,
  desdeISO,
  hastaISO,
}: {
  vuelos: Vuelo[];
  pilotos: Piloto[];
  pasajeros: Pasajero[];
  reservas: ReservaConPasajeros[];
  refetchVuelos: () => void;
  refetchReservas: () => void;
  refetchPasajeros: () => void;
  getDateKey: (d: Date) => string;
  desdeISO?: string;
  hastaISO?: string;
}) {
  const queryClient = useQueryClient();

  const invalidateCalendarData = () => {
    if (desdeISO && hastaISO) {
      queryClient.invalidateQueries({
        queryKey: ['vuelos', 'calendario', desdeISO, hastaISO],
        exact: true,
      });
    } else {
      queryClient.invalidateQueries({ queryKey: ['vuelos', 'calendario'] });
    }
    queryClient.invalidateQueries({ queryKey: ['reservas'] });
    queryClient.invalidateQueries({ queryKey: ['pilotos'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingVersion, setEditingVersion] = useState(0);
  const [editingEstado, setEditingEstado] = useState<string>('AGENDADO');
  const [filterReservaId, setFilterReservaId] = useState<number | null>(null);
  const [groupPilotSelections, setGroupPilotSelections] = useState<Record<number, string>>({});

  const [formData, setFormData] = useState<FormDataVuelo>({
    pilotoId: '',
    pasajeroId: '',
    fecha: '',
    hora: '',
    valorPactado: '',
  });

  const handleAsignacionAutomatica = async () => {
    if (!filterReservaId || !formData.fecha || !formData.hora) {
      toast.error('Por favor, selecciona una fecha y bloque de vuelo antes de usar la asignación automática.');
      return;
    }

    try {
      const fechaHoraIso = fechaHoraLocalToIso(formData.fecha, formData.hora);
      const groupPassengers = pasajeros
        .filter((p) => p.reservaId === filterReservaId)
        .map((p) => ({ id: p.id, peso: p.peso || 75 }));

      const response = (await api.vuelos.asignacionAutomatica({
        fechaHora: fechaHoraIso,
        pasajeros: groupPassengers,
      })) as unknown as { asignaciones: Record<string, number> };

      const asignaciones = response.asignaciones;
      const newSelections = { ...groupPilotSelections };
      let assignedCount = 0;
      Object.keys(asignaciones).forEach((pasajeroId) => {
        newSelections[Number(pasajeroId)] = String(asignaciones[pasajeroId]);
        assignedCount++;
      });

      setGroupPilotSelections(newSelections);

      if (assignedCount === 0) {
        toast.error('No se encontraron pilotos disponibles con los criterios requeridos.');
      } else {
        toast.success(`Se asignaron ${assignedCount} pilotos.`);
      }
    } catch (error) {
      console.error('Error en asignación automática:', error);
      toast.error('Error al intentar asignar pilotos automáticamente.');
    }
  };

  const isPilotoDisabled = (pilotoId: number, currentPasajeroId?: number) => {
    const pilotoObj = pilotos.find((p) => p.id === pilotoId);

    if (formData.fecha && pilotoObj) {
      const hasException = (pilotoObj.excepciones || []).some((ex) => ex.fecha.startsWith(formData.fecha));
      const isAvailableDay = pilotoObj.disponibilidadTotal ? !hasException : hasException;
      if (!isAvailableDay) return true;
    }

    if (currentPasajeroId) {
      const isAssignedToOtherInGroup = Object.entries(groupPilotSelections).some(([pId, selectedPilotoId]) => {
        return Number(pId) !== currentPasajeroId && selectedPilotoId === String(pilotoId);
      });
      if (isAssignedToOtherInGroup) return true;
    }
    if (formData.fecha && formData.hora) {
      const fechaHoraFormIso = fechaHoraLocalToIso(formData.fecha, formData.hora);
      const msForm = new Date(fechaHoraFormIso).getTime();
      const isBusyInVuelos = vuelos.some((v) => {
        if (editingId && v.id === editingId) return false;
        if (v.estado === 'CANCELADO') return false;
        return v.pilotoId === pilotoId && new Date(v.fechaHora).getTime() === msForm;
      });
      if (isBusyInVuelos) return true;
    }
    return false;
  };

  const handleEditarVuelo = (vuelo: Vuelo | VueloVista | null | undefined) => {
    if (!vuelo) return;
    setEditingId(vuelo.id);
    setEditingVersion(vuelo.version ?? 0);
    setEditingEstado(vuelo.estado || 'AGENDADO');
    const fecha = dateKeyLocal(vuelo.fechaHora);
    const hora = horaLocalHHMM(vuelo.fechaHora);
    setFormData({
      pilotoId: vuelo.pilotoId?.toString() || '',
      pasajeroId: vuelo.pasajeroId?.toString() || '',
      fecha,
      hora,
      valorPactado: vuelo.valorPactado !== undefined && vuelo.valorPactado !== null ? vuelo.valorPactado.toString() : '0',
    });
    setIsModalOpen(true);
  };

  const handleAgendarDesdeAgenda = (fechaAgenda: Date, horario: { horaInicio: string; horaFin: string }) => {
    setEditingId(null);
    setFilterReservaId(null);
    setGroupPilotSelections({});
    setFormData({
      pilotoId: '',
      pasajeroId: '',
      fecha: getDateKey(fechaAgenda),
      hora: horario.horaInicio,
      valorPactado: '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fecha || !formData.hora) {
      toast.error('Por favor selecciona una fecha y una hora.');
      return;
    }

    if (editingId || !filterReservaId) {
      if (!formData.pilotoId || Number.isNaN(parseInt(formData.pilotoId, 10))) {
        toast.error('Por favor selecciona un piloto.');
        return;
      }
      if (!formData.pasajeroId || Number.isNaN(parseInt(formData.pasajeroId, 10))) {
        toast.error('Por favor selecciona un pasajero.');
        return;
      }
    }

    try {
      const fechaHoraIso = fechaHoraLocalToIso(formData.fecha, formData.hora);

      if (editingId) {
        const res = await typedApiOutbox.vuelos.actualizar(editingId, {
          pilotoId: parseInt(formData.pilotoId),
          pasajeroId: parseInt(formData.pasajeroId),
          fechaHora: fechaHoraIso,
          valorPactado: parseFloat(formData.valorPactado || '0'),
          version: editingVersion,
        });
        toast.success('¡Vuelo actualizado con éxito!');

        const resData = (res as { data?: unknown })?.data ?? res;
        const updatedVuelo =
          resData && typeof resData === 'object' && 'id' in resData
            ? (resData as Vuelo)
            : null;

        if (updatedVuelo && updatedVuelo.id) {
          queryClient.setQueriesData<Vuelo[] | { data: Vuelo[] }>(
            { queryKey: ['vuelos'] },
            (old) => {
              if (!old) return old;
              if (Array.isArray(old)) {
                return old.map((v) => (v.id === editingId ? { ...v, ...updatedVuelo } : v));
              }
              if ('data' in old && Array.isArray(old.data)) {
                return {
                  ...old,
                  data: old.data.map((v) => (v.id === editingId ? { ...v, ...updatedVuelo } : v)),
                };
              }
              return old;
            }
          );
        }
      } else if (filterReservaId) {
        const groupPassengers = pasajeros.filter((p) => p.reservaId === filterReservaId);
        const reservaOrigen = reservas.find((r) => r.id === filterReservaId);
        const valorUnitario = (() => {
          const total = Number(reservaOrigen?.valorTotal ?? 0);
          const count = reservaOrigen?.pasajeros?.length || groupPassengers.length || 1;
          return count > 0 && total > 0 ? Math.round(total / count) : 0;
        })();
        const promises = groupPassengers
          .filter((p) => groupPilotSelections[p.id])
          .map((p) => {
            const pFlight = vuelos.find((v) => v.pasajeroId === p.id);
            const valor = valorUnitario || parseFloat(formData.valorPactado || '0');
            if (pFlight) {
              return typedApiOutbox.vuelos.actualizar(pFlight.id, {
                pilotoId: parseInt(groupPilotSelections[p.id]),
                pasajeroId: p.id,
                fechaHora: fechaHoraIso,
                valorPactado: valor,
              });
            } else {
              return typedApiOutbox.vuelos.crear({
                pilotoId: parseInt(groupPilotSelections[p.id]),
                pasajeroId: p.id,
                fechaHora: fechaHoraIso,
                valorPactado: valor,
              });
            }
          });
        if (promises.length === 0) {
          toast.error('Por favor asigna al menos un piloto a uno de los pasajeros.');
          return;
        }
        await Promise.all(promises);
        toast.success('¡Vuelos del grupo guardados/actualizados con éxito!');
      } else {
        const pasajeroSel = pasajeros.find((p) => p.id === Number(formData.pasajeroId));
        const reservaSingle = pasajeroSel?.reservaId ? reservas.find((r) => r.id === pasajeroSel.reservaId) ?? null : null;
        const valorSingle = (() => {
          const total = Number(reservaSingle?.valorTotal ?? 0);
          const count = reservaSingle?.pasajeros?.length || 1;
          return total > 0 ? Math.round(total / count) : parseFloat(formData.valorPactado || '0');
        })();
        await typedApiOutbox.vuelos.crear({
          pilotoId: parseInt(formData.pilotoId),
          pasajeroId: parseInt(formData.pasajeroId),
          fechaHora: fechaHoraIso,
          valorPactado: valorSingle,
        });
        toast.success('¡Vuelo agendado con éxito!');
      }
      setIsModalOpen(false);
      refetchVuelos();
      invalidateCalendarData();
    } catch (error: unknown) {
      console.error('Error agendando/editando vuelo:', error);
      if ((error as { queued?: boolean })?.queued) {
        toast.info('Sin conexión: el vuelo se enviará automáticamente al reconectar');
        setIsModalOpen(false);
        return;
      }
      if (isConflictError(error)) {
        toast.error('El vuelo cambió en otro dispositivo. Recargando...');
        refetchVuelos();
      } else {
        const data = (error as { response?: { data?: { message?: string; error?: string } } })?.response?.data;
        const msg = data?.message || data?.error || (error instanceof Error ? error.message : null);
        if (msg) {
          toast.error(`Error: ${msg}`);
        } else {
          toast.error('Ocurrió un error inesperado al guardar el vuelo.');
        }
      }
    }
  };

  const cancelarVuelo = (id: number) => {
    toast('¿Estás seguro de que deseas eliminar esta agenda?', {
      description: 'La reserva volverá a estar pendiente de agendar.',
      action: {
        label: 'Sí, eliminar agenda',
        onClick: async () => {
          try {
            await typedApiOutbox.vuelos.eliminar(id);
            toast.success('Agenda eliminada correctamente. La reserva vuelve a estar sin agendar.');
            setIsModalOpen(false);
            refetchVuelos();
            refetchReservas();
            refetchPasajeros();
          } catch (error: unknown) {
            console.error('Error al eliminar agenda:', error);
            if ((error as { queued?: boolean })?.queued) {
              toast.info('Sin conexión: la eliminación se enviará automáticamente al reconectar');
              setIsModalOpen(false);
              return;
            }
            toast.error('Error al intentar eliminar la agenda.');
          }
        },
      },
      cancel: { label: 'No, mantener', onClick: () => {} },
    });
  };

  const handleCompletarVueloReserva = async (
    reservaId: number,
    vueloId: number,
    versionReserva?: number
  ) => {
    try {
      const reservaObj = reservas.find((r) => r.id === reservaId);
      const paxList = reservaObj?.pasajeros || pasajeros.filter((p) => p.reservaId === reservaId);
      const paxValidList = paxList.filter((p): p is typeof p & { id: number } => typeof p.id === 'number' && p.id > 0);

      if (reservaId && paxValidList.length > 0) {
        await typedApiOutbox.reservas.actualizarEstadoPasajeros(reservaId, {
          version: versionReserva ?? reservaObj?.version ?? 0,
          pasajeros: paxValidList.map((p) => {
            const estadoActual = 'estado' in p ? (p as { estado?: string }).estado : undefined;
            return {
              id: p.id,
              estado: (estadoActual === 'CANCELADO' ? 'CANCELADO' : 'VUELO_COMPLETADO') as 'CANCELADO' | 'VUELO_COMPLETADO',
            };
          }),
        });
      } else if (vueloId) {
        const vueloObj = vuelos.find((v) => v.id === vueloId);
        await typedApiOutbox.vuelos.actualizarEstado(vueloId, {
          estado: 'COMPLETADO',
          version: vueloObj?.version ?? editingVersion ?? 0,
        });
      }

      toast.success('¡Reserva y vuelo marcados como completados!');
      setIsModalOpen(false);
      refetchVuelos();
      refetchReservas();
      refetchPasajeros();
      invalidateCalendarData();
    } catch (error: unknown) {
      console.error('Error al completar reserva/vuelo:', error);
      if ((error as { queued?: boolean })?.queued) {
        toast.info('Sin conexión: la acción se enviará automáticamente al reconectar');
        setIsModalOpen(false);
        return;
      }
      if (isConflictError(error)) {
        toast.error('La reserva o el vuelo cambiaron en otro dispositivo. Recargando...');
        refetchVuelos();
        refetchReservas();
      } else {
        toast.error('Error al intentar marcar como completada.');
      }
    }
  };

  return {
    isModalOpen,
    setIsModalOpen,
    editingId,
    setEditingId,
    editingVersion,
    setEditingVersion,
    editingEstado,
    setEditingEstado,
    filterReservaId,
    setFilterReservaId,
    groupPilotSelections,
    setGroupPilotSelections,
    formData,
    setFormData,
    handleAsignacionAutomatica,
    isPilotoDisabled,
    handleEditarVuelo,
    handleAgendarDesdeAgenda,
    handleSubmit,
    cancelarVuelo,
    handleCompletarVueloReserva,
  };
}
