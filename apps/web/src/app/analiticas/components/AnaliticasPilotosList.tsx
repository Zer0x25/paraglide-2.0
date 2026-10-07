import React from 'react';
import { Clock } from 'lucide-react';
import { formatCLP } from '@/utils/format';
import { Skeleton } from '@/components/ui';
import type { PilotoRendimiento } from '@parapente/shared';

export interface AnaliticasPilotosListProps {
  pilotosTop: PilotoRendimiento[] | undefined;
  isLoading: boolean;
}

export const AnaliticasPilotosList: React.FC<AnaliticasPilotosListProps> = ({
  pilotosTop,
  isLoading,
}) => {
  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center">
          <Clock size={20} className="mr-2 text-slate-400" /> Rendimiento por Piloto
        </h2>
        <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="p-3.5 bg-slate-50/70 dark:bg-slate-800/60 rounded-2xl flex justify-between items-center"
              >
                <div className="flex items-center space-x-3">
                  <Skeleton className="w-9 h-9 rounded-xl" />
                  <div className="space-y-1.5">
                    <Skeleton className="w-24 h-4 rounded" />
                    <Skeleton className="w-16 h-3 rounded" />
                  </div>
                </div>
                <Skeleton className="w-16 h-5 rounded" />
              </div>
            ))
          ) : (
            <>
              {(pilotosTop || []).map((p) => (
                <div
                  key={p.id ?? p.nombre}
                  className="flex justify-between items-center p-3.5 bg-slate-50/70 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-blue-500/30 transition-all"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center text-sm">
                      {p.nombre.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white text-sm">{p.nombre}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {p.vuelos} vuelos realizados
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                      {formatCLP(p.comisiones)}
                    </p>
                    <p className="text-[11px] text-slate-400">comisión</p>
                  </div>
                </div>
              ))}
              {(!pilotosTop || pilotosTop.length === 0) && (
                <div className="p-8 text-center text-slate-400 text-sm">
                  No hay registros de vuelos para este periodo.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
