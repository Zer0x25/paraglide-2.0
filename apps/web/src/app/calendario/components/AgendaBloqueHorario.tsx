import React from 'react';
import { Users } from 'lucide-react';
import {
  agruparVuelosPorPiloto,
  pilotosLibresEnBloque,
  type PilotoDia,
  type VueloVista,
} from '../agendas.util';
import { AgendaCarril } from './AgendaCarril';

export interface AgendaBloqueHorarioProps {
  horario: { horaInicio: string; horaFin: string };
  fecha: Date;
  dateKey: string;
  vuelos: VueloVista[];
  disponibles: PilotoDia[];
  onAgendar?: (fecha: Date, horario: { horaInicio: string; horaFin: string }) => void;
  onEditar?: (vuelo: VueloVista) => void;
}

export const AgendaBloqueHorario: React.FC<AgendaBloqueHorarioProps> = ({
  horario,
  fecha,
  dateKey,
  vuelos,
  disponibles,
  onAgendar,
  onEditar,
}) => {
  const carriles = agruparVuelosPorPiloto(vuelos, dateKey, horario.horaInicio, horario.horaFin);
  const totalVuelos = carriles.reduce((acc, c) => acc + c.vuelos.length, 0);
  const libres = pilotosLibresEnBloque(disponibles, carriles);

  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-surface-raised shadow-sm overflow-hidden">
      <header className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700 px-3 sm:px-4 py-2.5">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
          {horario.horaInicio} – {horario.horaFin}
        </h3>
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          {totalVuelos} {totalVuelos === 1 ? 'vuelo' : 'vuelos'}
        </span>
      </header>

      <div className="p-3 sm:p-4">
        {totalVuelos === 0 ? (
          <button
            type="button"
            onClick={() => onAgendar?.(fecha, horario)}
            disabled={!onAgendar}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-surface px-4 py-5 text-center hover:border-blue-300 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition disabled:cursor-default disabled:hover:border-slate-200 disabled:hover:bg-surface"
            title={onAgendar ? `Agendar vuelo ${horario.horaInicio}–${horario.horaFin}` : undefined}
          >
            <Users size={16} className="shrink-0 text-slate-400 dark:text-slate-500" />
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Sin reservas — +{disponibles.length} pilotos disponibles
            </span>
            {onAgendar && (
              <span className="ml-1 text-xs font-bold text-blue-600 dark:text-blue-400">· Agendar</span>
            )}
          </button>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-none sm:grid-flow-col sm:auto-cols-[minmax(180px,1fr)] sm:overflow-x-auto">
            {carriles.map((grupo) => (
              <AgendaCarril key={grupo.pilotoId} grupo={grupo} onEditar={onEditar} />
            ))}
            {libres > 0 && (
              <button
                type="button"
                onClick={() => onAgendar?.(fecha, horario)}
                disabled={!onAgendar}
                className="min-w-44 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-surface p-2 flex flex-col items-center justify-center gap-0.5 text-center hover:border-blue-300 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition disabled:cursor-default"
                title={onAgendar ? `Agendar vuelo ${horario.horaInicio}–${horario.horaFin}` : undefined}
              >
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  Libres (+{libres})
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500">
                  Pilotos disponibles
                </span>
                {onAgendar && (
                  <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">Agendar</span>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
