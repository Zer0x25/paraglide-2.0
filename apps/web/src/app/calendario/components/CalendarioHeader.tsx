"use client";

import { Settings, Radio, LayoutGrid } from 'lucide-react';

interface CalendarioHeaderProps {
  mostrarAgendas: boolean;
  onToggleMostrarAgendas: () => void;
  onOpenConfigModal: () => void;
  onOpenSyncModal: () => void;
}

export function CalendarioHeader({
  mostrarAgendas,
  onToggleMostrarAgendas,
  onOpenConfigModal,
  onOpenSyncModal,
}: CalendarioHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/40 dark:bg-slate-900/40 p-5 sm:p-6 rounded-3xl border border-white/60 dark:border-slate-800 backdrop-blur-xl shadow-sm">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">Calendario de Vuelos</h1>
        <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1">Agenda, edita y sincroniza los vuelos del día</p>
      </div>
      <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
        <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:flex sm:items-center sm:gap-3">
          <button
            type="button"
            onClick={onOpenConfigModal}
            className="flex items-center justify-center space-x-1.5 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-3 sm:px-4 py-2 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition text-xs sm:text-sm font-medium cursor-pointer"
            title="Configurar bloques y horarios"
          >
            <Settings size={16} className="shrink-0 sm:w-[18px] sm:h-[18px]" />
            <span>
              <span className="inline sm:hidden">Configurar</span>
              <span className="hidden sm:inline">Configurar Bloques</span>
            </span>
          </button>
          <button
            type="button"
            onClick={onOpenSyncModal}
            className="flex items-center justify-center space-x-1.5 border border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 px-3 sm:px-4 py-2 rounded-2xl transition text-xs sm:text-sm font-medium shadow-sm cursor-pointer"
            title="Sincronizar con Google Calendar, iPhone (Apple) o Outlook"
          >
            <Radio size={16} className="text-blue-600 dark:text-blue-400 shrink-0 sm:w-[17px] sm:h-[17px]" />
            <span>
              <span className="inline sm:hidden">Sincronizar</span>
              <span className="hidden sm:inline">Sincronizar Calendario</span>
            </span>
          </button>
        </div>
        <button
          type="button"
          onClick={onToggleMostrarAgendas}
          className={`w-full sm:w-auto flex items-center justify-center gap-1.5 border px-4 py-2 rounded-2xl transition text-sm font-medium cursor-pointer ${
            mostrarAgendas
              ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
              : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
          title="Vista de agendas por piloto dentro de cada bloque (solo visualización)"
        >
          <LayoutGrid size={17} className="shrink-0" />
          <span>{mostrarAgendas ? 'Vista Mensual' : 'Vista Agenda'}</span>
        </button>
      </div>
    </div>
  );
}
