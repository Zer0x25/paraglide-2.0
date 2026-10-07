import { useState } from 'react';
import { toast } from 'sonner';
import api from '../../../services/api';
import { typedApiOutbox } from '../../../services/apiOutbox';
import { isConflictError, isQueuedError } from '../../../hooks/useDomainMutation';
import {
  buildInitialBlockOverrides,
  type PilotoConId,
  type PilotoDisponibilidad,
  type HorarioBloque,
} from '../utils/pilotoDisponibilidad.util';

interface UsePilotoPersistenciaParams {
  selectedPiloto: PilotoConId | null;
  availVersion: number;
  setAvailVersion: React.Dispatch<React.SetStateAction<number>>;
  setAvailDisp: React.Dispatch<React.SetStateAction<PilotoDisponibilidad | null>>;
  setIsAvailModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  fetchPilotos: () => void;
  currentMonth: Date;
  resDesdeISO: string;
  resHastaISO: string;
  availOverrides: Record<string, boolean>;
  setAvailOverrides: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  blockOverrides: Record<string, Record<string, boolean>>;
  setBlockOverrides: React.Dispatch<React.SetStateAction<Record<string, Record<string, boolean>>>>;
  setAvailDirty: React.Dispatch<React.SetStateAction<boolean>>;
  blocksForDate: (dateStr: string) => HorarioBloque[];
  originalAvailable: (dateStr: string) => boolean;
  monthDates: () => string[];
}

export function usePilotoPersistencia({
  selectedPiloto,
  availVersion,
  setAvailVersion,
  setAvailDisp,
  setIsAvailModalOpen,
  fetchPilotos,
  currentMonth,
  resDesdeISO,
  resHastaISO,
  availOverrides,
  setAvailOverrides,
  blockOverrides,
  setBlockOverrides,
  setAvailDirty,
  blocksForDate,
  originalAvailable,
  monthDates,
}: UsePilotoPersistenciaParams) {
  const [saving, setSaving] = useState(false);

  const saveAvailability = async () => {
    if (!selectedPiloto) return;
    setSaving(true);
    try {
      const touched = new Set<string>([
        ...Object.keys(blockOverrides),
        ...Object.keys(availOverrides),
      ]);
      const fechas: {
        fecha: string;
        disponible: boolean;
        bloques: { horaInicio: string; horaFin: string }[];
      }[] = [];

      for (const fecha of touched) {
        const total = blocksForDate(fecha).length;
        const ov = blockOverrides[fecha];
        const hasOv = !!ov && Object.keys(ov).length > 0;
        const partial = hasOv && Object.keys(ov).length < total;
        const desiredAvail = ov ? hasOv : (availOverrides[fecha] ?? originalAvailable(fecha));
        const bloques: HorarioBloque[] = ov
          ? blocksForDate(fecha)
              .filter((b: HorarioBloque) => ov[b.horaInicio])
              .map((b: HorarioBloque) => ({ horaInicio: b.horaInicio, horaFin: b.horaFin }))
          : desiredAvail
            ? blocksForDate(fecha).map((b: HorarioBloque) => ({
                horaInicio: b.horaInicio,
                horaFin: b.horaFin,
              }))
            : [];
        fechas.push({ fecha, disponible: partial || desiredAvail, bloques });
      }

      await typedApiOutbox.pilotos.guardarDisponibilidad(selectedPiloto.id, {
        version: availVersion,
        fechas,
      });
      setIsAvailModalOpen(false);
      fetchPilotos();
      toast.success('Disponibilidad actualizada.');
    } catch (error: unknown) {
      console.error('Error saving availability:', error);
      if (isQueuedError(error) || (error as { queued?: boolean })?.queued) {
        toast.info('Sin conexión: la disponibilidad se enviará automáticamente al reconectar');
        setIsAvailModalOpen(false);
        return;
      }
      if (isConflictError(error)) {
        toast.error('Los datos de disponibilidad cambiaron en otro dispositivo. Recargando...');
        fetchPilotos();
      } else {
        toast.error('Error al guardar la disponibilidad.');
      }
    } finally {
      setSaving(false);
    }
  };

  const resetAvailability = () => {
    if (!selectedPiloto) return;
    const monthLabel = currentMonth.toLocaleString('es', { month: 'long', year: 'numeric' });
    const desde = resDesdeISO;
    const hasta = resHastaISO;
    const monthSet = new Set(monthDates());
    const hasLocalChanges =
      Object.keys(availOverrides).some((k) => monthSet.has(k)) ||
      Object.keys(blockOverrides).some((k) => monthSet.has(k));

    toast(`¿Limpiar ${monthLabel}? Solo se tocará este mes.`, {
      description: hasLocalChanges ? 'Se descartarán los cambios sin guardar de este mes.' : undefined,
      action: {
        label: 'Sí, limpiar mes',
        onClick: async () => {
          const prevAvail = { ...availOverrides };
          const prevBlocks = { ...blockOverrides };
          const nextAvail = Object.fromEntries(
            Object.entries(prevAvail).filter(([k]) => !monthSet.has(k))
          );
          const nextBlocks = Object.fromEntries(
            Object.entries(prevBlocks).filter(([k]) => !monthSet.has(k))
          );
          setAvailOverrides(nextAvail);
          setBlockOverrides(nextBlocks);
          const stillDirty =
            Object.keys(nextAvail).length > 0 || Object.keys(nextBlocks).length > 0;
          setAvailDirty(stillDirty);

          try {
            await typedApiOutbox.pilotos.resetDisponibilidad(selectedPiloto.id, { desde, hasta });
            await fetchPilotos();
            try {
              const disp = (await api.pilotos.obtenerDisponibilidad(
                selectedPiloto.id
              )) as PilotoDisponibilidad;
              setAvailDisp(disp);
              setAvailVersion(disp.version ?? availVersion);
              const rebuilt = buildInitialBlockOverrides(disp, (ds) => blocksForDate(ds).length);
              const filteredRebuilt = Object.fromEntries(
                Object.entries(rebuilt).filter(([k]) => !monthSet.has(k))
              );
              setBlockOverrides((cur) => ({
                ...filteredRebuilt,
                ...Object.fromEntries(Object.entries(cur).filter(([k]) => !monthSet.has(k))),
              }));
            } catch {
              // no crítico
            }
            toast.success(`${monthLabel}: mes limpiado.`);
          } catch (error: unknown) {
            if (isQueuedError(error) || (error as { queued?: boolean })?.queued) {
              toast.info('Sin conexión: la limpieza del mes se enviará al reconectar');
              return;
            }
            console.error('Error resetting availability (mes):', error);
            setAvailOverrides(prevAvail);
            setBlockOverrides(prevBlocks);
            setAvailDirty(true);
            toast.error('Error al limpiar el mes.');
          }
        },
      },
      cancel: { label: 'Cancelar', onClick: () => {} },
    });
  };

  return {
    saving,
    saveAvailability,
    resetAvailability,
  };
}
