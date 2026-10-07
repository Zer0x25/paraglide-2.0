import React from 'react';
import { addDays, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const btnNav =
  'inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold rounded-lg transition-all bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed';
const btnHoy =
  'px-3 py-2 text-xs font-semibold rounded-lg transition-all bg-blue-600 text-white shadow-sm ring-1 ring-blue-500 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed';

export interface AgendaNavHeaderProps {
  fecha: Date;
  dateKey: string;
  hoyKey: string;
  onNavigate?: (nuevaFecha: Date) => void;
}

export const AgendaNavHeader: React.FC<AgendaNavHeaderProps> = ({
  fecha,
  dateKey,
  hoyKey,
  onNavigate,
}) => {
  const titulo = format(fecha, "EEEE d 'de' MMMM", { locale: es });
  const tituloCapitalizado = titulo.charAt(0).toUpperCase() + titulo.slice(1);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
      <div className="flex items-center justify-center gap-1.5 w-full sm:w-auto">
        <button
          type="button"
          className={btnNav}
          onClick={() => onNavigate?.(addDays(fecha, -1))}
        >
          <ChevronLeft size={14} />
          Ant
        </button>
        <button
          type="button"
          className={btnHoy}
          disabled={dateKey === hoyKey}
          onClick={() => onNavigate?.(new Date())}
        >
          Hoy
        </button>
        <button
          type="button"
          className={btnNav}
          onClick={() => onNavigate?.(addDays(fecha, 1))}
        >
          Sig
          <ChevronRight size={14} />
        </button>
      </div>
      <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white text-center sm:text-right w-full sm:w-auto">
        {tituloCapitalizado}
      </h2>
    </div>
  );
};
