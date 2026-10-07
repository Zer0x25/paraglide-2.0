"use client";

import { UserCheck } from 'lucide-react';
import type { Pasajero, Piloto } from '../hooks/types';

interface VueloModalSingleAssignProps {
  pasajeroId: string;
  pilotoId: string;
  esCerrada: boolean;
  poolPasajeros: Pasajero[];
  pilotos: Piloto[];
  isPilotoDisabled: (pilotoId: number) => boolean;
  onPasajeroChange: (id: string) => void;
  onPilotoChange: (id: string) => void;
}

export function VueloModalSingleAssign({
  pasajeroId,
  pilotoId,
  esCerrada,
  poolPasajeros,
  pilotos,
  isPilotoDisabled,
  onPasajeroChange,
  onPilotoChange,
}: VueloModalSingleAssignProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
        <UserCheck size={14} className="text-blue-600" />
        2. Asignación de Pasajero y Piloto
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="vuelo-pasajero" className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
            Pasajero
          </label>
          <select
            id="vuelo-pasajero"
            required
            disabled={esCerrada}
            className={`w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 ${esCerrada ? 'opacity-60 cursor-not-allowed bg-slate-100 dark:bg-slate-800/60' : ''}`}
            value={pasajeroId}
            onChange={(e) => onPasajeroChange(e.target.value)}
          >
            <option value="" disabled>Seleccione un pasajero...</option>
            {poolPasajeros.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} {p.numeroPasajero ? `(#${p.numeroPasajero})` : ''} {p.peso ? `(${p.peso}kg)` : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="vuelo-piloto" className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
            Piloto Asignado
          </label>
          <select
            id="vuelo-piloto"
            required
            disabled={esCerrada}
            className={`w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 ${esCerrada ? 'opacity-60 cursor-not-allowed bg-slate-100 dark:bg-slate-800/60' : ''}`}
            value={pilotoId}
            onChange={(e) => onPilotoChange(e.target.value)}
          >
            <option value="" disabled>Seleccione un piloto activo...</option>
            {pilotos.map((p) => (
              <option
                key={p.id}
                value={p.id}
                disabled={isPilotoDisabled(p.id)}
              >
                {p.nombre} ({p.categoria || 'MASTER'}{p.pesoMaximoPasajero ? ` • max ${p.pesoMaximoPasajero}kg` : ''}) {isPilotoDisabled(p.id) ? '(Ocupado)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
