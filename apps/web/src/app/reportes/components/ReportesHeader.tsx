"use client";

import { FileText } from 'lucide-react';

interface ReportesHeaderProps {
  activeTab: 'MANIFIESTO' | 'LIQUIDACIONES';
  onTabChange: (tab: 'MANIFIESTO' | 'LIQUIDACIONES') => void;
}

export function ReportesHeader({ activeTab, onTabChange }: ReportesHeaderProps) {
  return (
    <div className="print:hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/40 dark:bg-slate-900/40 p-5 sm:p-6 rounded-3xl border border-white/60 dark:border-slate-800 backdrop-blur-xl shadow-sm">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
          <FileText className="text-blue-600 dark:text-blue-400 shrink-0" size={28} />
          <span>Manifiestos & Reportes</span>
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1">
          Hojas de despegue para control operacional y liquidaciones mensuales de pilotos
        </p>
      </div>

      {/* Pestañas Principales */}
      <div className="flex w-full sm:w-auto bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-x-auto">
        <button
          onClick={() => onTabChange('MANIFIESTO')}
          className={`flex-1 whitespace-nowrap px-2 sm:px-4 py-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all ${
            activeTab === 'MANIFIESTO'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Manifiesto de Vuelo
        </button>
        <button
          onClick={() => onTabChange('LIQUIDACIONES')}
          className={`flex-1 whitespace-nowrap px-2 sm:px-4 py-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all ${
            activeTab === 'LIQUIDACIONES'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Liquidación de Pilotos
        </button>
      </div>
    </div>
  );
}
