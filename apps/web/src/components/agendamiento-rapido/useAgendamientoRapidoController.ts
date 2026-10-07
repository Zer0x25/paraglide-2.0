"use client";

import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '../../services/api';
import { typedApiOutbox } from '../../services/apiOutbox';
import { isConflictError } from '../../hooks/useDomainMutation';
import { PilotoDTO, HorarioBloquePayload, dateKeyLocal, fechaHoraLocalToIso } from '@parapente/shared';
import type { ReservaConPasajeros } from '@/types/reservaDetalle';

function getApiMessage(error: unknown, fallback: string): string {
  if (error !== null && typeof error === 'object' && 'response' in error) {
    const resp = (error as { response?: { data?: { message?: string } } }).response;
    if (typeof resp?.data?.message === 'string' && resp.data.message) return resp.data.message;
  }
  return fallback;
}

export function useAgendamientoRapidoController({
  reserva,
  onSuccess,
  onClose,
}: {
  reserva: ReservaConPasajeros | null;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  const [pilotos, setPilotos] = useState<PilotoDTO[]>([]);
  const [bloquesDelDia, setBloquesDelDia] = useState<Array<{ horaInicio: string; horaFin: string }>>([]);
  const [nombreConfig, setNombreConfig] = useState<string | null>(null);
  const [diaBloqueado, setDiaBloqueado] = useState(false);
  const [loadingBloques, setLoadingBloques] = useState(false);
  const [asignaciones, setAsignaciones] = useState<Record<number, number>>({});
  const [loadingMatch, setLoadingMatch] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchPilotos = async () => {
    try {
      const res = await api.pilotos.listar({ activo: 'true', pageSize: 500 });
      const list = res.data;
      setPilotos(list.filter((p: PilotoDTO) => p.activo));
    } catch (error) {
      console.error('Error cargando pilotos:', error);
    }
  };

  /* eslint-disable react-hooks/set-state-in-effect -- hidrata formulario al abrir modal desde prop reserva */
  useEffect(() => {
    if (reserva) {
      const defaultDate = reserva.fechaAgenda
        ? dateKeyLocal(new Date(reserva.fechaAgenda))
        : dateKeyLocal();
      
      setFecha(defaultDate);
      setHora(reserva.horaAgenda || '');
      setAsignaciones({});
      fetchPilotos();
    }
  }, [reserva]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!fecha) return;
    let cancel = false;

    const cargarBloques = async () => {
      setLoadingBloques(true);
      try {
        const res = await api.configuracion.resolver({ desde: fecha, hasta: fecha });
        if (cancel) return;
        const resolucion = res?.[fecha];
        if (resolucion) {
          setDiaBloqueado(Boolean(resolucion.bloqueado));
          setNombreConfig(resolucion.nombre || null);
          const horarios = resolucion.horarios || [];
          setBloquesDelDia(horarios);

          if (horarios.length > 0) {
            const matchBloque = reserva?.horaAgenda && horarios.some((h: HorarioBloquePayload) => h.horaInicio === reserva.horaAgenda);
            setHora(matchBloque ? (reserva.horaAgenda as string) : horarios[0].horaInicio);
          } else {
            setHora(reserva?.horaAgenda || '10:00');
          }
        } else {
          setDiaBloqueado(false);
          setNombreConfig(null);
          setBloquesDelDia([]);
          setHora(reserva?.horaAgenda || '10:00');
        }
      } catch (err) {
        console.error('Error resolviendo bloques del día:', err);
      } finally {
        if (!cancel) setLoadingBloques(false);
      }
    };

    cargarBloques();
    return () => { cancel = true; };
  }, [fecha, reserva]);

  const ejecutarAutoMatch = async () => {
    if (!reserva || !fecha || !hora) return;

    setLoadingMatch(true);
    const fechaHora = fechaHoraLocalToIso(fecha, hora);
    type PaxPeso = { id: number; peso: number };
    const paxs: PaxPeso[] = (reserva.pasajeros ?? []).map((p) => ({
      id: p.id as number,
      peso: (p.pesoVerificado ?? p.peso ?? 75) as number,
    }));

    try {
      const res = await api.vuelos.asignacionAutomatica({
        fechaHora,
        pasajeros: paxs,
      });
      const matchAsignaciones = (res as { asignaciones?: Record<number, number> }).asignaciones;

      if (matchAsignaciones) {
        setAsignaciones(matchAsignaciones);
        const asignadosCount = Object.keys(matchAsignaciones).length;
        if (asignadosCount === paxs.length) {
          toast.success(`¡Match perfecto! ${asignadosCount}/${paxs.length} pilotos sugeridos`);
        } else {
          toast.warning(`Sugeridos ${asignadosCount} de ${paxs.length} pasajeros. Faltan pilotos disponibles.`);
        }
      }
    } catch (error: unknown) {
      console.error(error);
      toast.error(getApiMessage(error, 'Error al ejecutar la asignación automática'));
    } finally {
      setLoadingMatch(false);
    }
  };

  const handleConfirmarVuelos = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reserva || !fecha || !hora) return;

    const fechaHora = fechaHoraLocalToIso(fecha, hora);
    const totalPax = reserva.pasajeros?.length || 0;
    const asignadosCount = Object.keys(asignaciones).length;

    if (asignadosCount < totalPax) {
      toast.error(`Debes asignar un piloto para cada uno de los ${totalPax} pasajeros antes de confirmar`);
      return;
    }

    setIsSubmitting(true);
    try {
      if (reserva.id == null) {
        toast.error('Reserva sin identificador');
        return;
      }
      await typedApiOutbox.vuelos.agendarGrupo({
        reservaId: reserva.id as number,
        fechaHora,
        asignaciones,
        version: reserva.version ?? 0,
      });

      queryClient.invalidateQueries({ queryKey: ['reservas'] });
      queryClient.invalidateQueries({ queryKey: ['vuelos'] });
      queryClient.invalidateQueries({ queryKey: ['pilotos'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });

      toast.success('¡Vuelos agendados y confirmados con éxito! 🪂');
      onSuccess();
      onClose();
    } catch (error: unknown) {
      console.error(error);
      if (error !== null && typeof error === 'object' && 'queued' in error && Boolean((error as { queued?: boolean }).queued)) {
        toast.info('Sin conexión: los vuelos se enviarán automáticamente al reconectar');
        onSuccess();
        onClose();
        return;
      }
      if (isConflictError(error)) {
        toast.error(getApiMessage(error, 'La reserva cambió en otro dispositivo. Recarga e intenta de nuevo.'));
        onSuccess();
        onClose();
        return;
      }
      toast.error(getApiMessage(error, 'Error al agendar los vuelos'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    fecha,
    setFecha,
    hora,
    setHora,
    pilotos,
    bloquesDelDia,
    nombreConfig,
    diaBloqueado,
    loadingBloques,
    asignaciones,
    setAsignaciones,
    loadingMatch,
    isSubmitting,
    ejecutarAutoMatch,
    handleConfirmarVuelos,
  };
}
