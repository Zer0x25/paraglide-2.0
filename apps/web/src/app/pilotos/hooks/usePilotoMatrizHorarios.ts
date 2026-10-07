import { useState, useRef } from 'react';
import { toast } from 'sonner';
import {
  resolverConfiguracion,
  type ConfiguracionBloqueDTO,
  type ResolucionDiaDTO,
} from '@parapente/shared';
import {
  getMonthDates,
  calculateOriginalAvailable,
  calculateDayState,
  type PilotoDisponibilidad,
  type HorarioBloque,
} from '../utils/pilotoDisponibilidad.util';

interface UsePilotoMatrizHorariosParams {
  currentMonth: Date;
  bloqueConfigs: ConfiguracionBloqueDTO[];
  resolucionData?: Record<string, ResolucionDiaDTO>;
  resolucionIsSuccess: boolean;
  resolucionIsPending: boolean;
  resolucionIsError: boolean;
  availDisp: PilotoDisponibilidad | null;
}

const LONG_PRESS_MS = 650;
const DRAG_THRESHOLD_PX = 10;

export function usePilotoMatrizHorarios({
  currentMonth,
  bloqueConfigs,
  resolucionData,
  resolucionIsSuccess,
  resolucionIsPending,
  resolucionIsError,
  availDisp,
}: UsePilotoMatrizHorariosParams) {
  const [availOverrides, setAvailOverrides] = useState<Record<string, boolean>>({});
  const [blockOverrides, setBlockOverrides] = useState<Record<string, Record<string, boolean>>>({});
  const [blockSelector, setBlockSelector] = useState<{ dateStr: string } | null>(null);
  const [availDirty, setAvailDirty] = useState(false);

  const dragRef = useRef<{ painting: boolean; value: boolean } | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDateRef = useRef<string | null>(null);
  const longPressFiredRef = useRef(false);
  const pendingPosRef = useRef<{ x: number; y: number } | null>(null);

  const getActiveConfigForDate = (
    dateStr: string
  ): { bloqueado: boolean; horarios: { horaInicio: string; horaFin: string }[] } | null => {
    if (!dateStr) return null;
    const dia = dateStr.slice(0, 10);
    const resuelto = resolucionData?.[dia];
    if (resuelto && resuelto.configuracionId != null) {
      return { bloqueado: resuelto.bloqueado, horarios: resuelto.horarios };
    }
    if (resolucionIsSuccess && resuelto == null) return null;
    if (resolucionIsPending || resolucionIsError) {
      return resolverConfiguracion(
        bloqueConfigs as unknown as Parameters<typeof resolverConfiguracion>[0],
        `${dia}T12:00:00Z`
      ) as { bloqueado: boolean; horarios: HorarioBloque[] } | null;
    }
    return null;
  };

  const blocksForDate = (dateStr: string): HorarioBloque[] => {
    const config = getActiveConfigForDate(dateStr);
    if (!config || config.bloqueado) return [];
    return config.horarios || [];
  };

  const monthDates = () => getMonthDates(currentMonth);

  const originalAvailable = (dateStr: string) =>
    calculateOriginalAvailable(dateStr, availDisp);

  const desiredAvailable = (dateStr: string) =>
    availOverrides[dateStr] ?? originalAvailable(dateStr);

  const dayStateFor = (dateStr: string): 'full' | 'partial' | 'none' =>
    calculateDayState(
      dateStr,
      blocksForDate(dateStr).length,
      blockOverrides,
      desiredAvailable(dateStr)
    );

  const isBlockSelected = (dateStr: string, horaInicio: string) => {
    const ov = blockOverrides[dateStr];
    if (ov) return !!ov[horaInicio];
    return desiredAvailable(dateStr);
  };

  const clearBlockOverrideFor = (dateStr: string) => {
    setBlockOverrides((prev) => {
      if (!prev[dateStr]) return prev;
      const n = { ...prev };
      delete n[dateStr];
      return n;
    });
  };

  const applyBlockToggle = (dateStr: string, horaInicio: string) => {
    const total = blocksForDate(dateStr).length;
    if (total === 0) return;
    const current = blockOverrides[dateStr] ?? {};
    const nextSel = { ...current, [horaInicio]: !current[horaInicio] };
    const selected = Object.fromEntries(Object.entries(nextSel).filter(([, v]) => v));
    const count = Object.keys(selected).length;
    setAvailDirty(true);
    if (count === 0) {
      clearBlockOverrideFor(dateStr);
      setAvailOverrides((prev) => ({ ...prev, [dateStr]: false }));
    } else if (count >= total) {
      clearBlockOverrideFor(dateStr);
      setAvailOverrides((prev) => ({ ...prev, [dateStr]: true }));
    } else {
      setBlockOverrides((prev) => ({ ...prev, [dateStr]: selected }));
      setAvailOverrides((prev) => {
        const n = { ...prev };
        delete n[dateStr];
        return n;
      });
    }
  };

  const toggleDay = (dateStr: string) => {
    clearBlockOverrideFor(dateStr);
    setAvailOverrides((prev) => ({ ...prev, [dateStr]: !desiredAvailable(dateStr) }));
    setAvailDirty(true);
  };

  const openBlockSelector = (dateStr: string) => {
    if (blocksForDate(dateStr).length === 0) {
      toast.error('No hay bloques configurados para ese día');
      return;
    }
    dragRef.current = null;
    pendingDateRef.current = null;
    pendingPosRef.current = null;
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    setBlockSelector({ dateStr });
    if (
      typeof navigator !== 'undefined' &&
      (navigator as unknown as { vibrate?: (n: number) => boolean }).vibrate
    ) {
      (navigator as unknown as { vibrate: (n: number) => boolean }).vibrate?.(40);
    }
  };

  const startPaint = (dateStr: string, clientX?: number, clientY?: number) => {
    pendingDateRef.current = dateStr;
    if (clientX != null && clientY != null) pendingPosRef.current = { x: clientX, y: clientY };
    else pendingPosRef.current = null;
    longPressFiredRef.current = false;
    dragRef.current = null;
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      longPressFiredRef.current = true;
      openBlockSelector(dateStr);
    }, LONG_PRESS_MS);
  };

  const paintTo = (dateStr: string) => {
    if (longPressFiredRef.current) return;
    if (!dragRef.current) {
      if (pendingDateRef.current && pendingDateRef.current !== dateStr) {
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
        const initialValue = !desiredAvailable(pendingDateRef.current);
        dragRef.current = { painting: true, value: initialValue };
        setAvailOverrides((prev) => ({ ...prev, [pendingDateRef.current!]: initialValue }));
        clearBlockOverrideFor(pendingDateRef.current);
        setAvailDirty(true);
      } else {
        return;
      }
    }
    if (!dragRef.current.painting) return;
    setAvailOverrides((prev) => {
      if (prev[dateStr] === dragRef.current!.value) return prev;
      return { ...prev, [dateStr]: dragRef.current!.value };
    });
    clearBlockOverrideFor(dateStr);
    setAvailDirty(true);
  };

  const stopPaint = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    if (!dragRef.current?.painting && pendingDateRef.current && !longPressFiredRef.current) {
      const ds = pendingDateRef.current;
      const value = !desiredAvailable(ds);
      setAvailOverrides((prev) => ({ ...prev, [ds]: value }));
      clearBlockOverrideFor(ds);
      setAvailDirty(true);
    }
    pendingDateRef.current = null;
    pendingPosRef.current = null;
    dragRef.current = null;
    longPressFiredRef.current = false;
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const paintFromEvent = (clientX: number, clientY: number) => {
    if (!dragRef.current?.painting && pendingDateRef.current && pendingPosRef.current) {
      const dx = clientX - pendingPosRef.current.x;
      const dy = clientY - pendingPosRef.current.y;
      if (Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX) {
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
      }
    }
    const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
    const dateStr = el?.closest('[data-date]')?.getAttribute('data-date');
    if (dateStr) paintTo(dateStr);
  };

  const selectAllMonth = () => {
    const next = { ...availOverrides };
    for (const ds of monthDates()) {
      next[ds] = true;
      clearBlockOverrideFor(ds);
    }
    setAvailOverrides(next);
    setAvailDirty(true);
  };

  const invertMonth = () => {
    const next = { ...availOverrides };
    const nextBlocks = { ...blockOverrides };
    for (const ds of monthDates()) {
      const state = dayStateFor(ds);
      if (state === 'partial') {
        const blocks = blocksForDate(ds);
        const selected: Record<string, boolean> = {};
        for (const b of blocks) selected[b.horaInicio] = !isBlockSelected(ds, b.horaInicio);
        const count = Object.keys(selected).filter((k) => selected[k]).length;
        if (count === 0) {
          delete nextBlocks[ds];
          next[ds] = false;
        } else if (count >= blocks.length) {
          delete nextBlocks[ds];
          next[ds] = true;
        } else {
          nextBlocks[ds] = selected;
          delete next[ds];
        }
      } else {
        next[ds] = state !== 'full';
        delete nextBlocks[ds];
      }
    }
    setAvailOverrides(next);
    setBlockOverrides(nextBlocks);
    setAvailDirty(true);
  };

  return {
    availOverrides,
    setAvailOverrides,
    blockOverrides,
    setBlockOverrides,
    blockSelector,
    setBlockSelector,
    availDirty,
    setAvailDirty,
    dragRef,
    blocksForDate,
    monthDates,
    originalAvailable,
    desiredAvailable,
    dayStateFor,
    isBlockSelected,
    clearBlockOverrideFor,
    applyBlockToggle,
    toggleDay,
    openBlockSelector,
    startPaint,
    paintTo,
    stopPaint,
    paintFromEvent,
    selectAllMonth,
    invertMonth,
  };
}
