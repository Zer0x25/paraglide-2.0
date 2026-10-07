import React from 'react';
import { Plus } from 'lucide-react';

export interface AnaliticasHeaderProps {
  selectedMonth: number;
  setSelectedMonth: (month: number) => void;
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  currentMonthName: string;
  monthsList: readonly string[];
  yearsList: readonly number[];
  isLoading: boolean;
  isFetching: boolean;
  onRefetch: () => void;
  onOpenGastoModal: () => void;
}

export const AnaliticasHeader: React.FC<AnaliticasHeaderProps> = ({
  selectedMonth,
  setSelectedMonth,
  selectedYear,
  setSelectedYear,
  currentMonthName,
  monthsList,
  yearsList,
  isLoading,
  isFetching,
  onRefetch,
  onOpenGastoModal,
}) => {
  return (
    <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 bg-white/40 dark:bg-slate-900/40 p-5 md:p-6 rounded-3xl border border-white/60 dark:border-slate-800 backdrop-blur-xl shadow-sm">
      <div>
        <h1 className="text-2xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
          Panel de Analíticas y Finanzas
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1 capitalize font-medium text-sm md:text-base">
          Desempeño general — {currentMonthName}
        </p>
      </div>
      <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 w-full md:w-auto">
        <select
          id="analiticas-select-mes"
          name="selectedMonth"
          aria-label="Seleccionar mes para reporte de analíticas"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(Number(e.target.value))}
          className="w-full sm:w-auto border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
        >
          {monthsList.map((m, idx) => (
            <option key={idx} value={idx}>
              {m}
            </option>
          ))}
        </select>
        <select
          id="analiticas-select-ano"
          name="selectedYear"
          aria-label="Seleccionar año para reporte de analíticas"
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          className="w-full sm:w-auto border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
        >
          {yearsList.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <button
          onClick={onRefetch}
          disabled={isLoading || isFetching}
          className="w-full sm:w-auto px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition font-medium text-sm disabled:opacity-50"
        >
          {isLoading || isFetching ? 'Cargando...' : 'Actualizar'}
        </button>
        <button
          onClick={onOpenGastoModal}
          className="w-full sm:w-auto px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-md transition flex items-center justify-center font-semibold text-sm"
        >
          <Plus size={18} className="mr-1.5" /> Registrar Gasto
        </button>
      </div>
    </div>
  );
};
