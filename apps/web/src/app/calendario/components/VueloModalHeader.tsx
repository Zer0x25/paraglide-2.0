"use client";

import { Plane, Lock, X } from 'lucide-react';
import type { ReservaConPasajeros } from '../../../types/reservaDetalle';
import type { Pasajero } from '../hooks/types';

interface VueloModalHeaderProps {
  esCerrada: boolean;
  editingId: number | null;
  filterReservaId: number | null;
  currentReserva?: ReservaConPasajeros | null;
  currentPasajero?: Pasajero | null;
  currentGroupPassengersCount: number;
  onClose: () => void;
}

export function VueloModalHeader({
  esCerrada,
  editingId,
  filterReservaId,
  currentReserva,
  currentPasajero,
  currentGroupPassengersCount,
  onClose,
}: VueloModalHeaderProps) {
  return (
    <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/50">
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-500/20 shrink-0">
          <Plane size={20} />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            {esCerrada ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-0.5 rounded-full border border-slate-300 dark:border-slate-700">
                <Lock size={12} className="text-slate-500" />
                Cerrada (Inmutable)
              </span>
            ) : editingId ? (
              <span className="text-xs font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
                #Vuelo-{editingId}
              </span>
            ) : filterReservaId && currentReserva ? (
              <span className="text-xs font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
                #Reserva-{currentReserva.numeroReserva || currentReserva.id}
              </span>
            ) : null}
            <h2 id="modal-vuelo-titulo" className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
              {editingId ? (esCerrada ? 'Detalle de Vuelo' : 'Editar Vuelo') : filterReservaId ? 'Agendar Vuelo del Grupo' : 'Agendar Nuevo Vuelo'}
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {editingId ? (
              <>
                Pasajero: <strong className="text-slate-700 dark:text-slate-200">{currentPasajero?.nombre || 'Pasajero asignado'}</strong>
                {currentReserva ? ` • Reserva #${currentReserva.numeroReserva || currentReserva.id}` : ''}
              </>
            ) : filterReservaId && currentReserva ? (
              <>
                Titular: <strong className="text-slate-700 dark:text-slate-200">{currentReserva.nombreTitular}</strong> • {currentGroupPassengersCount} {currentGroupPassengersCount === 1 ? 'pasajero pendiente' : 'pasajeros pendientes'}
              </>
            ) : (
              'Selecciona una reserva para agendar los vuelos'
            )}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar modal"
        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
      >
        <X size={20} />
      </button>
    </div>
  );
}
