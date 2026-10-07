"use client";

import { UserCheck } from 'lucide-react';
import type { PilotoDTO } from '@parapente/shared';
import type { ReservaConPasajeros } from '@/types/reservaDetalle';

type PasajeroSoftDelete = ReservaConPasajeros['pasajeros'][number] & { deletedAt?: string | Date | null };

interface AgendamientoRapidoPasajerosProps {
  pasajeros: PasajeroSoftDelete[];
  pilotos: PilotoDTO[];
  asignaciones: Record<number, number>;
  setAsignaciones: React.Dispatch<React.SetStateAction<Record<number, number>>>;
}

export function AgendamientoRapidoPasajeros({
  pasajeros,
  pilotos,
  asignaciones,
  setAsignaciones,
}: AgendamientoRapidoPasajerosProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
        <UserCheck size={14} className="text-blue-600" />
        2. Asignación de Pilotos ({Object.keys(asignaciones).length}/{pasajeros.length})
      </h3>

      <div className="space-y-2.5">
        {pasajeros.map((p, idx: number) => {
          const pilotoAsignadoId = p.id != null ? asignaciones[p.id as number] : undefined;
          const pesoPax = (p.pesoVerificado ?? p.peso ?? 75) as number;

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
                    <span className="text-xs text-slate-400 font-bold">({pesoPax} kg)</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {p.rutDni || 'Sin RUT'} • {p.firmaDeslinde ? '✓ Deslinde Firmado' : 'Deslinde Pendiente'}
                  </p>
                </div>

                <div className="w-full sm:w-64">
                  <select
                    value={pilotoAsignadoId || ''}
                    onChange={(e) => {
                      const val = e.target.value ? Number(e.target.value) : undefined;
                      if (p.id == null) return;
                      const pid = p.id as number;
                      setAsignaciones(prev => {
                        const copy = { ...prev };
                        if (val) copy[pid] = val;
                        else delete copy[pid];
                        return copy;
                      });
                    }}
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Seleccionar Piloto --</option>
                    {pilotos.map((pi) => (
                      <option key={pi.id} value={pi.id}>
                        {pi.nombre} ({pi.categoria || 'MASTER'} • max {pi.pesoMaximoPasajero || 110}kg)
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
