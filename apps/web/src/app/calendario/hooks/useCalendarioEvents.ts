import type React from 'react';
import { useMemo } from 'react';
import { formatCLP } from '../../../utils/format';
import type {
  Vuelo,
  Piloto,
  CalendarEvent,
  CalendarSummaryResource,
  ConfiguracionBloque,
  FormDataVuelo,
  HorarioBloque,
} from './types';

type SummaryEvent = CalendarEvent & { isSummary: true; resource: CalendarSummaryResource };
type VueloEvent = CalendarEvent & { isSummary?: false; resource: Vuelo };

export function useCalendarioEvents({
  view,
  date: _date,
  vuelos,
  pilotos,
  configuraciones: _configuraciones,
  mostrarAgendas,
  desde,
  hasta,
  getDateKey,
  getActiveConfigForDate,
  getBlockForDateTime,
  setDate,
  setMostrarAgendas,
  handleEditarVuelo,
  setEditingId,
  setFilterReservaId,
  setFormData,
  setIsModalOpen,
}: {
  view: string;
  date: Date;
  vuelos: Vuelo[];
  pilotos: Piloto[];
  configuraciones: ConfiguracionBloque[];
  mostrarAgendas: boolean;
  desde: Date;
  hasta: Date;
  getDateKey: (d: Date) => string;
  getActiveConfigForDate: (dateString: string) => ConfiguracionBloque | null;
  getBlockForDateTime: (start: Date) => HorarioBloque | undefined;
  setDate: (d: Date) => void;
  setMostrarAgendas: (val: boolean) => void;
  handleEditarVuelo: (vuelo: Vuelo) => void;
  setEditingId: (id: number | null) => void;
  setFilterReservaId: (id: number | null) => void;
  setFormData: React.Dispatch<React.SetStateAction<FormDataVuelo>>;
  setIsModalOpen: (val: boolean) => void;
}) {
  void _date;
  void _configuraciones;
  const eventos = useMemo<CalendarEvent[]>(() => {
    if (mostrarAgendas) {
      return [];
    }
    if (view === 'month') {
      const summaryEvents: SummaryEvent[] = [];
      const d = new Date(desde);
      while (d <= hasta) {
        const dateKey = getDateKey(d);
        const todayKey = getDateKey(new Date());

        if (dateKey < todayKey) {
          const vuelosDelDia = vuelos.filter((v) => v.fechaHora.startsWith(dateKey));
          if (vuelosDelDia.length > 0) {
            const vuelosCompletados = vuelosDelDia.filter((v) => v.estado === 'COMPLETADO' || v.reserva?.estado === 'COMPLETADA').length;
            summaryEvents.push({
              title: `${vuelosCompletados}/${vuelosDelDia.length} completados`,
              start: new Date(`${dateKey}T09:00:00`),
              end: new Date(`${dateKey}T10:00:00`),
              isSummary: true,
              resource: { date: new Date(d), isPastSummary: true, completados: vuelosCompletados, total: vuelosDelDia.length },
            });
          }
        } else {
          const config = getActiveConfigForDate(dateKey);
          if (!config) {
            // Sin bloques
          } else if (config.bloqueado) {
            summaryEvents.push({
              title: 'Bloqueado',
              start: new Date(`${dateKey}T09:00:00`),
              end: new Date(`${dateKey}T10:00:00`),
              isSummary: true,
              resource: { date: new Date(d), isBlockSummary: false, isBloqueado: true, isPastSummary: false },
            });
          } else if (config.horarios) {
            const availablePilots = pilotos.filter((p) => {
              if (!p.activo) return false;
              const hasException = (p.excepciones || []).some((ex: { fecha: string }) => ex.fecha.startsWith(dateKey));
              return p.disponibilidadTotal ? !hasException : hasException;
            });

            config.horarios.forEach((block: HorarioBloque) => {
              const fechaHoraStr = `${dateKey}T${block.horaInicio}:00`;
              const fechaHoraTime = new Date(fechaHoraStr).getTime();
              const reservationsInBlock = vuelos.filter((v) => new Date(v.fechaHora).getTime() === fechaHoraTime);
              const availability = Math.max(0, availablePilots.length - reservationsInBlock.length);
              const start = new Date(fechaHoraStr);
              const end = new Date(`${dateKey}T${block.horaFin}:00`);
              summaryEvents.push({
                title: `${block.horaInicio} – ${block.horaFin} ${reservationsInBlock.length}/${availablePilots.length}`,
                start,
                end,
                isSummary: true,
                resource: {
                  date: new Date(d),
                  isBlockSummary: true,
                  isPastSummary: false,
                  isBloqueado: false,
                  block,
                  reservas: reservationsInBlock.length,
                  disponibles: availability,
                  totalPilotos: availablePilots.length,
                },
              });
            });
          }
        }

        d.setDate(d.getDate() + 1);
      }
      return summaryEvents;
    } else {
      const calendarEvents: VueloEvent[] = vuelos.map((vuelo) => {
        const start = new Date(vuelo.fechaHora);
        const matchingBlock = getBlockForDateTime(start);
        const end = matchingBlock
          ? new Date(`${getDateKey(start)}T${matchingBlock.horaFin}:00`)
          : new Date(start.getTime() + 60 * 60 * 1000);
        return {
          title: `${vuelo.pasajero?.nombre} (Piloto: ${vuelo.piloto?.nombre}) - ${formatCLP(vuelo.valorPactado)}`,
          start,
          end,
          resource: vuelo,
        };
      });
      return calendarEvents;
    }
  }, [view, vuelos, pilotos, mostrarAgendas, desde, hasta, getDateKey, getActiveConfigForDate, getBlockForDateTime]);

  const eventStyleGetter = (event: CalendarEvent, start: Date): { style?: React.CSSProperties; className?: string } => {
    if (event.isSummary) {
      return {
        style: {
          backgroundColor: 'transparent',
          border: 'none',
          boxShadow: 'none',
          padding: '1px 2px',
          borderRadius: '8px',
          display: 'block',
          whiteSpace: 'normal',
          wordBreak: 'break-word' as const,
          height: 'auto',
          minHeight: 'max-content',
        },
      };
    }

    const resVuelo = event.resource as Vuelo;
    const estado =
      resVuelo.reserva?.estado === 'COMPLETADA' || resVuelo.estado === 'COMPLETADO'
        ? 'COMPLETADO'
        : resVuelo.reserva?.estado === 'CANCELADA' || resVuelo.estado === 'CANCELADO'
        ? 'CANCELADO'
        : resVuelo.estado || 'AGENDADO';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eventDate = new Date(start);
    eventDate.setHours(0, 0, 0, 0);

    let backgroundColor = '#3b82f6';
    let borderColor = '#2563eb';
    const textColor = 'white';

    if (estado === 'COMPLETADO') {
      backgroundColor = '#10b981';
      borderColor = '#059669';
    } else if (estado === 'CANCELADO') {
      backgroundColor = '#ef4444';
      borderColor = '#dc2626';
    } else if (eventDate.getTime() < today.getTime()) {
      backgroundColor = '#64748b';
      borderColor = '#475569';
    }

    return {
      style: {
        backgroundColor,
        borderRadius: '8px',
        opacity: 0.95,
        color: textColor,
        border: `1px solid ${borderColor}`,
        display: 'block',
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
        fontWeight: '500' as const,
        padding: '2px 6px',
        whiteSpace: 'normal',
        wordBreak: 'break-word' as const,
        height: 'auto',
        minHeight: 'max-content',
      },
    };
  };

  const handleSelectEvent = (event: CalendarEvent) => {
    if (event.isSummary) {
      setDate((event.resource as CalendarSummaryResource & { date: Date }).date);
      setMostrarAgendas(true);
      return;
    }
    handleEditarVuelo(event.resource as Vuelo);
  };

  const handleSelectSlot = ({ start }: { start: Date }) => {
    if (view === 'month') {
      setDate(start);
      setMostrarAgendas(true);
      return;
    }

    const selectedDate = new Date(start);
    const dateKey = getDateKey(selectedDate);
    const horaStr = selectedDate.toTimeString().substring(0, 5);

    setEditingId(null);
    setFilterReservaId(null);
    setFormData({
      pilotoId: '',
      pasajeroId: '',
      fecha: dateKey,
      hora: horaStr === '00:00' ? '' : horaStr,
      valorPactado: '',
    });
    setIsModalOpen(true);
  };

  return {
    eventos,
    eventStyleGetter,
    handleSelectEvent,
    handleSelectSlot,
  };
}
