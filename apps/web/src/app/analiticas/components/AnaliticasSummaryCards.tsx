import React from 'react';
import { DollarSign, UserCheck, Receipt, TrendingUp, ArrowUpRight } from 'lucide-react';
import { formatCLP } from '@/utils/format';
import { Skeleton } from '@/components/ui';
import type { MetricasFinancierasDTO } from '@parapente/shared';

export interface AnaliticasSummaryCardsProps {
  metrics: MetricasFinancierasDTO | undefined;
  isLoading: boolean;
}

export const AnaliticasSummaryCards: React.FC<AnaliticasSummaryCardsProps> = ({
  metrics,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 space-y-4 shadow-[0_8px_30px_rgb(0,0,0,0.03)]"
          >
            <div className="flex justify-between items-center">
              <Skeleton className="w-11 h-11 rounded-2xl" />
              <Skeleton className="w-16 h-5 rounded-full" />
            </div>
            <Skeleton className="w-24 h-4 rounded" />
            <Skeleton className="w-32 h-8 rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  const isMargenPositivo = (metrics?.pagoEscuela || 0) >= 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      {/* Ingresos Totales */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-slate-100 dark:border-slate-800 flex flex-col relative overflow-hidden group">
        <div className="flex items-center justify-between mb-3 z-10">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-2xl">
            <TrendingUp size={22} />
          </div>
          <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-2.5 py-1 rounded-full flex items-center">
            {metrics?.totalCompletados || 0} vuelos
          </span>
        </div>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Ingresos Totales</p>
        <h3 className="text-3xl font-black text-slate-900 dark:text-white mt-1 z-10">
          {formatCLP(metrics?.ingresosTotales || 0)}
        </h3>
      </div>

      {/* Pagos a Pilotos */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-slate-100 dark:border-slate-800 flex flex-col relative overflow-hidden group">
        <div className="flex items-center justify-between mb-3 z-10">
          <div className="p-3 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-2xl">
            <UserCheck size={22} />
          </div>
          <span className="text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-950 px-2.5 py-1 rounded-full">
            Comisiones
          </span>
        </div>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Pagos a Pilotos</p>
        <h3 className="text-3xl font-black text-slate-900 dark:text-white mt-1 z-10">
          {formatCLP(metrics?.pagosPilotos || 0)}
        </h3>
      </div>

      {/* Gastos Operativos */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-slate-100 dark:border-slate-800 flex flex-col relative overflow-hidden group">
        <div className="flex items-center justify-between mb-3 z-10">
          <div className="p-3 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 rounded-2xl">
            <Receipt size={22} />
          </div>
          <span className="text-xs font-bold text-red-600 bg-red-50 dark:bg-red-950 px-2.5 py-1 rounded-full">
            {metrics?.gastosPorCategoria?.length || 0} categorías
          </span>
        </div>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Gastos Operativos</p>
        <h3 className="text-3xl font-black text-red-600 dark:text-red-400 mt-1 z-10">
          {formatCLP(metrics?.gastosOperativos || 0)}
        </h3>
      </div>

      {/* Pago Escuela / Margen Neto */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-slate-100 dark:border-slate-800 flex flex-col relative overflow-hidden group">
        <div className="flex items-center justify-between mb-3 z-10">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-2xl">
            <DollarSign size={22} />
          </div>
          <span className="text-xs font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950 px-2.5 py-1 rounded-full flex items-center">
            <ArrowUpRight size={14} className="mr-0.5" />
            {metrics?.margenNetoPorcentaje || 0}% margen
          </span>
        </div>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Margen Neto Escuela</p>
        <h3
          className={`text-3xl font-black mt-1 z-10 ${
            isMargenPositivo ? 'text-indigo-600 dark:text-indigo-400' : 'text-red-600'
          }`}
        >
          {formatCLP(metrics?.pagoEscuela || 0)}
        </h3>
      </div>
    </div>
  );
};
