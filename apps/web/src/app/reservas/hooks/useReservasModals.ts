import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import type { CancelarReservaPayload } from '@parapente/shared';
import type { ReservaConPasajeros, PasajeroConVuelos } from '@/types/reservaDetalle';
import type { DatosDevolucionCancelacion } from '../components/ReservaCancelarModal';
import { isConflictError, isQueuedError } from '../../../hooks/useDomainMutation';

export type ApiErrorWithResponse = Error & {
  response?: { data?: { error?: string; message?: string } };
  queued?: boolean;
};

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (!error) return fallback;
  const typed = error as ApiErrorWithResponse;
  if (typed.response?.data?.message) return typed.response.data.message;
  if (typed.response?.data?.error) return typed.response.data.error;
  if (error instanceof Error) return error.message;
  return fallback;
}

interface UseReservasModalsParams {
  reservas: unknown;
  fetchReservas: () => void;
  deleteReserva: (id: number) => Promise<unknown>;
  cancelarReserva: (id: number, payload: CancelarReservaPayload) => Promise<unknown>;
  cancelando: boolean;
  desagendarReserva: (id: number, payload: { version: number }) => Promise<unknown>;
  desagendando: boolean;
}

export function useReservasModals({
  reservas,
  fetchReservas,
  deleteReserva,
  cancelarReserva,
  cancelando,
  desagendarReserva,
  desagendando,
}: UseReservasModalsParams) {
  // Modal de formulario (crear/editar)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingVersion, setEditingVersion] = useState(0);

  // Modal de firma deslinde interno
  const [pasajeroFirma, setPasajeroFirma] = useState<PasajeroConVuelos | null>(null);
  const [isFirmaModalOpen, setIsFirmaModalOpen] = useState(false);

  // Modal de Pagos y Abonos
  const [selectedReservaPagos, setSelectedReservaPagos] = useState<ReservaConPasajeros | null>(null);
  const [isPagosModalOpen, setIsPagosModalOpen] = useState(false);

  // Modal de Agendamiento Rápido
  const [selectedReservaAgendar, setSelectedReservaAgendar] = useState<ReservaConPasajeros | null>(null);
  const [isAgendarModalOpen, setIsAgendarModalOpen] = useState(false);

  // Modal de Voucher / Boarding Pass
  const [selectedReservaVoucher, setSelectedReservaVoucher] = useState<ReservaConPasajeros | null>(null);
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);

  // Modal de Cancelación de Reserva
  const [reservaACancelar, setReservaACancelar] = useState<ReservaConPasajeros | null>(null);
  const [motivoCancelacion, setMotivoCancelacion] = useState('');
  const [errorMotivoCancelacion, setErrorMotivoCancelacion] = useState(false);

  // Modal de Eliminación
  const [reservaAEliminar, setReservaAEliminar] = useState<ReservaConPasajeros | null>(null);
  const [eliminando, setEliminando] = useState(false);

  // Modal de Desagendar
  const [reservaADesagendar, setReservaADesagendar] = useState<ReservaConPasajeros | null>(null);

  // Sincronizar modales seleccionados cuando cambian las reservas en el servidor
  /* eslint-disable react-hooks/set-state-in-effect -- sincroniza selección con lista actualizada; evita stale data en modal */
  useEffect(() => {
    const list = (Array.isArray(reservas) ? reservas : []) as ReservaConPasajeros[];
    if (!list.length) return;

    if (selectedReservaPagos) {
      const updated = list.find((r) => r.id === selectedReservaPagos.id);
      if (updated && updated !== selectedReservaPagos) {
        setSelectedReservaPagos(updated);
      }
    }
    if (selectedReservaVoucher) {
      const updated = list.find((r) => r.id === selectedReservaVoucher.id);
      if (updated && updated !== selectedReservaVoucher) {
        setSelectedReservaVoucher(updated);
      }
    }
    if (selectedReservaAgendar) {
      const updated = list.find((r) => r.id === selectedReservaAgendar.id);
      if (updated && updated !== selectedReservaAgendar) {
        setSelectedReservaAgendar(updated);
      }
    }
  }, [reservas, selectedReservaPagos, selectedReservaVoucher, selectedReservaAgendar]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Acciones: Eliminación
  const solicitarEliminar = (reserva: ReservaConPasajeros) => {
    setReservaAEliminar(reserva);
  };

  const cancelarEliminar = () => {
    if (eliminando) return;
    setReservaAEliminar(null);
  };

  const confirmarEliminar = async () => {
    if (!reservaAEliminar?.id) return;
    setEliminando(true);
    try {
      await deleteReserva(reservaAEliminar.id as number);
      toast.success('Reserva eliminada con éxito.');
      setReservaAEliminar(null);
    } catch (error: unknown) {
      if ((error as ApiErrorWithResponse)?.queued || isQueuedError(error as Error)) {
        toast.info('Sin conexión: la eliminación se sincronizará automáticamente al reconectar');
        setReservaAEliminar(null);
        return;
      }
      console.error('Error eliminando reserva:', error);
      toast.error(getApiErrorMessage(error, 'Error al eliminar reserva.'));
    } finally {
      setEliminando(false);
    }
  };

  // Acciones: Cancelación
  const abrirModalCancelar = (reserva: ReservaConPasajeros) => {
    setReservaACancelar(reserva);
    setMotivoCancelacion('');
    setErrorMotivoCancelacion(false);
  };

  const cerrarModalCancelar = () => {
    if (cancelando) return;
    setReservaACancelar(null);
    setMotivoCancelacion('');
    setErrorMotivoCancelacion(false);
  };

  const confirmarCancelarReserva = async (datosDevolucion?: DatosDevolucionCancelacion) => {
    if (!reservaACancelar?.id) return;
    const motivo = motivoCancelacion.trim();
    if (!motivo) {
      setErrorMotivoCancelacion(true);
      return;
    }
    try {
      const payload: CancelarReservaPayload = {
        motivo,
        version: reservaACancelar.version ?? 0,
        ...(datosDevolucion?.procesarDevolucion && datosDevolucion.monto > 0
          ? {
              devolucion: {
                monto: datosDevolucion.monto,
                metodoPago: datosDevolucion.metodoPago,
                comprobante: datosDevolucion.comprobante,
                notas: datosDevolucion.notas,
              },
            }
          : {}),
      };

      await cancelarReserva(reservaACancelar.id, payload);
      toast.success(
        datosDevolucion?.procesarDevolucion && datosDevolucion.monto > 0
          ? 'Reserva cancelada y devolución registrada exitosamente.'
          : 'Reserva cancelada exitosamente. Vuelos liberados.'
      );
      cerrarModalCancelar();
    } catch (err: unknown) {
      if ((err as ApiErrorWithResponse)?.queued || isQueuedError(err as Error)) {
        toast.info('Sin conexión: la cancelación se sincronizará automáticamente al reconectar');
        setReservaACancelar(null);
        setMotivoCancelacion('');
        setErrorMotivoCancelacion(false);
        return;
      }
      console.error('Error al cancelar reserva:', err);
      if (isConflictError(err as Error)) {
        fetchReservas();
        cerrarModalCancelar();
      } else {
        toast.error(getApiErrorMessage(err, 'Error al cancelar la reserva.'));
      }
    }
  };

  // Acciones: Desagendar
  const abrirModalDesagendar = (reserva: ReservaConPasajeros) => {
    setReservaADesagendar(reserva);
  };

  const cerrarModalDesagendar = () => {
    if (desagendando) return;
    setReservaADesagendar(null);
  };

  const confirmarDesagendarReserva = async () => {
    if (!reservaADesagendar?.id) return;
    try {
      await desagendarReserva(reservaADesagendar.id, {
        version: reservaADesagendar.version ?? 0,
      });
      toast.success('Reserva desagendada con éxito. Ha vuelto a Sin Agendar.');
      cerrarModalDesagendar();
    } catch (err: unknown) {
      if ((err as ApiErrorWithResponse)?.queued || isQueuedError(err as Error)) {
        toast.info('Sin conexión: el desagendamiento se sincronizará automáticamente al reconectar');
        setReservaADesagendar(null);
        return;
      }
      console.error('Error al desagendar reserva:', err);
      if (isConflictError(err as Error)) {
        toast.error('La reserva cambió en otro dispositivo. Recargando...');
        fetchReservas();
        cerrarModalDesagendar();
      } else {
        toast.error(getApiErrorMessage(err, 'Error al desagendar la reserva.'));
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

    pasajeroFirma,
    setPasajeroFirma,
    isFirmaModalOpen,
    setIsFirmaModalOpen,

    selectedReservaPagos,
    setSelectedReservaPagos,
    isPagosModalOpen,
    setIsPagosModalOpen,

    selectedReservaAgendar,
    setSelectedReservaAgendar,
    isAgendarModalOpen,
    setIsAgendarModalOpen,

    selectedReservaVoucher,
    setSelectedReservaVoucher,
    isVoucherModalOpen,
    setIsVoucherModalOpen,

    reservaACancelar,
    motivoCancelacion,
    setMotivoCancelacion,
    errorMotivoCancelacion,
    setErrorMotivoCancelacion,
    abrirModalCancelar,
    cerrarModalCancelar,
    confirmarCancelarReserva,

    reservaADesagendar,
    abrirModalDesagendar,
    cerrarModalDesagendar,
    confirmarDesagendarReserva,

    reservaAEliminar,
    eliminando,
    solicitarEliminar,
    cancelarEliminar,
    confirmarEliminar,
  };
}
