import { useState, useMemo } from 'react';
import type { EquipoDTO } from '@parapente/shared';
import { useEquipos } from '../../../hooks/useEquipos';
import { calcularStatsEquipos, filtrarEquipos } from '../utils/equiposStats.util';

export function useEquiposController() {
  const {
    equipos,
    loading,
    createEquipo,
    updateEquipo,
    deleteEquipo,
    addMantenimiento,
    deleteMantenimiento,
  } = useEquipos();

  // Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [tipoFilter, setTipoFilter] = useState('TODOS');
  const [estadoFilter, setEstadoFilter] = useState('TODOS');

  // Modales
  const [isEquipoModalOpen, setIsEquipoModalOpen] = useState(false);
  const [editingEquipo, setEditingEquipo] = useState<EquipoDTO | null>(null);

  const [isMantenimientoModalOpen, setIsMantenimientoModalOpen] = useState(false);
  const [selectedEquipoMantenimiento, setSelectedEquipoMantenimiento] = useState<EquipoDTO | null>(null);

  // Estadísticas y Alertas
  const stats = useMemo(() => calcularStatsEquipos(equipos), [equipos]);

  // Filtrado de equipos
  const equiposFiltrados = useMemo(
    () => filtrarEquipos(equipos, { searchQuery, tipoFilter, estadoFilter }),
    [equipos, tipoFilter, estadoFilter, searchQuery]
  );

  const handleOpenEdit = (equipo: EquipoDTO) => {
    setEditingEquipo(equipo);
    setIsEquipoModalOpen(true);
  };

  const handleOpenCreate = () => {
    setEditingEquipo(null);
    setIsEquipoModalOpen(true);
  };

  const handleOpenMantenimiento = (equipo: EquipoDTO) => {
    setSelectedEquipoMantenimiento(equipo);
    setIsMantenimientoModalOpen(true);
  };

  const handleCloseEquipoModal = () => {
    setIsEquipoModalOpen(false);
    setEditingEquipo(null);
  };

  const handleCloseMantenimientoModal = () => {
    setIsMantenimientoModalOpen(false);
    setSelectedEquipoMantenimiento(null);
  };

  return {
    equipos,
    loading,
    searchQuery,
    setSearchQuery,
    tipoFilter,
    setTipoFilter,
    estadoFilter,
    setEstadoFilter,
    isEquipoModalOpen,
    setIsEquipoModalOpen,
    editingEquipo,
    isMantenimientoModalOpen,
    setIsMantenimientoModalOpen,
    selectedEquipoMantenimiento,
    stats,
    equiposFiltrados,
    handleOpenEdit,
    handleOpenCreate,
    handleOpenMantenimiento,
    handleCloseEquipoModal,
    handleCloseMantenimientoModal,
    createEquipo,
    updateEquipo,
    deleteEquipo,
    addMantenimiento,
    deleteMantenimiento,
  };
}
