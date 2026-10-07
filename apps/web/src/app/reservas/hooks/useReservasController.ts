import { useState, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import type { ReservaConPasajeros, PasajeroConVuelos, VueloConPiloto } from '@/types/reservaDetalle';
import { useReservas } from '../../../hooks/useReservas';
import { useMeteorologia } from '../../../hooks/useMeteorologia';
import typedApi from '../../../services/api';
import { useReservasModals, getApiErrorMessage } from './useReservasModals';
import { useReservaForm } from './useReservaForm';
import { useReservaWhatsApp } from './useReservaWhatsApp';

export type EstadoReservaFilter = 'TODOS' | 'SIN_AGENDAR' | 'AGENDADA' | 'COMPLETADA' | 'CANCELADA';
export type DeslindeFilter = 'TODOS' | 'PENDIENTES' | 'COMPLETOS';

export function useReservasController() {
  const {
    reservas,
    total,
    filtros,
    loading,
    error,
    refetch: fetchReservas,
    setFiltros,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    createReserva,
    updateReserva,
    deleteReserva,
    cancelarReserva,
    cancelando,
    desagendarReserva,
    desagendando,
  } = useReservas();

  const { pronostico } = useMeteorologia();

  // Filtros y Búsqueda (Pilar 5.3: tabs/búsqueda/pago viajan al servidor)
  const [searchQuery, setSearchQuery] = useState('');
  const [estadoReservaFilter, setEstadoReservaFilter] = useState<EstadoReservaFilter>('TODOS');
  const [deslindeFilter, setDeslindeFilter] = useState<DeslindeFilter>('TODOS');

  // Sub-hook 1: Gestión de modales y ciclo de vida de diálogos
  const modals = useReservasModals({
    reservas,
    fetchReservas,
    deleteReserva,
    cancelarReserva,
    cancelando,
    desagendarReserva,
    desagendando,
  });

  // Sub-hook 2: Gestión de formulario, cálculo de tarifas y promociones
  const form = useReservaForm({
    createReserva,
    updateReserva,
    fetchReservas,
    editingId: modals.editingId,
    setEditingId: modals.setEditingId,
    editingVersion: modals.editingVersion,
    setEditingVersion: modals.setEditingVersion,
    setIsModalOpen: modals.setIsModalOpen,
    setSelectedReservaPagos: modals.setSelectedReservaPagos,
    setIsPagosModalOpen: modals.setIsPagosModalOpen,
  });

  // Sub-hook 3: Notificaciones y coordinación vía WhatsApp con índice UV
  const whatsapp = useReservaWhatsApp(pronostico);

  // Búsqueda server-side con debounce
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setFiltros({ q: value.trim() || undefined });
    }, 400);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setFiltros({ q: undefined });
  };

  // Filtros derivados de datos anidados
  const reservasFiltradas = useMemo(() => {
    return (reservas as unknown as ReservaConPasajeros[]).filter((r: ReservaConPasajeros) => {
      if (estadoReservaFilter !== 'TODOS') {
        const estadoReal = r.estado ?? 'SIN_AGENDAR';
        const pasajerosCompletados =
          r.pasajeros?.filter((p: PasajeroConVuelos) =>
            p.vuelos?.some((v: VueloConPiloto) => v.estado === 'COMPLETADO')
          ) || [];
        const pasajerosActivos =
          r.pasajeros?.filter(
            (p: PasajeroConVuelos) =>
              !p.vuelos?.some((v: VueloConPiloto) => v.estado === 'COMPLETADO')
          ) || [];
        const todosVolaron = pasajerosCompletados.length > 0 && pasajerosActivos.length === 0;
        const estadoEfectivo =
          estadoReal === 'COMPLETADA' || (todosVolaron && estadoReal !== 'CANCELADA')
            ? 'COMPLETADA'
            : estadoReal;

        if (estadoEfectivo !== estadoReservaFilter) return false;
      }

      const totalPax = r.pasajeros?.length || 0;
      const todosFirmados = totalPax > 0 && r.pasajeros?.every((p: PasajeroConVuelos) => p.firmaDeslinde);
      if (deslindeFilter === 'COMPLETOS' && !todosFirmados) return false;
      if (deslindeFilter === 'PENDIENTES' && todosFirmados) return false;

      return true;
    });
  }, [reservas, estadoReservaFilter, deslindeFilter]);

  // Cierre contable & reapertura
  const handleReabrir = async (reserva: ReservaConPasajeros) => {
    const motivo =
      typeof window !== 'undefined'
        ? window.prompt(
            `Ingresa el motivo de reapertura para la reserva #${reserva.numeroReserva || reserva.id}:`
          )
        : null;
    if (!reserva.id || !motivo || !motivo.trim()) return;
    try {
      await typedApi.reservas.reabrir(reserva.id, {
        motivo: motivo.trim(),
        version: reserva.version,
      });
      toast.success('Reserva reabierta con éxito.');
      fetchReservas();
    } catch (err: unknown) {
      console.error('Error al reabrir reserva:', err);
      toast.error(getApiErrorMessage(err, 'No se pudo reabrir la reserva.'));
    }
  };

  return {
    // Queries & data
    reservas,
    total,
    filtros,
    loading,
    error,
    fetchReservas,
    setFiltros,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    cancelando,

    // Filters & search
    searchQuery,
    handleSearchChange,
    handleClearSearch,
    estadoReservaFilter,
    setEstadoReservaFilter,
    deslindeFilter,
    setDeslindeFilter,
    reservasFiltradas,

    // Modals
    isModalOpen: modals.isModalOpen,
    setIsModalOpen: modals.setIsModalOpen,
    editingId: modals.editingId,
    pasajeroFirma: modals.pasajeroFirma,
    setPasajeroFirma: modals.setPasajeroFirma,
    isFirmaModalOpen: modals.isFirmaModalOpen,
    setIsFirmaModalOpen: modals.setIsFirmaModalOpen,
    selectedReservaPagos: modals.selectedReservaPagos,
    setSelectedReservaPagos: modals.setSelectedReservaPagos,
    isPagosModalOpen: modals.isPagosModalOpen,
    setIsPagosModalOpen: modals.setIsPagosModalOpen,
    selectedReservaAgendar: modals.selectedReservaAgendar,
    setSelectedReservaAgendar: modals.setSelectedReservaAgendar,
    isAgendarModalOpen: modals.isAgendarModalOpen,
    setIsAgendarModalOpen: modals.setIsAgendarModalOpen,
    selectedReservaVoucher: modals.selectedReservaVoucher,
    setSelectedReservaVoucher: modals.setSelectedReservaVoucher,
    isVoucherModalOpen: modals.isVoucherModalOpen,
    setIsVoucherModalOpen: modals.setIsVoucherModalOpen,

    // Cancel modal
    reservaACancelar: modals.reservaACancelar,
    motivoCancelacion: modals.motivoCancelacion,
    setMotivoCancelacion: modals.setMotivoCancelacion,
    errorMotivoCancelacion: modals.errorMotivoCancelacion,
    setErrorMotivoCancelacion: modals.setErrorMotivoCancelacion,
    abrirModalCancelar: modals.abrirModalCancelar,
    cerrarModalCancelar: modals.cerrarModalCancelar,
    confirmarCancelarReserva: modals.confirmarCancelarReserva,

    // Desagendar modal
    reservaADesagendar: modals.reservaADesagendar,
    desagendando,
    abrirModalDesagendar: modals.abrirModalDesagendar,
    cerrarModalDesagendar: modals.cerrarModalDesagendar,
    confirmarDesagendarReserva: modals.confirmarDesagendarReserva,

    // Eliminar modal
    eliminarReserva: modals.solicitarEliminar,
    solicitarEliminar: modals.solicitarEliminar,
    cancelarEliminar: modals.cancelarEliminar,
    confirmarEliminar: modals.confirmarEliminar,
    reservaAEliminar: modals.reservaAEliminar,
    eliminando: modals.eliminando,

    // Form
    register: form.register,
    handleSubmit: form.handleSubmit,
    errors: form.errors,
    isDirty: form.isDirty,
    pasajerosFields: form.pasajerosFields,
    append: form.append,
    remove: form.remove,
    valorTotal: form.valorTotal,
    abono: form.abono,
    esSinFecha: form.esSinFecha,
    setEsSinFecha: form.setEsSinFecha,
    tarifaSeleccionada: form.tarifaSeleccionada,
    setTarifaSeleccionada: form.setTarifaSeleccionada,
    promoSeleccionada: form.promoSeleccionada,
    setPromoSeleccionada: form.setPromoSeleccionada,
    detalleCalculo: form.detalleCalculo,
    puntoDeEncuentro: form.puntoDeEncuentro,
    tarifasActivas: form.tarifasActivas,
    promosVigentes: form.promosVigentes,
    bloquesDelDia: form.bloquesDelDia,
    fechaReferencial: form.fechaReferencial,
    setValue: form.setValue,
    calcularValor: form.calcularValor,
    copiarDatosTitular: form.copiarDatosTitular,
    onInvalid: form.onInvalid,
    onSubmit: form.onSubmit,
    handleOpenModal: form.handleOpenModal,
    handleEditModal: form.handleEditModal,

    // WhatsApp
    openWhatsAppConfirmation: whatsapp.openWhatsAppConfirmation,
    openWhatsAppPiloto: whatsapp.openWhatsAppPiloto,

    // Cierre contable & reapertura
    handleReabrir,
  };
}
