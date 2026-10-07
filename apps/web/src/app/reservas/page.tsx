"use client";

import { useReservasController } from './hooks/useReservasController';
import { useReservasSentinel } from './hooks/useReservasSentinel';
import {
  ReservasHeader,
  ReservasFilters,
  ReservasErrorBanner,
  ReservasTable,
  ReservasModals,
} from './components';

export default function ReservasPage() {
  const c = useReservasController();
  const sentinelRef = useReservasSentinel({
    hasNextPage: c.hasNextPage,
    isFetchingNextPage: c.isFetchingNextPage,
    loading: c.loading,
    fetchNextPage: c.fetchNextPage,
  });

  return (
    <div className="space-y-6 relative pb-12 animate-in fade-in duration-500">
      {/* Header y Acciones */}
      <ReservasHeader onOpenModal={c.handleOpenModal} />

      {/* Pestañas Temporales y Filtros */}
      <ReservasFilters
        filtros={c.filtros}
        setFiltros={c.setFiltros}
        total={c.total}
        searchQuery={c.searchQuery}
        onSearchChange={c.handleSearchChange}
        onClearSearch={c.handleClearSearch}
        estadoReservaFilter={c.estadoReservaFilter}
        setEstadoReservaFilter={c.setEstadoReservaFilter}
        deslindeFilter={c.deslindeFilter}
        setDeslindeFilter={c.setDeslindeFilter}
        reservasFiltradasCount={c.reservasFiltradas.length}
      />

      {/* Banner de error */}
      <ReservasErrorBanner error={c.error} onRetry={c.fetchReservas} />

      {/* Tabla / Grid de Reservas con Scroll Infinito */}
      <ReservasTable
        loading={c.loading}
        reservas={c.reservasFiltradas}
        sentinelRef={sentinelRef}
        hasNextPage={c.hasNextPage}
        isFetchingNextPage={c.isFetchingNextPage}
        onFetchNextPage={c.fetchNextPage}
        onEdit={c.handleEditModal}
        onDelete={c.eliminarReserva}
        onOpenFirma={(p) => {
          c.setPasajeroFirma(p);
          c.setIsFirmaModalOpen(true);
        }}
        onOpenPagos={(r) => {
          c.setSelectedReservaPagos(r);
          c.setIsPagosModalOpen(true);
        }}
        onOpenVoucher={(r) => {
          c.setSelectedReservaVoucher(r);
          c.setIsVoucherModalOpen(true);
        }}
        onOpenAgendar={(r) => {
          c.setSelectedReservaAgendar(r);
          c.setIsAgendarModalOpen(true);
        }}
        onOpenCancelar={c.abrirModalCancelar}
        onOpenDesagendar={c.abrirModalDesagendar}
        onReabrir={c.handleReabrir}
        onWhatsAppConfirmation={c.openWhatsAppConfirmation}
        onWhatsAppPiloto={c.openWhatsAppPiloto}
      />

      {/* Diálogos Modales del Módulo */}
      <ReservasModals controller={c} />
    </div>
  );
}
