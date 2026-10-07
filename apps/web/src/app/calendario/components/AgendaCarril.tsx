import React from 'react';
import { agruparVuelosPorReserva, type GrupoCarril, type VueloVista } from '../agendas.util';
import { AgendaTarjetaVuelo } from './AgendaTarjetaVuelo';

export interface AgendaCarrilProps {
  grupo: GrupoCarril;
  onEditar?: (vuelo: VueloVista) => void;
}

export const AgendaCarril: React.FC<AgendaCarrilProps> = ({ grupo, onEditar }) => {
  const porReserva = agruparVuelosPorReserva(grupo.vuelos);
  const multipleReservas = porReserva.size > 1;

  return (
    <div className="min-w-44 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-2 space-y-2">
      <div className="flex items-center justify-between gap-1 px-0.5">
        <span className="truncate text-xs font-bold text-slate-900 dark:text-white">{grupo.nombre}</span>
        <span className="shrink-0 rounded-full bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300">
          {grupo.vuelos.length}
        </span>
      </div>
      {!multipleReservas ? (
        Array.from(porReserva.values())[0]?.map((v) => (
          <AgendaTarjetaVuelo key={v.id} vuelo={v} onEditar={onEditar} />
        ))
      ) : (
        <div className="space-y-2">
          {Array.from(porReserva.entries()).map(([reservaKey, vuelos]) => (
            <div
              key={reservaKey}
              className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-1.5 py-1.5 space-y-1.5 shadow-sm"
            >
              <div className="flex items-center gap-1.5 px-1">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500 dark:bg-sky-400" aria-hidden />
                <span className="truncate text-[10px] font-bold tracking-wide text-slate-500 dark:text-slate-400">
                  Reserva #{reservaKey.startsWith('vuelo-') ? '—' : reservaKey}
                </span>
                <span className="shrink-0 rounded-full bg-slate-100 dark:bg-slate-800 px-1.5 py-0 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                  {vuelos.length}
                </span>
              </div>
              {vuelos.map((v) => (
                <AgendaTarjetaVuelo key={v.id} vuelo={v} onEditar={onEditar} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
