"use client";

import { Calendar, AlertTriangle, RefreshCw } from 'lucide-react';

interface AgendamientoRapidoHorariosProps {
  fecha: string;
  setFecha: (f: string) => void;
  hora: string;
  setHora: (h: string) => void;
  setAsignaciones: React.Dispatch<React.SetStateAction<Record<number, number>>>;
  nombreConfig: string | null;
  diaBloqueado: boolean;
  loadingBloques: boolean;
  bloquesDelDia: Array<{ horaInicio: string; horaFin: string }>;
  loadingMatch: boolean;
  ejecutarAutoMatch: () => Promise<void>;
}

const HORAS_DISPONIBLES = [
  '08:00', '09:00', '10:00', '11:00', '12:00', 
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'
];

export function AgendamientoRapidoHorarios({
  fecha,
  setFecha,
  hora,
  setHora,
  setAsignaciones,
  nombreConfig,
  diaBloqueado,
  loadingBloques,
  bloquesDelDia,
  loadingMatch,
  ejecutarAutoMatch,
}: AgendamientoRapidoHorariosProps) {
  return (
    <div className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Calendar size={14} className="text-blue-600" />
          1. Fecha y Horario del Vuelo
        </h3>
        {nombreConfig && (
          <span className="text-[11px] font-bold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-md">
            Regla: {nombreConfig}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Fecha</label>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="w-full border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
            Bloque Horario {loadingBloques && <span className="text-slate-400 font-normal lowercase">(cargando…)</span>}
          </label>
          {diaBloqueado ? (
            <div className="flex items-center gap-1.5 p-2 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-2xl text-xs font-bold text-red-700 dark:text-red-300">
              <AlertTriangle size={14} className="shrink-0" />
              <span>Día no operativo / bloqueado</span>
            </div>
          ) : bloquesDelDia.length > 0 ? (
            <select
              value={hora}
              onChange={(e) => {
                setHora(e.target.value);
                setAsignaciones({});
              }}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              {bloquesDelDia.map((b) => (
                <option key={b.horaInicio} value={b.horaInicio}>
                  {b.horaInicio} – {b.horaFin}
                </option>
              ))}
            </select>
          ) : (
            <div className="space-y-1">
              <select
                value={hora}
                onChange={(e) => {
                  setHora(e.target.value);
                  setAsignaciones({});
                }}
                className="w-full border border-amber-300 dark:border-amber-700 rounded-2xl px-3.5 py-2 text-sm bg-amber-50/50 dark:bg-amber-950/20 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-500"
              >
                {HORAS_DISPONIBLES.map((h) => (
                  <option key={h} value={h}>{h} hrs (estándar)</option>
                ))}
              </select>
              <p className="text-[10px] text-amber-600 dark:text-amber-400">
                Sin bloques específicos en configuración; usando franjas estándar.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="pt-1 flex justify-end">
        <button
          type="button"
          onClick={ejecutarAutoMatch}
          disabled={loadingMatch || !fecha || diaBloqueado}
          className="w-full sm:w-auto flex items-center justify-center space-x-2 py-2 px-4 bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl text-xs font-bold shadow-md transition disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw size={14} className={loadingMatch ? 'animate-spin' : ''} />
          <span>{loadingMatch ? 'Calculando afinidad...' : 'Ejecutar Auto-Match'}</span>
        </button>
      </div>
    </div>
  );
}
 