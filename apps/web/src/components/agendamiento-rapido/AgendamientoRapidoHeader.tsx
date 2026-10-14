"use client";

import { X, Zap } from 'lucide-react';
import type { ReservaConPasajeros } from '@/types/reservaDetalle';

interface AgendamientoRapidoHeaderProps {
  reserva: ReservaConPasajeros;
  pasajerosCount: number;
  onClose: () => void;
}

export function AgendamientoRapidoHeader({ reserva, pasajerosCount, onClose }: AgendamientoRapidoHeaderProps) {
  return (
    <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/50">
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-500/20">
          <Zap size={20} />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
              #{reserva.numeroReserva || reserva.id}
            </span>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
              Agendamiento Rápido (Smart Match)
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Titular: <strong>{reserva.nombreTitular}</strong> • {pasajerosCount} {pasajerosCount === 1 ? 'pasajero' : 'pasajeros'}
          </p>
        </div>
      </div>
      <button 
        onClick={onClose}
        aria-label="Cerrar modal"
        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
      >
        <X size={20} />
      </button>
    </div>
  );
}
