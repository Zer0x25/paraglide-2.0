"use client";

import { Radio, Sun } from 'lucide-react';
import { clasificarUv } from '@/utils/uv';

interface PronosticoData {
  velocidadViento?: number | null;
  rachaViento?: number | null;
  direccionViento?: string | null;
  temperatura?: number | null;
  techoNubes?: number | null;
  nubosidad?: number | null;
  indiceUv?: number | null;
}

interface MeteoOpenMeteoCardProps {
  pronostico?: PronosticoData | null;
  refrescando: boolean;
  kmhAKt: (v: number | null) => number | null;
  cAF: (c: number | null) => number | null;
  mAPies: (m: number | null) => number | null;
  dirAEn: (d: string | null | undefined) => string | null;
}

export function MeteoOpenMeteoCard({
  pronostico,
  refrescando,
  kmhAKt,
  cAF,
  mAPies,
  dirAEn,
}: MeteoOpenMeteoCardProps) {
  const uv = clasificarUv(pronostico?.indiceUv);

  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-cyan-100 dark:border-cyan-900/50 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-cyan-50 dark:bg-cyan-950 text-cyan-600 dark:text-cyan-400 flex items-center justify-center font-bold">
            <Radio size={16} />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
              Pronóstico Open-Meteo (en vivo)
            </h3>
            <p className="text-[11px] text-slate-400">Datos externos de la estación meteorológica</p>
          </div>
        </div>
        {refrescando && (
          <span className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 flex items-center gap-1">
            <Radio size={12} className="animate-spin" />
            sincronizando
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Viento</p>
          <p className="text-lg font-black text-slate-900 dark:text-white leading-tight">
            {pronostico?.velocidadViento != null ? `${Number(pronostico.velocidadViento).toFixed(1)} km/h` : '—'}
          </p>
          <p className="text-[10px] font-bold text-slate-400">
            {kmhAKt(pronostico?.velocidadViento ?? null) != null
              ? `${kmhAKt(pronostico?.velocidadViento ?? null)!.toFixed(1)} kt`
              : '—'}
          </p>
        </div>
        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Racha</p>
          <p className="text-lg font-black text-slate-900 dark:text-white leading-tight">
            {pronostico?.rachaViento != null ? `${Number(pronostico.rachaViento).toFixed(1)} km/h` : '—'}
          </p>
          <p className="text-[10px] font-bold text-slate-400">
            {kmhAKt(pronostico?.rachaViento ?? null) != null
              ? `${kmhAKt(pronostico?.rachaViento ?? null)!.toFixed(1)} kt`
              : '—'}
          </p>
        </div>
        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Dirección</p>
          <p className="text-lg font-black text-slate-900 dark:text-white uppercase leading-tight">
            {pronostico?.direccionViento || '—'}
          </p>
          <p className="text-[10px] font-bold text-slate-400 uppercase">
            {dirAEn(pronostico?.direccionViento) || '—'}
          </p>
        </div>
        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Temp.</p>
          <p className="text-lg font-black text-slate-900 dark:text-white leading-tight">
            {pronostico?.temperatura != null ? `${Number(pronostico.temperatura).toFixed(1)} °C` : '—'}
          </p>
          <p className="text-[10px] font-bold text-slate-400">
            {cAF(pronostico?.temperatura ?? null) != null
              ? `${cAF(pronostico?.temperatura ?? null)!.toFixed(1)} °F`
              : '—'}
          </p>
        </div>
        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Techo</p>
          <p className="text-lg font-black text-slate-900 dark:text-white leading-tight">
            {pronostico?.techoNubes != null ? `${Number(pronostico.techoNubes).toFixed(0)} m` : '—'}
          </p>
          <p className="text-[10px] font-bold text-slate-400">
            {mAPies(pronostico?.techoNubes ?? null) != null
              ? `${mAPies(pronostico?.techoNubes ?? null)!.toFixed(0)} ft`
              : '—'}
          </p>
        </div>
        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Nubosidad</p>
          <p className="text-lg font-black text-slate-900 dark:text-white leading-tight">
            {pronostico?.nubosidad != null ? `${pronostico.nubosidad}%` : '—'}
          </p>
        </div>
        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Índice UV</p>
          <p className="text-lg font-black text-slate-900 dark:text-white leading-tight">
            {pronostico?.indiceUv != null ? Number(pronostico.indiceUv).toFixed(1) : '—'}
          </p>
          <p className="text-[10px] font-bold text-slate-400">
            {uv.etiqueta}
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-amber-100 dark:border-amber-900/50 space-y-3">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
            <Sun size={16} />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">Recomendación para pasajeros</h3>
            <p className="text-[11px] text-slate-400">Índice UV en vivo · protección solar</p>
          </div>
        </div>
        <div className={`p-4 rounded-2xl border ${uv.bg} ${uv.border}`}>
          <p className={`text-sm font-black ${uv.color}`}>
            UV {pronostico?.indiceUv != null ? Number(pronostico.indiceUv).toFixed(1) : '—'} · {uv.etiqueta}
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{uv.recomendacion}</p>
        </div>
      </div>
    </div>
  );
}
