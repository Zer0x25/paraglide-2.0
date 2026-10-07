"use client";

import { usePilotosController } from './hooks/usePilotosController';
import { PilotosHeader } from './components/PilotosHeader';
import { PilotosListTable } from './components/PilotosListTable';
import { PilotoFormModal } from './components/PilotoFormModal';
import { PilotoDisponibilidadModal } from './components/PilotoDisponibilidadModal';

export default function PilotosPage() {
  const c = usePilotosController();

  return (
    <div className="space-y-6 relative pb-12 animate-in fade-in duration-500">
      <PilotosHeader
        searchTerm={c.searchTerm}
        onSearchChange={c.setSearchTerm}
        onOpenNuevoModal={c.handleOpenModalParaCrear}
      />

      <PilotoFormModal
        isOpen={c.isModalOpen}
        onClose={() => c.setIsModalOpen(false)}
        editingId={c.editingId}
        formData={c.formData}
        setFormData={c.setFormData}
        onSubmit={c.handleSubmit}
      />

      <PilotoDisponibilidadModal
        isOpen={c.isAvailModalOpen}
        onClose={() => c.setIsAvailModalOpen(false)}
        selectedPiloto={c.selectedPiloto}
        currentMonth={c.currentMonth}
        setCurrentMonth={c.setCurrentMonth}
        selectAllMonth={c.selectAllMonth}
        invertMonth={c.invertMonth}
        resetAvailability={c.resetAvailability}
        saveAvailability={c.saveAvailability}
        availDirty={c.availDirty}
        saving={c.saving}
        dragRef={c.dragRef}
        stopPaint={c.stopPaint}
        startPaint={c.startPaint}
        paintTo={c.paintTo}
        paintFromEvent={c.paintFromEvent}
        toggleDay={c.toggleDay}
        openBlockSelector={c.openBlockSelector}
        dayStateFor={c.dayStateFor}
        blockSelector={c.blockSelector}
        setBlockSelector={c.setBlockSelector}
        blocksForDate={c.blocksForDate}
        isBlockSelected={c.isBlockSelected}
        applyBlockToggle={c.applyBlockToggle}
      />

      <PilotosListTable
        loading={c.loading}
        pilotos={c.pilotos}
        filteredPilotos={c.filteredPilotos}
        sortField={c.sortField}
        sortDirection={c.sortDirection}
        onSort={c.handleSort}
        onOpenAvailModal={c.handleOpenAvailModal}
        onOpenEditModal={c.handleOpenModalParaEditar}
      />
    </div>
  );
}
