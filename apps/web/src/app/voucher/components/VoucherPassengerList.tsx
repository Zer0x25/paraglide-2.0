"use client";

import { CheckCircle2, AlertTriangle } from 'lucide-react';
import type { PasajeroPublico } from '../types';

interface VoucherPassengerListProps {
  pasajeros: PasajeroPublico[];
}

export function VoucherPassengerList({ pasajeros }: VoucherPassengerListProps) {
  return (
    <div>
      <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block mb-3">
        Pasajeros Registrados ({pasajeros.length})
      </span>

      <div className="space-y-2.5">
        {pasajeros.map((p, idx) => (
          <div
            key={p.id}
            className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700"
          >
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200 flex items-center justify-center font-black text-xs">
                {idx + 1}
              </div>
              <div>
                <p className="font-bold text-xs text-slate-900 dark:text-slate-100">{p.nombre}</p>
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  {p.rutDni || 'RUT por registrar'}
                </p>
              </div>
            </div>

            <div>
              {p.firmaDeslinde ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 size={12} /> Deslinde Firmado
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/80 px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                  <AlertTriangle size={12} /> Firma Pendiente
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
