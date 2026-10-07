import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import type { DemandaDia } from '@parapente/shared';
import { Skeleton } from '@/components/ui';

export interface AnaliticasDemandaChartProps {
  demandaMensual: DemandaDia[] | undefined;
  isLoading: boolean;
  isDark: boolean;
}

export const AnaliticasDemandaChart: React.FC<AnaliticasDemandaChartProps> = ({
  demandaMensual,
  isLoading,
  isDark,
}) => {
  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-slate-100 dark:border-slate-800">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Demanda Diaria de Vuelos</h2>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-slate-500">
          <span className="flex items-center">
            <span className="w-3 h-3 rounded-full bg-blue-500 mr-1.5" /> Agendados
          </span>
          <span className="flex items-center">
            <span className="w-3 h-3 rounded-full bg-emerald-500 mr-1.5" /> Completados
          </span>
          <span className="flex items-center">
            <span className="w-3 h-3 rounded-full bg-red-500 mr-1.5" /> Cancelados
          </span>
        </div>
      </div>
      <div className="h-80 w-full min-h-[320px]">
        {isLoading ? (
          <Skeleton className="h-full w-full rounded-2xl flex items-center justify-center text-slate-400 text-sm font-medium">
            Cargando datos de demanda...
          </Skeleton>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minHeight={320}>
            <BarChart
              data={demandaMensual || []}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={isDark ? '#334155' : '#e2e8f0'}
                vertical={false}
                opacity={0.5}
              />
              <XAxis
                dataKey="dia"
                tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' }}
                axisLine={false}
                tickLine={false}
              />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: isDark ? '#0f172a' : '#ffffff',
                  borderColor: isDark ? '#334155' : '#e2e8f0',
                  borderRadius: '16px',
                  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                }}
                itemStyle={{ color: isDark ? '#f8fafc' : '#0f172a' }}
              />
              <Bar dataKey="agendados" name="Agendados" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
              <Bar dataKey="completados" name="Completados" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
              <Bar dataKey="cancelados" name="Cancelados" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
