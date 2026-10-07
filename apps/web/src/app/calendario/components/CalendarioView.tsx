"use client";

import type React from 'react';
import { Calendar, type CalendarProps, type EventProps, type View } from 'react-big-calendar';
import VistaAgendas from '../VistaAgendas';
import { FichaMensual } from './FichaMensual';
import { type useCalendarioController, localizer } from '../hooks/useCalendarioController';
import type { CalendarEvent } from '../hooks/types';
import type { VueloVista, PilotoDia } from '../agendas.util';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const RbcCalendar = Calendar as unknown as React.ComponentType<CalendarProps<CalendarEvent, object>>;
const FichaMensualRbc = FichaMensual as unknown as React.ComponentType<EventProps<CalendarEvent>>;

export interface CalendarioViewProps {
  controller: ReturnType<typeof useCalendarioController>;
}

export function CalendarioView({ controller: c }: CalendarioViewProps) {
  return (
    <div className="bg-white dark:bg-slate-900 p-3 sm:p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col min-h-[460px] sm:min-h-[680px] overflow-x-auto text-slate-800 dark:text-slate-100">
      {c.loading ? (
        <p className="text-slate-500 p-4">Cargando calendario...</p>
      ) : c.mostrarAgendas ? (
        <VistaAgendas
          fecha={c.date}
          vuelos={c.vuelos as unknown as VueloVista[]}
          pilotos={c.pilotos as unknown as PilotoDia[]}
          configDia={c.getActiveConfigForDate(c.getDateKey(c.date))}
          onNavigate={(d) => c.setDate(d)}
          onAgendar={c.handleAgendarDesdeAgenda}
          onEditar={c.handleEditarVuelo as unknown as (v: VueloVista) => void}
        />
      ) : (
        <RbcCalendar
          localizer={localizer}
          culture="es"
          events={c.eventos}
          startAccessor="start"
          endAccessor="end"
          view={c.view as View}
          onView={(newView: View) => c.setView(newView as string)}
          date={c.date}
          onNavigate={(newDate: Date) => c.setDate(newDate)}
          views={['month']}
          min={c.calendarMin}
          max={c.calendarMax}
          step={c.calendarStep || 60}
          timeslots={1}
          selectable={true}
          onSelectSlot={c.handleSelectSlot}
          onSelectEvent={c.handleSelectEvent}
          onDrillDown={(drillDate: Date) => {
            c.setDate(drillDate);
            c.setMostrarAgendas(true);
          }}
          components={{ event: FichaMensualRbc }}
          eventPropGetter={c.eventStyleGetter as unknown as CalendarProps<CalendarEvent, object>['eventPropGetter']}
          style={{ height: c.isMobile ? '680px' : '880px', minWidth: c.isMobile ? undefined : '600px' }}
          messages={{
            next: "Sig",
            previous: "Ant",
            today: "Hoy",
            month: "Mes",
            week: "Semana",
            day: "Día",
            agenda: "Agenda",
            date: "Fecha",
            time: "Hora",
            event: "Evento"
          }}
        />
      )}
    </div>
  );
}

export const CalendarioGrid = CalendarioView;
