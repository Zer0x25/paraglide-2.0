"use client";

import { Wind, RefreshCw, Radio } from 'lucide-react';

interface MeteoHeaderProps {
  loading: boolean;
  refetch: () => void;
  refrescarOpenMeteo: () => void;
  refrescando: boolean;
  enCooldown: boolean;
  labelCooldown: string;
}

export function MeteoHeader({
  loading,
  refetch,
  refrescarOpenMeteo,
  refrescando,
  enCooldown,
  labelCooldown,
}: MeteoHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/40 dark:bg-slate-900/40 p-5 sm:p-6 rounded-3xl border border-white/60 dark:border-slate-800 backdrop-blur-xl shadow-sm">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
          <Wind className="text-cyan-500 shrink-0" size={28} />
          <span>Estación Meteorológica & Estado de Pista</span>
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1">
          Monitoreo en tiempo real de viento, rachas, visibilidad y control operacional de despegue
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2.5 w-full sm:w-auto">
        <button
          onClick={() => refetch()}
          className="w-full sm:w-auto flex items-center justify-center space-x-2 py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl text-xs font-bold transition"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Actualizar Datos</span>
        </button>

        <button
          type="button"
          onClick={() => refrescarOpenMeteo()}
          disabled={enCooldown}
          className="w-full sm:w-auto flex items-center justify-center space-x-2 py-2.5 px-4 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl text-xs font-bold transition"
        >
          <Radio size={14} className={refrescando ? 'animate-spin' : ''} />
          <span>
            {refrescando
              ? 'Refrescando...'
              : enCooldown
              ? `Espera ${labelCooldown}`
              : 'Refrescar Pronóstico'}
          </span>
        </button>
      </div>
    </div>
  );
}
