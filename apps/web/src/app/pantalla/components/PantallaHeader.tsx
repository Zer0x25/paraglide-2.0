"use client";

import { Plane, Wind, Maximize, Minimize } from 'lucide-react';
import { PantallaData } from '../hooks/usePantallaController';

interface PantallaHeaderProps {
  nombreEscuela: string;
  estadoPista: string;
  data: PantallaData | null;
  currentTime: string;
  currentDateStr: string;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

export function PantallaHeader({
  nombreEscuela,
  estadoPista,
  data,
  currentTime,
  currentDateStr,
  isFullscreen,
  onToggleFullscreen,
}: PantallaHeaderProps) {
  return (
    <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-slate-900/90 border border-slate-800/80 p-5 rounded-3xl backdrop-blur-xl shadow-2xl">
      {/* Identificador de la Escuela */}
      <div className="flex items-center space-x-3">
        <div className="w-12 h-12 rounded-2xl bg-linear-to-tr from-blue-600 to-cyan-400 flex items-center justify-center font-black shadow-lg shadow-blue-500/20">
          <Plane size={26} className="text-white" />
        </div>
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400">
            SISTEMA DE CONTROL DE DESPEGUE • TANDEM
          </span>
          <h1 className="text-2xl font-black tracking-tight text-white">
            {nombreEscuela}
          </h1>
        </div>
      </div>

      {/* Semáforo Meteorológico en Vivo */}
      <div
        className={`flex items-center space-x-4 px-5 py-2.5 rounded-2xl border transition-all ${
          estadoPista === 'ABIERTA'
            ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
            : estadoPista === 'PRECAUCION'
            ? 'bg-amber-950/60 border-amber-500/40 text-amber-300'
            : 'bg-red-950/60 border-red-500/40 text-red-300'
        }`}
      >
        <div className="flex items-center space-x-2">
          <span className="relative flex h-3.5 w-3.5">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                estadoPista === 'ABIERTA' ? 'bg-emerald-400' : estadoPista === 'PRECAUCION' ? 'bg-amber-400' : 'bg-red-400'
              }`}
            ></span>
            <span
              className={`relative inline-flex rounded-full h-3.5 w-3.5 ${
                estadoPista === 'ABIERTA' ? 'bg-emerald-500' : estadoPista === 'PRECAUCION' ? 'bg-amber-500' : 'bg-red-500'
              }`}
            ></span>
          </span>

          <span className="font-black text-sm uppercase tracking-wide">
            {estadoPista === 'ABIERTA' ? '🟢 PISTA ABIERTA' : estadoPista === 'PRECAUCION' ? '🟡 MODO PRECAUCIÓN' : '🔴 PISTA CERRADA'}
          </span>
        </div>

        <div className="flex items-center space-x-3 text-xs font-mono font-bold pl-3 border-l border-current/20">
          <div className="flex items-center space-x-1">
            <Wind size={14} className="text-cyan-400" />
            <span>{data?.clima?.velocidadViento != null ? Number(data.clima.velocidadViento).toFixed(1) : 14} km/h</span>
          </div>
          <span>•</span>
          <span className="uppercase">{data?.clima?.direccionViento || 'SO'}</span>
          <span>•</span>
          <span>{data?.clima?.temperatura != null ? Number(data.clima.temperatura).toFixed(1) : 22}°C</span>
        </div>
      </div>

      {/* Reloj Digital & Botón Pantalla Completa */}
      <div className="flex items-center space-x-4">
        <div className="text-right">
          <div className="text-2xl sm:text-3xl font-mono font-black tracking-widest text-cyan-300">
            {currentTime || '--:--:--'}
          </div>
          <div className="text-[11px] font-bold text-slate-400 capitalize">
            {currentDateStr || 'Hoy'}
          </div>
        </div>

        <button
          onClick={onToggleFullscreen}
          className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-2xl transition border border-slate-700 shadow-sm"
          title="Alternar Pantalla Completa"
        >
          {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
        </button>
      </div>
    </header>
  );
}
