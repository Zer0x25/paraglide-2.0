import React from 'react';
import { Layers, Plane, Shield, ShieldAlert } from 'lucide-react';
import type { EquiposStats } from '../utils/equiposStats.util';

interface EquiposStatsCardsProps {
  stats: EquiposStats;
}

export function EquiposStatsCards({ stats }: EquiposStatsCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center space-x-4">
        <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
          <Layers size={24} />
        </div>
        <div>
          <span className="text-xs font-bold text-slate-400 uppercase">Total Equipos</span>
          <p className="text-2xl font-black text-slate-900 dark:text-white">{stats.total}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center space-x-4">
        <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
          <Plane size={24} />
        </div>
        <div>
          <span className="text-xs font-bold text-slate-400 uppercase">Velas Operativas</span>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{stats.velas}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center space-x-4">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
          <Shield size={24} />
        </div>
        <div>
          <span className="text-xs font-bold text-slate-400 uppercase">Paracaídas Activos</span>
          <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{stats.paracaidas}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center space-x-4">
        <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 flex items-center justify-center font-bold">
          <ShieldAlert size={24} />
        </div>
        <div>
          <span className="text-xs font-bold text-slate-400 uppercase">Alertas / Revisión</span>
          <p className="text-2xl font-black text-red-600 dark:text-red-400">{stats.alertas}</p>
        </div>
      </div>
    </div>
  );
}
