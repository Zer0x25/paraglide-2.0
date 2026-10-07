import React from 'react';
import { PieChart as PieIcon } from 'lucide-react';
import { formatCLP } from '@/utils/format';
import { Skeleton } from '@/components/ui';
import type { GastoCategoria } from '@parapente/shared';

export const GASTO_COLORS = [
  '#f43f5e',
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#06b6d4',
  '#ec4899',
  '#64748b',
];

export interface AnaliticasGastosBreakdownProps {
  gastosPorCategoria: GastoCategoria[] | undefined;
  gastosOperativosTotal: number;
  isLoading: boolean;
}

export const AnaliticasGastosBreakdown: React.FC<AnaliticasGastosBreakdownProps> = ({
  gastosPorCategoria,
  gastosOperativosTotal,
  isLoading,
}) => {
  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-slate-100 dark:border-slate-800">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <PieIcon size={20} className="text-red-500" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Desglose de Gastos Operativos
          </h2>
        </div>
        <span className="text-sm font-semibold text-slate-500">
          Total: {formatCLP(gastosOperativosTotal)}
        </span>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="p-4 bg-slate-50/60 dark:bg-slate-800/50 rounded-2xl space-y-2"
            >
              <Skeleton className="w-24 h-4 rounded" />
              <Skeleton className="w-full h-2 rounded-full" />
              <Skeleton className="w-20 h-5 rounded" />
            </div>
          ))}
        </div>
      ) : gastosPorCategoria && gastosPorCategoria.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {gastosPorCategoria.map((g, idx) => (
            <div
              key={g.categoria}
              className="p-4 bg-slate-50/60 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm truncate mr-2">
                  {g.categoria}
                </span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400">
                  {g.porcentaje}%
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden mb-2">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, g.porcentaje)}%`,
                    backgroundColor: GASTO_COLORS[idx % GASTO_COLORS.length],
                  }}
                />
              </div>
              <p className="text-base font-bold text-slate-900 dark:text-white">
                {formatCLP(g.monto)}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-8 text-center text-slate-400 text-sm">
          No se registran gastos operativos en este mes.
        </div>
      )}
    </div>
  );
};
