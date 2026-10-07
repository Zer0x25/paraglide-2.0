"use client";

import { UserCheck } from 'lucide-react';
import type { Pasajero, Piloto } from '../hooks/types';

interface VueloModalGroupAssignProps {
  currentGroupPassengers: Pasajero[];
  groupPilotSelections: Record<number, string>;
  setGroupPilotSelections: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  pilotos: Piloto[];
  isPilotoDisabled: (pilotoId: number, currentPasajeroId?: number) => boolean;
  onResetReserva: () => void;
}

export function VueloModalGroupAssign({
  currentGroupPassengers,
  groupPilotSelections,
  setGroupPilotSelections,
  pilotos,
  isPilotoDisabled,
  onResetReserva,
}: VueloModalGroupAssignProps) {
  const asignadosCount = Object.values(groupPilotSelections).filter(Boolean).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <UserCheck size={14} className="text-blue-600" />
          2. Asignación de Pilotos ({asignadosCount}/{currentGroupPassengers.length})
        </h3>
        <button
          type="button"
          onClick={onResetReserva}
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer"
        >
          Cambiar reserva
        </button>
      </div>

      <div className="space-y-2.5">
        {currentGroupPassengers.map((p: Pasajero, idx: number) => {
          const pilotoAsignadoId = groupPilotSelections[p.id];
          const pesoPax = p.pesoVerificado || p.peso;

          return (
            <div
              key={p.id}
              className={`p-4 rounded-2xl border transition-all ${
                pilotoAsignadoId
                  ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/60'
                  : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700'
              }`}
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                      {idx + 1}. {p.nombre} {p.numeroPasajero && <span className="text-slate-400 font-normal ml-1">#{p.numeroPasajero}</span>}
                    </span>
                    {pesoPax && <span className="text-xs text-slate-400 font-bold">({pesoPax} kg)</span>}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {p.rutDni || 'Sin RUT'} • {p.firmaDeslinde ? '✓ Deslinde Firmado' : 'Deslinde Pendiente'}
                  </p>
                </div>

                <div className="w-full sm:w-64">
                  <select
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-500"
                    value={groupPilotSelections[p.id] || ''}
                    onChange={(e) => setGroupPilotSelections({ ...groupPilotSelections, [p.id]: e.target.value })}
                  >
                    <option value="">-- Seleccionar Piloto --</option>
                    {pilotos.map((piloto) => (
                      <option
                        key={piloto.id}
                        value={piloto.id}
                        disabled={isPilotoDisabled(piloto.id, p.id)}
                      >
                        {piloto.nombre} ({piloto.categoria || 'MASTER'}{piloto.pesoMaximoPasajero ? ` • max ${piloto.pesoMaximoPasajero}kg` : ''}) {isPilotoDisabled(piloto.id, p.id) ? '(Ocupado)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
