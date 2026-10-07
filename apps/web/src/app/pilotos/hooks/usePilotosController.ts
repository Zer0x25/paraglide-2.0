"use client";

import { usePilotosCrud } from './usePilotosCrud';
import { usePilotoDisponibilidad } from './usePilotoDisponibilidad';

export function usePilotosController() {
  const crud = usePilotosCrud();
  const avail = usePilotoDisponibilidad({
    pilotos: crud.pilotos,
    fetchPilotos: crud.fetchPilotos,
  });

  return {
    // Pilotos CRUD & list state
    pilotos: crud.pilotos,
    loading: crud.loading,
    fetchPilotos: crud.fetchPilotos,
    searchTerm: crud.searchTerm,
    setSearchTerm: crud.setSearchTerm,
    sortField: crud.sortField,
    sortDirection: crud.sortDirection,
    handleSort: crud.handleSort,
    filteredPilotos: crud.filteredPilotos,
    isModalOpen: crud.isModalOpen,
    setIsModalOpen: crud.setIsModalOpen,
    editingId: crud.editingId,
    formData: crud.formData,
    setFormData: crud.setFormData,
    handleOpenModalParaCrear: crud.handleOpenModalParaCrear,
    handleOpenModalParaEditar: crud.handleOpenModalParaEditar,
    handleSubmit: crud.handleSubmit,

    // Availability modal & interaction state
    isAvailModalOpen: avail.isAvailModalOpen,
    setIsAvailModalOpen: avail.setIsAvailModalOpen,
    selectedPiloto: avail.selectedPiloto,
    handleOpenAvailModal: avail.handleOpenAvailModal,
    currentMonth: avail.currentMonth,
    setCurrentMonth: avail.setCurrentMonth,
    selectAllMonth: avail.selectAllMonth,
    invertMonth: avail.invertMonth,
    resetAvailability: avail.resetAvailability,
    saveAvailability: avail.saveAvailability,
    availDirty: avail.availDirty,
    saving: avail.saving,
    dragRef: avail.dragRef,
    stopPaint: avail.stopPaint,
    startPaint: avail.startPaint,
    openBlockSelector: avail.openBlockSelector,
    paintTo: avail.paintTo,
    paintFromEvent: avail.paintFromEvent,
    toggleDay: avail.toggleDay,
    dayStateFor: avail.dayStateFor,
    blockSelector: avail.blockSelector,
    setBlockSelector: avail.setBlockSelector,
    blocksForDate: avail.blocksForDate,
    isBlockSelected: avail.isBlockSelected,
    applyBlockToggle: avail.applyBlockToggle,
  };
}
