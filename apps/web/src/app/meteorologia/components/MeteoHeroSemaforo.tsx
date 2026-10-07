"use client";

import { EstadoPista } from '@parapente/shared';

interface MeteoHeroSemaforoProps {
  estado: string;
  observaciones?: string | null;
  registradoPor?: string | null;
  fechaHora?: string | Date | null;
  onQuickStatusChange: (nuevoEstado: EstadoPista) => void;
}

export function MeteoHeroSemaforo({
  estado,
  observaciones,
  registradoPor,
  fechaHora,
  onQuickStatusChange,
}: MeteoHeroSemaforoProps) {
  return (
    <div
      className={`p-6 sm:p-8 rounded-3xl border shadow-lg transition-all relative overflow-hidden ${
        estado === 'ABIERTA'
          ? 'bg-linear-to-br from-emerald-950 via-emerald-900 to-slate-900 border-emerald-500/40 text-white'
          : estado === 'PRECAUCION'
          ? 'bg-linear-to-br from-amber-950 via-amber-900 to-slate-900 border-amber-500/40 text-white'
          : 'bg-linear-to-br from-red-950 via-red-900 to-slate-900 border-red-500/40 text-white'
      }`}
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
        <div className="space-y-2">
          <div className="flex items-center space-x-2.5">
            <span className="relative flex h-3.5 w-3.5">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  estado === 'ABIERTA' ? 'bg-emerald-400' : estado === 'PRECAUCION' ? 'bg-amber-400' : 'bg-red-400'
                }`}
              ></span>
              <span
                className={`relative inline-flex rounded-full h-3.5 w-3.5 ${
                  estado === 'ABIERTA' ? 'bg-emerald-400' : estado === 'PRECAUCION' ? 'bg-amber-400' : 'bg-red-400'
                }`}
              ></span>
            </span>
            <span className="text-xs font-black uppercase tracking-widest text-white/80">
              ESTADO OPERACIONAL EN PISTA DE DESPEGUE
            </span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
            {estado === 'ABIERTA' && '🟢 PISTA ABIERTA (VUELO AUTORIZADO)'}
            {estado === 'PRECAUCION' && '🟡 MODO PRECAUCIÓN (SOLO MASTER/SENIOR)'}
            {estado === 'CERRADA' && '🔴 PISTA CERRADA (CONDICIONES NO SEGURAS)'}
          </h2>

          <p className="text-xs sm:text-sm text-white/80 max-w-2xl">
            {observaciones || 'Sin observaciones registradas para el período actual.'}
          </p>

          <div className="flex items-center space-x-4 text-xs text-white/60 pt-1">
            <span>Registrado por: <strong>{registradoPor || 'Director de Vuelo'}</strong></span>
            <span>•</span>
            <span>
              Última actualización:{' '}
              <strong>
                {fechaHora ? new Date(fechaHora).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : 'Reciente'}
              </strong>
            </span>
          </div>
        </div>

        {/* Botones de Control Rápido */}
        <div className="flex flex-col sm:flex-row gap-2.5 w-full md:w-auto shrink-0">
          <button
            type="button"
            onClick={() => onQuickStatusChange('ABIERTA')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-black transition shadow-md ${
              estado === 'ABIERTA'
                ? 'bg-emerald-500 text-white ring-2 ring-white'
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
          >
            🟢 Abrir Pista
          </button>

          <button
            type="button"
            onClick={() => onQuickStatusChange('PRECAUCION')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-black transition shadow-md ${
              estado === 'PRECAUCION'
                ? 'bg-amber-500 text-white ring-2 ring-white'
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
          >
            🟡 Precaución
          </button>

          <button
            type="button"
            onClick={() => onQuickStatusChange('CERRADA')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-black transition shadow-md ${
              estado === 'CERRADA'
                ? 'bg-red-600 text-white ring-2 ring-white'
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
          >
            🔴 Cerrar Pista
          </button>
        </div>
      </div>
    </div>
  );
}
