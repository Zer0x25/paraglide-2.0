"use client";

import { Wind, Compass, Thermometer, Cloud } from 'lucide-react';

interface EstadoActualData {
  velocidadViento?: number | null;
  rachaViento?: number | null;
  direccionViento?: string | null;
  temperatura?: number | null;
  techoNubes?: number | null;
  visibilidad?: string | null;
  fechaHora?: string | Date | null;
}

interface MeteoInstrumentosGridProps {
  estadoActual?: EstadoActualData | null;
  dirAEn: (d: string | null | undefined) => string | null;
  minutosDesde: (valor: string | Date | null | undefined) => number | null;
}

export function MeteoInstrumentosGrid({
  estadoActual,
  dirAEn,
  minutosDesde,
}: MeteoInstrumentosGridProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {estadoActual == null ? (
          <span className="text-[11px] font-bold text-slate-400">Sin boletín reciente</span>
        ) : minutosDesde(estadoActual.fechaHora) != null &&
          minutosDesde(estadoActual.fechaHora)! > 15 ? (
          <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">Desactualizado</span>
        ) : (
          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">Al día</span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Viento y Rachas */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-3">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Velocidad del Viento</span>
            <Wind size={20} className="text-cyan-500" />
          </div>

          <div className="flex items-baseline space-x-2">
            <span className="text-4xl font-black text-slate-900 dark:text-white">
              {estadoActual?.velocidadViento != null ? Number(estadoActual.velocidadViento).toFixed(1) : '—'}
            </span>
            <span className="text-sm font-bold text-slate-400">km/h</span>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
            <span>Racha Máxima:</span>
            <span className="font-extrabold text-amber-500">
              {estadoActual?.rachaViento != null ? `${Number(estadoActual.rachaViento).toFixed(1)} km/h` : '—'}
            </span>
          </div>
        </div>

        {/* Dirección de Viento */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-3">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Dirección de Viento</span>
            <Compass size={20} className="text-blue-500" />
          </div>

          <div className="flex items-baseline space-x-2">
            <span className="text-4xl font-black text-slate-900 dark:text-white uppercase">
              {estadoActual?.direccionViento || '—'}
            </span>
            <span className="text-sm font-bold text-slate-400">
              {estadoActual?.direccionViento ? dirAEn(estadoActual.direccionViento) : '—'}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
            <span>Orientación:</span>
            <span className="font-extrabold text-emerald-600 dark:text-emerald-400">Enfrentado al despegue</span>
          </div>
        </div>

        {/* Temperatura */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-3">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Temperatura</span>
            <Thermometer size={20} className="text-red-500" />
          </div>

          <div className="flex items-baseline space-x-2">
            <span className="text-4xl font-black text-slate-900 dark:text-white">
              {estadoActual?.temperatura != null ? Number(estadoActual.temperatura).toFixed(1) : '—'}
            </span>
            <span className="text-sm font-bold text-slate-400">°C</span>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
            <span>Gradiente térmico:</span>
            <span className="font-extrabold text-slate-800 dark:text-slate-200">Actividad moderada</span>
          </div>
        </div>

        {/* Techo y Visibilidad */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-3">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Techo & Visibilidad</span>
            <Cloud size={20} className="text-indigo-500" />
          </div>

          <div className="flex items-baseline space-x-2">
            <span className="text-4xl font-black text-slate-900 dark:text-white">
              {estadoActual?.techoNubes != null ? Number(estadoActual.techoNubes).toFixed(0) : '—'}
            </span>
            <span className="text-sm font-bold text-slate-400">m AGL</span>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
            <span>Visibilidad:</span>
            <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
              {estadoActual?.visibilidad || '—'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
