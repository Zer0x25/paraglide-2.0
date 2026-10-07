"use client";

import { Archive } from 'lucide-react';
import { etiquetaNumero } from '@parapente/shared';
import { ConfiguracionBloque } from './types';

interface ConfigBloquesArchivadasProps {
  archivadas: ConfiguracionBloque[];
  mostrarArchivadas: boolean;
  onToggleMostrar: () => void;
  numeros: Map<number, { numero: number; archivada?: boolean } | number>;
}

export function ConfigBloquesArchivadas({
  archivadas,
  mostrarArchivadas,
  onToggleMostrar,
  numeros,
}: ConfigBloquesArchivadasProps) {
  if (archivadas.length === 0) return null;

  return (
    <div className="mt-6 border border-slate-200 dark:border-slate-700 rounded-lg">
      <button
        type="button"
        onClick={onToggleMostrar}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-t-lg"
      >
        <span className="flex items-center space-x-2">
          <Archive size={16} />
          <span>Archivadas / Expiradas ({archivadas.length})</span>
        </span>
        <span className="text-xs text-slate-400">{mostrarArchivadas ? 'Ocultar' : 'Mostrar'}</span>
      </button>

      {mostrarArchivadas && (
        <div className="px-4 pb-4 space-y-2">
          <p className="text-xs text-slate-400 italic">El historial del calendario se conserva.</p>
          {archivadas.map((config) => (
            <div
              key={config.id}
              className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700 rounded-md px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300 truncate">
                  {config.nombre}
                </p>
                {config.archivadaEn && (
                  <p className="text-xs text-slate-400">
                    Archivada: {new Date(config.archivadaEn).toLocaleDateString()}
                  </p>
                )}
              </div>
              {numeros.has(config.id) && (
                <span className="text-xs text-slate-400 shrink-0 ml-2">
                  {etiquetaNumero((() => { const n = numeros.get(config.id); if (typeof n === 'number') return { numero: n, archivada: false }; return n ? { numero: n.numero, archivada: n.archivada ?? false } : undefined; })())}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
