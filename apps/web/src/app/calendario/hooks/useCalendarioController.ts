"use client";

import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api';
import { dateFnsLocalizer, Views } from 'react-big-calendar';
import { format, startOfWeek, getDay, addDays, startOfMonth, endOfMonth, endOfWeek, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { type ResolucionDiaDTO, dateKeyLocal } from '@parapente/shared';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import type { Vuelo, Piloto, Pasajero, ConfiguracionBloque } from './types';
import type { ReservaConPasajeros } from '../../../types/reservaDetalle';
import { useCalendarioBlocks } from './useCalendarioBlocks';
import { useCalendarioModal } from './useCalendarioModal';
import { useCalendarioEvents } from './useCalendarioEvents';

export * from './types';

const locales = { es };
export const localizer = dateFnsLocalizer({
  format,
  startOfWeek: (date: Date, options?: Parameters<typeof startOfWeek>[1]) =>
    startOfWeek(date, { ...(options as Record<string, unknown>), weekStartsOn: 1, locale: es } as Parameters<typeof startOfWeek>[1]),
  getDay,
  locales,
});

// Sobrescribir visibleDays y range con date-fns addDays para prevenir el desfase horario (DST).
// En TZ America/Santiago el cambio DST de septiembre hace que date-arithmetic duplique
// el sábado (add 24h no cruza medianoche). visibleDays ya estaba parcheado, pero
// MonthView.renderHeaders usa localizer.range(first,last,'day') que seguía con
// date-arithmetic y generaba 8 headers (sáb duplicado). Se parchea también range.
localizer.visibleDays = (date: Date) => {
  const first = startOfWeek(startOfMonth(date), { weekStartsOn: 1, locale: es });
  const last = endOfWeek(endOfMonth(date), { weekStartsOn: 1, locale: es });
  const days: Date[] = [];
  let current = first;
  while (current <= last || isSameDay(current, last)) {
    days.push(current);
    current = addDays(current, 1);
  }
  return days;
};

const _origRange = localizer.range.bind(localizer) as typeof localizer.range;
(localizer as unknown as { range: typeof _origRange }).range = (
  start: Date,
  end: Date,
  unit?: string,
) => {
  if ((unit ?? 'day') === 'day') {
    const days: Date[] = [];
    let cur = new Date(start);
    const endClamped = new Date(end);
    while (cur <= endClamped || isSameDay(cur, endClamped)) {
      days.push(new Date(cur));
      cur = addDays(cur, 1);
    }
    return days;
  }
  return _origRange(start, end, unit as never);
};

export function useCalendarioController() {
  const queryClient = useQueryClient();
  const isMobile = useMediaQuery('(max-width: 640px)');
  const [view, setView] = useState<string>(Views.MONTH);
  const [date, setDate] = useState<Date>(new Date());

  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isPagosModalOpen, setIsPagosModalOpen] = useState(false);
  const [selectedReservaPagos, setSelectedReservaPagos] = useState<ReservaConPasajeros | null>(null);
  const [mostrarAgendas, setMostrarAgendas] = useState(false);

  // Queries
  const configuracionesQuery = useQuery<ConfiguracionBloque[]>({
    queryKey: ['configuracion-bloques'],
    queryFn: () => api.configuracion.listar() as unknown as Promise<ConfiguracionBloque[]>,
  });
  const configuraciones = configuracionesQuery.data ?? [];

  const resDesdeISO = new Date(Date.UTC(date.getFullYear(), date.getMonth(), 1)).toISOString().slice(0, 10);
  const resHastaISO = new Date(Date.UTC(date.getFullYear(), date.getMonth() + 1, 0)).toISOString().slice(0, 10);
  const resolucionQuery = useQuery<Record<string, ResolucionDiaDTO>>({
    queryKey: ['configuracion-resolucion', resDesdeISO, resHastaISO],
    queryFn: () => api.configuracion.resolver({ desde: resDesdeISO, hasta: resHastaISO }),
    retry: false,
    staleTime: 60_000,
  });

  const desde = new Date(date.getFullYear(), date.getMonth(), 1);
  const hasta = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
  const desdeISO = desde.toISOString();
  const hastaISO = hasta.toISOString();

  // Detección de mes histórico cerrado:
  // Si el fin del mes visualizado es anterior al inicio del mes actual (hora local)
  const inicioMesActual = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const esMesHistorico = hasta < inicioMesActual;

  const vuelosQuery = useQuery<Vuelo[]>({
    queryKey: ['vuelos', 'calendario', desdeISO, hastaISO],
    queryFn: async () => (await api.vuelos.listar({ desde: desdeISO, hasta: hastaISO, pageSize: 500, sort: 'fechaHora.asc', campos: 'vista-calendario' })).data as Vuelo[],
    staleTime: esMesHistorico ? Infinity : 30_000,
    gcTime: esMesHistorico ? 1000 * 60 * 60 : 1000 * 60 * 5,
  });
  const vuelos = vuelosQuery.data ?? [];

  const pilotosQuery = useQuery<Piloto[]>({
    queryKey: ['pilotos', 'activos'],
    queryFn: async () => (await api.pilotos.listar({ activo: 'true', pageSize: 500 })).data as unknown as Piloto[],
    staleTime: 60_000,
  });
  const pilotos = pilotosQuery.data ?? [];

  const pasajerosQuery = useQuery<Pasajero[]>({
    queryKey: ['pasajeros'],
    queryFn: async () => (await api.pasajeros.listar({ pageSize: 500 })).data as Pasajero[],
    staleTime: 60_000,
  });
  const pasajeros = pasajerosQuery.data ?? [];

  const reservasQuery = useQuery<ReservaConPasajeros[]>({
    queryKey: ['reservas', 'calendario-activas'],
    queryFn: async () => (await api.reservas.listar({ desde: new Date().toISOString(), pageSize: 200 })).data as ReservaConPasajeros[],
    staleTime: 60_000,
  });
  const reservas = reservasQuery.data ?? [];

  const loading = vuelosQuery.isPending || pilotosQuery.isPending || pasajerosQuery.isPending || reservasQuery.isPending;

  // Sub-hook: Modal de Vuelo / Agendamiento
  const modalController = useCalendarioModal({
    vuelos,
    pilotos,
    pasajeros,
    reservas,
    refetchVuelos: () => vuelosQuery.refetch(),
    refetchReservas: () => reservasQuery.refetch(),
    refetchPasajeros: () => pasajerosQuery.refetch(),
    getDateKey: (d: Date) => dateKeyLocal(d),
    desdeISO,
    hastaISO,
  });

  // Sub-hook: Bloques y Horarios
  const blocksController = useCalendarioBlocks({
    date,
    view,
    fechaFormulario: modalController.formData.fecha,
    horaFormulario: modalController.formData.hora,
    configuraciones,
    resolucionData: resolucionQuery.data,
    resolucionIsSuccess: resolucionQuery.isSuccess,
    resolucionIsPending: resolucionQuery.isPending,
    resolucionIsError: resolucionQuery.isError,
  });

  // Sub-hook: Eventos y Renderizado en Calendario
  const eventsController = useCalendarioEvents({
    view,
    date,
    vuelos,
    pilotos,
    configuraciones,
    mostrarAgendas,
    desde,
    hasta,
    getDateKey: blocksController.getDateKey,
    getActiveConfigForDate: blocksController.getActiveConfigForDate,
    getBlockForDateTime: blocksController.getBlockForDateTime,
    setDate,
    setMostrarAgendas,
    handleEditarVuelo: modalController.handleEditarVuelo,
    setEditingId: modalController.setEditingId,
    setFilterReservaId: modalController.setFilterReservaId,
    setFormData: modalController.setFormData,
    setIsModalOpen: modalController.setIsModalOpen,
  });

  // Sincronización de URL params (?reservaId=...)
  const allDataReady = !!vuelosQuery.data && !!pilotosQuery.data && !!pasajerosQuery.data && !!reservasQuery.data;
  const handledReservaParam = useRef(false);

  /* eslint-disable react-hooks/set-state-in-effect -- hidratación una vez al montar desde URL params ?reservaId; no es derivado calculable en render */
  useEffect(() => {
    if (!allDataReady || handledReservaParam.current) return;
    handledReservaParam.current = true;

    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const reservaIdParam = urlParams.get('reservaId');
      if (reservaIdParam && reservas) {
        const resId = Number(reservaIdParam);
        modalController.setFilterReservaId(resId);
        const reserva = reservas.find((r: ReservaConPasajeros) => r.id === resId);
        const groupPassengers = pasajeros.filter((p: Pasajero) => p.reservaId === resId);
        const existingFlight = vuelos.find((v: Vuelo) => groupPassengers.some((gp: Pasajero) => gp.id === v.pasajeroId));

        let defaultFecha = '';
        let defaultHora = '';

        if (existingFlight) {
          const start = new Date(existingFlight.fechaHora);
          defaultFecha = dateKeyLocal(start);
          const localDate = new Date(start.getTime() - start.getTimezoneOffset() * 60000);
          defaultHora = localDate.toISOString().split('T')[1].substring(0, 5);
          setDate(start);
        } else if (reserva && reserva.fechaAgenda) {
          const fr = reserva.fechaAgenda as string | Date;
          defaultFecha = typeof fr === 'string' ? fr.split('T')[0] : new Date(fr).toISOString().split('T')[0];
          setDate(typeof fr === 'string' ? new Date(fr) : new Date(fr));
        }

        modalController.setEditingId(null);
        modalController.setFormData({ pilotoId: '', pasajeroId: '', fecha: defaultFecha, hora: defaultHora, valorPactado: '' });

        const autoSelections: Record<number, string> = {};
        groupPassengers.forEach((p: Pasajero) => {
          const pFlight = vuelos.find((v: Vuelo) => v.pasajeroId === p.id);
          if (pFlight) {
            autoSelections[p.id] = String(pFlight.pilotoId);
          }
        });
        modalController.setGroupPilotSelections(autoSelections);
        modalController.setIsModalOpen(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run-once al montar cuando todos los queries están listos; deps adicionales causarían reapertura del modal al cambiar datos
  }, [allDataReady]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const openConfigBloques = () => {
    setIsConfigModalOpen(true);
  };

  const handleOpenPagos = (reserva: ReservaConPasajeros) => {
    modalController.setIsModalOpen(false);
    setSelectedReservaPagos(reserva);
    setIsPagosModalOpen(true);
  };

  const handlePagosSuccess = () => {
    reservasQuery.refetch();
    vuelosQuery.refetch();
    pasajerosQuery.refetch();
    if (desdeISO && hastaISO) {
      queryClient.invalidateQueries({
        queryKey: ['vuelos', 'calendario', desdeISO, hastaISO],
        exact: true,
      });
    } else {
      queryClient.invalidateQueries({ queryKey: ['vuelos', 'calendario'] });
    }
    queryClient.invalidateQueries({ queryKey: ['reservas'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  return {
    isMobile,
    vuelos,
    eventos: eventsController.eventos,
    view,
    setView,
    date,
    setDate,
    isModalOpen: modalController.isModalOpen,
    setIsModalOpen: modalController.setIsModalOpen,
    isSyncModalOpen,
    setIsSyncModalOpen,
    isConfigModalOpen,
    setIsConfigModalOpen,
    editingId: modalController.editingId,
    editingVersion: modalController.editingVersion,
    setEditingVersion: modalController.setEditingVersion,
    editingEstado: modalController.editingEstado,
    setEditingEstado: modalController.setEditingEstado,
    mostrarAgendas,
    setMostrarAgendas,
    pilotos,
    pasajeros,
    reservas,
    formData: modalController.formData,
    setFormData: modalController.setFormData,
    filterReservaId: modalController.filterReservaId,
    setFilterReservaId: modalController.setFilterReservaId,
    groupPilotSelections: modalController.groupPilotSelections,
    setGroupPilotSelections: modalController.setGroupPilotSelections,
    loading,
    vuelosQueryRefetch: () => vuelosQuery.refetch(),
    getActiveConfigForDate: blocksController.getActiveConfigForDate,
    getDateKey: blocksController.getDateKey,
    calendarMin: blocksController.calendarMin,
    calendarMax: blocksController.calendarMax,
    calendarStep: blocksController.calendarStep,
    isBloqueado: blocksController.isBloqueado,
    availableBlocks: blocksController.availableBlocks,
    selectedTimeIsCustom: blocksController.selectedTimeIsCustom,
    handleAsignacionAutomatica: modalController.handleAsignacionAutomatica,
    isPilotoDisabled: modalController.isPilotoDisabled,
    handleAgendarDesdeAgenda: modalController.handleAgendarDesdeAgenda,
    handleEditarVuelo: modalController.handleEditarVuelo,
    openConfigBloques,
    handleSubmit: modalController.handleSubmit,
    eventStyleGetter: eventsController.eventStyleGetter,
    handleSelectEvent: eventsController.handleSelectEvent,
    handleSelectSlot: eventsController.handleSelectSlot,
    cancelarVuelo: modalController.cancelarVuelo,
    isPagosModalOpen,
    setIsPagosModalOpen,
    selectedReservaPagos,
    setSelectedReservaPagos,
    handleOpenPagos,
    handlePagosSuccess,
    handleCompletarVueloReserva: modalController.handleCompletarVueloReserva,
  };
}
