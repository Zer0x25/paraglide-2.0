import React from 'react';
import { CalendarX, Lock } from 'lucide-react';

export interface AgendaEstadoVacioProps {
  tipo: 'sin-bloques' | 'bloqueado';
}

export const AgendaEstadoVacio: React.FC<AgendaEstadoVacioProps> = ({ tipo }) => {
  if (tipo === 'sin-bloques') {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-surface-raised px-6 py-10 text-center">
        <CalendarX size={32} className="text-slate-400 dark:text-slate-500" />
        <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
          Sin bloques configurados
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Configura horarios para este día desde «Configurar Bloques».
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-surface-raised px-6 py-10 text-center">
      <Lock size={32} className="text-slate-400 dark:text-slate-500" />
      <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Día bloqueado</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        No se programaron vuelos para este día.
      </p>
    </div>
  );
};
