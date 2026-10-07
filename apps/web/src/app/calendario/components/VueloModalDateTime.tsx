"use client";

import { Calendar, AlertTriangle, Sparkles } from 'lucide-react';
import type { HorarioBloque } from '../hooks/types';

interface VueloModalDateTimeProps {
  fecha: string;
  hora: string;
  esCerrada: boolean;
  isBloqueado: boolean;
  availableBlocks: HorarioBloque[];
  selectedTimeIsCustom: boolean;
  isEditing: boolean;
  hasFilterReserva: boolean;
  onFechaChange: (fecha: string) => void;
  onHoraChange: (hora: string) => void;
  openConfigBloques: () => void;
  handleAsignacionAutomatica: () => Promise<void>;
}

export function VueloModalDateTime({
  fecha,
  hora,
  esCerrada,
  isBloqueado,
  availableBlocks,
  selectedTimeIsCustom,
  isEditing,
  hasFilterReserva,
  onFechaChange,
  onHoraChange,
  openConfigBloques,
  handleAsignacionAutomatica,
}: VueloModalDateTimeProps) {
  return (
    <div className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Calendar size={14} className="text-blue-600" />
          1. Fecha y Horario del Vuelo
        </h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="vuelo-fecha" className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
            Fecha
          </label>
          <input
            id="vuelo-fecha"
            type="date"
            required
            disabled={esCerrada}
            value={fecha}
            onChange={(e) => onFechaChange(e.target.value)}
            className={`w-full border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-500 ${esCerrada ? 'opacity-60 cursor-not-allowed bg-slate-100 dark:bg-slate-800/60' : ''}`}
          />
        </div>

        <div>
          <label htmlFor="vuelo-hora" className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
            Bloque Horario
          </label>
          {!fecha ? (
            <p className="text-xs text-slate-500 py-2">Selecciona una fecha primero para ver los bloques disponibles.</p>
          ) : isBloqueado ? (
            <div className="flex flex-col gap-1 p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-2xl text-xs font-bold text-red-700 dark:text-red-300">
              <div className="flex items-center gap-1.5">
                <AlertTriangle size={14} className="shrink-0" />
                <span>Día no operativo / bloqueado</span>
              </div>
              <p className="text-[11px] font-normal text-red-500">
                No se pueden agendar vuelos.{' '}
                <button type="button" onClick={openConfigBloques} className="underline font-bold cursor-pointer">
                  Configurar Horarios
                </button>.
              </p>
            </div>
          ) : availableBlocks.length === 0 ? (
            <div className="flex flex-col gap-1 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-2xl text-xs font-bold text-amber-700 dark:text-amber-300">
              <div className="flex items-center gap-1.5">
                <AlertTriangle size={14} className="shrink-0" />
                <span>No hay bloques configurados para este día</span>
              </div>
              <p className="text-[11px] font-normal text-amber-600">
                Configura horarios con el botón{' '}
                <button type="button" onClick={openConfigBloques} className="underline font-bold cursor-pointer">
                  Configurar Bloques
                </button>.
              </p>
            </div>
          ) : (
            <select
              id="vuelo-hora"
              required
              disabled={esCerrada}
              value={hora}
              onChange={(e) => onHoraChange(e.target.value)}
              className={`w-full border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-500 ${esCerrada ? 'opacity-60 cursor-not-allowed bg-slate-100 dark:bg-slate-800/60' : ''}`}
            >
              <option value="" disabled>Seleccione un bloque...</option>
              {selectedTimeIsCustom && (
                <option value={hora}>
                  Hora guardada: {hora}
                </option>
              )}
              {availableBlocks.map((block: HorarioBloque, i: number) => (
                <option key={i} value={block.horaInicio}>
                  {block.horaInicio} – {block.horaFin}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Si es agendamiento de grupo, botón de Auto-Match con IA */}
      {!isEditing && hasFilterReserva && (
        <div className="pt-1 flex justify-end">
          <button
            type="button"
            onClick={handleAsignacionAutomatica}
            disabled={isBloqueado || !fecha}
            className="w-full sm:w-auto flex items-center justify-center space-x-2 py-2 px-4 bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl text-xs font-bold shadow-md transition disabled:opacity-50 cursor-pointer"
          >
            <Sparkles size={14} />
            <span>Ejecutar Auto-Match</span>
          </button>
        </div>
      )}
    </div>
  );
}
