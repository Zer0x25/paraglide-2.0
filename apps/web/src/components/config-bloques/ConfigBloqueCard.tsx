"use client";

import { Calendar, Edit2, Trash2, Lock } from 'lucide-react';
import { etiquetaNumero } from '@parapente/shared';
import { ConfiguracionBloque, Horario } from './types';

interface ConfigBloqueCardProps {
  config: ConfiguracionBloque;
  numeroItem?: { numero: number; archivada?: boolean } | number;
  onEdit: (config: ConfiguracionBloque) => void;
  onDelete: (id: number) => void;
  formatearFecha: (fecha: string | null | undefined) => string;
}

export function ConfigBloqueCard({
  config,
  numeroItem,
  onEdit,
  onDelete,
  formatearFecha,
}: ConfigBloqueCardProps) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-5 flex flex-col relative">
      <div className="absolute top-4 right-4 flex space-x-2">
        <button onClick={() => onEdit(config)} aria-label="Editar regla" className="text-slate-300 hover:text-blue-500">
          <Edit2 size={18} />
        </button>
        <button onClick={() => onDelete(config.id)} aria-label="Eliminar regla" className="text-slate-300 hover:text-red-500">
          <Trash2 size={18} />
        </button>
      </div>

      <div className="flex items-center space-x-2 mb-2">
        {config.fechaExacta ? (
          <Calendar className="text-orange-500" size={20} />
        ) : (
          <Calendar className="text-blue-500" size={20} />
        )}
        <h3 className="font-bold text-lg pr-12 text-slate-800 dark:text-white">{config.nombre}</h3>
      </div>

      {numeroItem && (() => {
        const etiqueta = etiquetaNumero(typeof numeroItem === 'number' ? { numero: numeroItem, archivada: false } : numeroItem ? { numero: numeroItem.numero, archivada: numeroItem.archivada ?? false } : undefined);
        const archivada = typeof numeroItem === 'object' ? numeroItem?.archivada : false;
        return (
          <span
            className={`inline-flex items-center self-start text-xs font-semibold px-2 py-0.5 rounded-full mb-2 ${
              archivada
                ? 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
            }`}
          >
            {etiqueta}
          </span>
        );
      })()}

      <div className="text-sm text-slate-600 dark:text-slate-400 mb-4 space-y-1">
        {config.fechaExacta ? (
          <p className="text-orange-600 font-medium">
            Día Específico: {formatearFecha(config.fechaExacta)}
          </p>
        ) : config.fechaInicio ? (
          <p>
            Rango: {formatearFecha(config.fechaInicio)} a{' '}
            {config.fechaFin ? formatearFecha(config.fechaFin) : 'Siempre'}
          </p>
        ) : (
          <p>
            Aplica: <span className="font-medium text-slate-800 dark:text-white">Indefinidamente</span>
          </p>
        )}
      </div>

      {config.bloqueado ? (
        <div className="mt-auto bg-red-50 text-red-700 rounded-md p-3 border border-red-100 dark:border-red-900 flex items-center justify-center">
          <Lock size={16} className="mr-2" /> Día Bloqueado
        </div>
      ) : (
        <div className="mt-auto bg-slate-50 dark:bg-slate-700/50 rounded-md p-3 border border-slate-100 dark:border-slate-600">
          <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">
            Bloques ({config.horarios.length})
          </h4>
          <div className="flex flex-wrap gap-2">
            {config.horarios.map((h: Horario, i: number) => (
              <span
                key={i}
                className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 px-2 py-1 rounded text-slate-700 dark:text-slate-300"
              >
                {h.horaInicio} - {h.horaFin}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
