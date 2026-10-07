"use client";

import { Users, CheckCircle2 } from 'lucide-react';
import type { EstadoPasajero } from '@parapente/shared';

export interface PasajeroRow {
  id: number;
  nombre: string;
  peso?: number | null;
  estado?: string | null;
}

interface PasajerosVueloSectionProps {
  esFinalizadaOCancelada: boolean;
  tienePasajeros: boolean;
  vueloCompletado: boolean;
  pasajeros: PasajeroRow[];
  estadoPasajeros: Record<number, EstadoPasajero>;
  setEstadoPasajeros: React.Dispatch<React.SetStateAction<Record<number, EstadoPasajero>>>;
}

export function PasajerosVueloSection({
  esFinalizadaOCancelada,
  tienePasajeros,
  vueloCompletado,
  pasajeros,
  estadoPasajeros,
  setEstadoPasajeros,
}: PasajerosVueloSectionProps) {
  if (esFinalizadaOCancelada || !tienePasajeros || !vueloCompletado) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
        <Users size={14} />
        Pasajeros
      </h3>
      <div className="bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-slate-200 dark:border-slate-700/80 divide-y divide-slate-100 dark:divide-slate-700/60">
        {pasajeros.map((p) => {
          const marcado = estadoPasajeros[p.id] !== 'CANCELADO';
          return (
            <label
              key={p.id}
              className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer select-none"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                  {p.nombre}
                </span>
                {p.peso ? (
                  <span className="text-[11px] text-slate-400 shrink-0">({p.peso} kg)</span>
                ) : null}
              </div>
              <span className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] text-slate-400">
                  {marcado ? 'Voló' : 'No voló'}
                </span>
                <input
                  type="checkbox"
                  checked={marcado}
                  onChange={() =>
                    setEstadoPasajeros((prev) => ({
                      ...prev,
                      [p.id]: marcado ? 'CANCELADO' : 'VUELO_COMPLETADO',
                    }))
                  }
                  aria-label={`Desmarca si ${p.nombre} no voló`}
                  title="Desmarca si este pasajero no voló"
                  className="h-5 w-5 rounded accent-emerald-600 cursor-pointer"
                />
              </span>
            </label>
          );
        })}
      </div>
      <p className="text-[11px] text-slate-400">
        <CheckCircle2 size={12} className="inline mr-1 -mt-0.5" />
        Todos vienen marcados por defecto: desmarca a quien no haya volado.
      </p>
    </div>
  );
}
