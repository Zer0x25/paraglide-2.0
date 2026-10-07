"use client";

import type { useCalendarioController } from '../hooks/useCalendarioController';
import { VueloModal } from './VueloModal';
import { SyncCalendarModal } from '@/components/SyncCalendarModal';
import { ConfigBloquesModal } from '@/components/ConfigBloquesModal';
import { PagosModal } from '@/components/PagosModal';

export interface CalendarioModalsProps {
  controller: ReturnType<typeof useCalendarioController>;
}

export function CalendarioModals({ controller: c }: CalendarioModalsProps) {
  return (
    <>
      {/* Modal de Creación / Edición de Vuelo */}
      <VueloModal
        isOpen={c.isModalOpen}
        onClose={() => {
          c.setIsModalOpen(false);
          c.setFilterReservaId(null);
        }}
        editingId={c.editingId}
        filterReservaId={c.filterReservaId}
        setFilterReservaId={c.setFilterReservaId}
        formData={c.formData}
        setFormData={c.setFormData}
        groupPilotSelections={c.groupPilotSelections}
        setGroupPilotSelections={c.setGroupPilotSelections}
        editingEstado={c.editingEstado}
        setEditingEstado={c.setEditingEstado}
        editingVersion={c.editingVersion}
        setEditingVersion={c.setEditingVersion}
        reservas={c.reservas}
        pasajeros={c.pasajeros}
        pilotos={c.pilotos}
        vuelos={c.vuelos}
        isBloqueado={c.isBloqueado}
        availableBlocks={c.availableBlocks}
        selectedTimeIsCustom={c.selectedTimeIsCustom}
        handleAsignacionAutomatica={c.handleAsignacionAutomatica}
        isPilotoDisabled={c.isPilotoDisabled}
        handleSubmit={c.handleSubmit}
        cancelarVuelo={c.cancelarVuelo}
        openConfigBloques={c.openConfigBloques}
        setDate={c.setDate}
        vuelosQueryRefetch={c.vuelosQueryRefetch}
        onOpenPagos={c.handleOpenPagos}
        onCompletarReserva={c.handleCompletarVueloReserva}
      />

      {/* Modal de Sincronización Universal */}
      <SyncCalendarModal 
        isOpen={c.isSyncModalOpen} 
        onClose={() => c.setIsSyncModalOpen(false)} 
      />

      {/* Modal de Configuración de Bloques */}
      <ConfigBloquesModal
        isOpen={c.isConfigModalOpen}
        onClose={() => c.setIsConfigModalOpen(false)}
      />

      {/* Modal de Historial y Registro de Pagos / Abonos */}
      <PagosModal
        key={c.selectedReservaPagos?.id ?? 'cerrado'}
        reserva={c.selectedReservaPagos}
        isOpen={c.isPagosModalOpen}
        onClose={() => {
          c.setIsPagosModalOpen(false);
          c.setSelectedReservaPagos(null);
        }}
        onSuccess={c.handlePagosSuccess}
      />
    </>
  );
}
