"use client";

import { Activity, Wind } from 'lucide-react';

interface HistorialItem {
  id: number;
  estadoPista: string;
  fechaHora: string | Date;
  observaciones?: string | null;
  registradoPor?: string | null;
  velocidadViento?: number | null;
  direccionViento?: string | null;
  temperatura?: number | null;
}

interface MeteoHistorialListProps {
  historial?: HistorialItem[] | null;
}

export function MeteoHistorialList({ historial }: MeteoHistorialListProps) {
  const listHistorial = Array.isArray(historial) ? historial : [];

  return (
    <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
      <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
        <Activity size={16} className="text-blue-600" />
        <span>Historial de Boletines del Día ({listHistorial.length})</span>
      </h3>

      {listHistorial.length === 0 ? (
        <div className="p-8 text-center text-slate-400 bg-slate-50 dark:bg-slate-800/30 rounded-2xl">
          Sin reportes previos registrados hoy.
        </div>
      ) : (
        <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
          {listHistorial.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3"
            >
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span
                    className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md ${
                      item.estadoPista === 'ABIERTA'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : item.estadoPista === 'PRECAUCION'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                    }`}
                  >
                    {item.estadoPista}
                  </span>
                  <span className="text-xs text-slate-400 font-bold">
                    {new Date(item.fechaHora).toLocaleTimeString('es-CL', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    hrs
                  </span>
                </div>

                <p className="text-xs text-slate-800 dark:text-slate-200 font-medium">
                  {item.observaciones || 'Sin observaciones'}
                </p>

                <p className="text-[11px] text-slate-400">
                  Por: <strong>{item.registradoPor || 'Director de Vuelo'}</strong>
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs font-mono font-bold text-slate-700 dark:text-slate-300 shrink-0 bg-white dark:bg-slate-800 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-1">
                  <Wind size={13} className="text-cyan-500" />
                  <span>
                    {item.velocidadViento != null
                      ? Number(item.velocidadViento).toFixed(1)
                      : '—'}{' '}
                    km/h
                  </span>
                </div>
                <div>•</div>
                <div className="uppercase">{item.direccionViento || 'SO'}</div>
                {item.temperatura && (
                  <>
                    <div>•</div>
                    <div>{Number(item.temperatura).toFixed(1)}°C</div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
