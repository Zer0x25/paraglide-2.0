import { Views } from 'react-big-calendar';
import { startOfWeek, addDays } from 'date-fns';
import { resolverConfiguracion, type ResolucionDiaDTO, dateKeyLocal } from '@parapente/shared';
import type { ConfiguracionBloque, HorarioBloque } from './types';

export function useCalendarioBlocks({
  date,
  view,
  fechaFormulario,
  horaFormulario,
  configuraciones,
  resolucionData,
  resolucionIsSuccess,
  resolucionIsPending,
  resolucionIsError,
}: {
  date: Date;
  view: string;
  fechaFormulario: string;
  horaFormulario: string;
  configuraciones: ConfiguracionBloque[];
  resolucionData?: Record<string, ResolucionDiaDTO>;
  resolucionIsSuccess: boolean;
  resolucionIsPending: boolean;
  resolucionIsError: boolean;
}) {
  const getDateKey = (d: Date): string => dateKeyLocal(d);

  const getActiveConfigForDate = (dateString: string): ConfiguracionBloque | null => {
    if (!dateString) return null;
    const dia = dateString.slice(0, 10);
    const resuelto = resolucionData?.[dia];
    if (resuelto && resuelto.configuracionId != null) {
      return {
        id: resuelto.configuracionId,
        nombre: resuelto.nombre ?? '',
        fechaInicio: null,
        fechaFin: null,
        fechaExacta: null,
        bloqueado: resuelto.bloqueado,
        horarios: resuelto.horarios,
      };
    }
    if (resolucionIsSuccess && resuelto == null) {
      return null;
    }
    if (resolucionIsPending || resolucionIsError) {
      return resolverConfiguracion(configuraciones, `${dia}T12:00:00Z`) as ConfiguracionBloque | null;
    }
    return null;
  };

  const activeConfig = getActiveConfigForDate(fechaFormulario);
  const isBloqueado = activeConfig?.bloqueado || false;
  const availableBlocks: HorarioBloque[] = activeConfig ? (activeConfig.horarios || []) : [];
  const selectedTimeIsCustom = Boolean(horaFormulario && !availableBlocks.some(b => b.horaInicio === horaFormulario));

  const timeToMinutes = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const greatestCommonDivisor = (a: number, b: number): number => {
    return b === 0 ? a : greatestCommonDivisor(b, a % b);
  };

  const createDateAtMinutes = (minutes: number) => {
    const rangeDate = new Date(date);
    rangeDate.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    return rangeDate;
  };

  const getCalendarVisibleDates = () => {
    if (view === Views.WEEK) {
      const weekStart = startOfWeek(date, { weekStartsOn: 1 });
      return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
    }
    return [date];
  };

  const visibleBlocks = getCalendarVisibleDates().flatMap((visibleDate) => {
    const config = getActiveConfigForDate(getDateKey(visibleDate));
    if (!config || config.bloqueado) return [];
    return config.horarios || [];
  });

  const calendarMinMinutes = visibleBlocks.length > 0
    ? Math.min(...visibleBlocks.map((block) => timeToMinutes(block.horaInicio)))
    : 9 * 60;
  const calendarMaxMinutes = visibleBlocks.length > 0
    ? Math.max(...visibleBlocks.map((block) => timeToMinutes(block.horaFin)))
    : 18 * 60;
  const calendarMin = createDateAtMinutes(calendarMinMinutes);
  const calendarMax = createDateAtMinutes(calendarMaxMinutes);
  const calendarStep = visibleBlocks.length > 0
    ? visibleBlocks
        .map((block) => timeToMinutes(block.horaFin) - timeToMinutes(block.horaInicio))
        .filter((duration) => duration > 0)
        .reduce((step, duration) => greatestCommonDivisor(step, duration))
    : 60;

  const getBlockForDateTime = (start: Date) => {
    const dateKey = getDateKey(start);
    const startTime = start.toTimeString().substring(0, 5);
    const config = getActiveConfigForDate(dateKey);
    return config?.horarios?.find((block) => block.horaInicio === startTime);
  };

  return {
    getDateKey,
    getActiveConfigForDate,
    activeConfig,
    isBloqueado,
    availableBlocks,
    selectedTimeIsCustom,
    calendarMin,
    calendarMax,
    calendarStep,
    getBlockForDateTime,
  };
}
