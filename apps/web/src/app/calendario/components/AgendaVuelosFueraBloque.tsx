import React from 'react';
import { agruparVuelosPorLista, type VueloVista } from '../agendas.util';
import { AgendaCarril } from './AgendaCarril';

export interface AgendaVuelosFueraBloqueProps {
  vuelos: VueloVista[];
  titulo: string;
  descripcion?: string;
  onEditar?: (vuelo: VueloVista) => void;
}

export const AgendaVuelosFueraBloque: React.FC<AgendaVuelosFueraBloqueProps> = ({
  vuelos,
  titulo,
  descripcion,
  onEditar,
}) => {
  if (vuelos.length === 0) return null;

  const carrilesFuera = agruparVuelosPorLista(vuelos);

  return (
    <section className="rounded-2xl border border-amber-300 dark:border-amber-700/60 bg-amber-50/40 dark:bg-amber-950/20 shadow-sm overflow-hidden">
      <header className="flex items-center justify-between gap-2 border-b border-amber-200 dark:border-amber-800/60 px-3 sm:px-4 py-2.5 bg-amber-100/60 dark:bg-amber-900/30">
        <div className="flex items-center gap-2">
          <span className="text-amber-600 dark:text-amber-400 font-bold text-sm">⚠</span>
          <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">{titulo}</h3>
        </div>
        <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">
          {vuelos.length} {vuelos.length === 1 ? 'vuelo' : 'vuelos'}
        </span>
      </header>

      <div className={`p-3 sm:p-4 ${descripcion ? 'space-y-2' : ''}`}>
        {descripcion && (
          <p className="text-xs text-amber-800 dark:text-amber-300/90 font-medium">
            {descripcion}
          </p>
        )}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-none sm:grid-flow-col sm:auto-cols-[minmax(180px,1fr)] sm:overflow-x-auto">
          {carrilesFuera.map((grupo) => (
            <AgendaCarril key={grupo.pilotoId} grupo={grupo} onEditar={onEditar} />
          ))}
        </div>
      </div>
    </section>
  );
};
