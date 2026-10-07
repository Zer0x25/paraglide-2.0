import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import type {
  ConfiguracionBloqueDTO,
  PilotoDTO,
  ResolucionDiaDTO,
} from '@parapente/shared';
import api from '../../../services/api';
import {
  buildInitialBlockOverrides,
  type PilotoConId,
  type PilotoDisponibilidad,
} from '../utils/pilotoDisponibilidad.util';
import { usePilotoMatrizHorarios } from './usePilotoMatrizHorarios';
import { usePilotoPersistencia } from './usePilotoPersistencia';

interface UsePilotoDisponibilidadParams {
  pilotos: unknown;
  fetchPilotos: () => void;
}

export function usePilotoDisponibilidad({
  pilotos,
  fetchPilotos,
}: UsePilotoDisponibilidadParams) {
  const [isAvailModalOpen, setIsAvailModalOpen] = useState(false);
  const [selectedPiloto, setSelectedPiloto] = useState<PilotoConId | null>(null);
  const [availVersion, setAvailVersion] = useState(0);
  const [availDisp, setAvailDisp] = useState<PilotoDisponibilidad | null>(null);

  const bloqueConfigsQuery = useQuery<ConfiguracionBloqueDTO[]>({
    queryKey: ['configuracion-bloques'],
    queryFn: () => api.configuracion.listar(),
  });
  const bloqueConfigs = bloqueConfigsQuery.data ?? [];

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const resDesdeISO = new Date(
    Date.UTC(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
  )
    .toISOString()
    .slice(0, 10);
  const resHastaISO = new Date(
    Date.UTC(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)
  )
    .toISOString()
    .slice(0, 10);

  const resolucionQuery = useQuery<Record<string, ResolucionDiaDTO>>({
    queryKey: ['configuracion-resolucion', 'pilotos', resDesdeISO, resHastaISO],
    queryFn: () => api.configuracion.resolver({ desde: resDesdeISO, hasta: resHastaISO }),
    retry: false,
    staleTime: 60_000,
  });

  // Sincronizar selección con lista actualizada
  /* eslint-disable react-hooks/set-state-in-effect -- sincroniza selección con lista actualizada; evita stale data en modal */
  useEffect(() => {
    if (selectedPiloto && Array.isArray(pilotos)) {
      const updated = (pilotos as PilotoConId[]).find((p) => p.id === selectedPiloto.id);
      if (updated) setSelectedPiloto(updated);
    }
  }, [pilotos, selectedPiloto]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Sub-hook 1: Cálculo de matriz de horarios, días libres e interacciones de calendario
  const matriz = usePilotoMatrizHorarios({
    currentMonth,
    bloqueConfigs,
    resolucionData: resolucionQuery.data,
    resolucionIsSuccess: resolucionQuery.isSuccess,
    resolucionIsPending: resolucionQuery.isPending,
    resolucionIsError: resolucionQuery.isError,
    availDisp,
  });

  const handleOpenAvailModal = async (piloto: PilotoDTO) => {
    if (piloto.id == null) return;
    setSelectedPiloto(piloto as PilotoConId);
    setAvailVersion(piloto.version ?? 0);
    matriz.setAvailOverrides({});
    matriz.setBlockOverrides({});
    setAvailDisp(null);
    matriz.setBlockSelector(null);
    matriz.setAvailDirty(false);
    setIsAvailModalOpen(true);
    try {
      const disp = (await api.pilotos.obtenerDisponibilidad(piloto.id)) as PilotoDisponibilidad;
      setAvailDisp(disp);
      setAvailVersion(disp.version ?? (piloto as PilotoConId).version ?? 0);
      matriz.setBlockOverrides(
        buildInitialBlockOverrides(disp, (ds) => matriz.blocksForDate(ds).length)
      );
    } catch (error) {
      console.error('Error cargando disponibilidad:', error);
    }
  };

  // Sub-hook 2: Persistencia, outbox offline y reseteo mensual
  const persistencia = usePilotoPersistencia({
    selectedPiloto,
    availVersion,
    setAvailVersion,
    setAvailDisp,
    setIsAvailModalOpen,
    fetchPilotos,
    currentMonth,
    resDesdeISO,
    resHastaISO,
    availOverrides: matriz.availOverrides,
    setAvailOverrides: matriz.setAvailOverrides,
    blockOverrides: matriz.blockOverrides,
    setBlockOverrides: matriz.setBlockOverrides,
    setAvailDirty: matriz.setAvailDirty,
    blocksForDate: matriz.blocksForDate,
    originalAvailable: matriz.originalAvailable,
    monthDates: matriz.monthDates,
  });

  return {
    isAvailModalOpen,
    setIsAvailModalOpen,
    selectedPiloto,
    setSelectedPiloto,
    handleOpenAvailModal,
    currentMonth,
    setCurrentMonth,
    selectAllMonth: matriz.selectAllMonth,
    invertMonth: matriz.invertMonth,
    resetAvailability: persistencia.resetAvailability,
    saveAvailability: persistencia.saveAvailability,
    availDirty: matriz.availDirty,
    saving: persistencia.saving,
    dragRef: matriz.dragRef,
    stopPaint: matriz.stopPaint,
    startPaint: matriz.startPaint,
    openBlockSelector: matriz.openBlockSelector,
    paintTo: matriz.paintTo,
    paintFromEvent: matriz.paintFromEvent,
    toggleDay: matriz.toggleDay,
    dayStateFor: matriz.dayStateFor,
    blockSelector: matriz.blockSelector,
    setBlockSelector: matriz.setBlockSelector,
    blocksForDate: matriz.blocksForDate,
    isBlockSelected: matriz.isBlockSelected,
    applyBlockToggle: matriz.applyBlockToggle,
  };
}
