"use client";

import { UserCheck } from 'lucide-react';
import type { ReservaConPasajeros } from '../../../types/reservaDetalle';
import type { PasajeroParaPendiente } from '../hooks/types';

export const pasajeroPendiente = (p: PasajeroParaPendiente) =>
  !(p.vuelos || []).some((v: { estado: string }) => v.estado === 'AGENDADO' || v.estado === 'COMPLETADO');

interface VueloModalSelectReservaProps {
  reservas: ReservaConPasajeros[];
  filterReservaId: number | null;
  onSelectReserva: (id: number | null) => void;
}

export function VueloModalSelectReserva({
  reservas,
  filterReservaId,
  onSelectReserva,
}: VueloModalSelectReservaProps) {
  return (
    <div className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 space-y-3">
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
        <UserCheck size={14} className="text-blue-600" />
        Seleccionar Reserva / Grupo *
      </h3>
      <div>
        <select
          required
          className="w-full border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-500"
          value={filterReservaId || ''}
          onChange={(e) => {
            const resId = e.target.value ? Number(e.target.value) : null;
            onSelectReserva(resId);
          }}
        >
          <option value="" disabled>-- Selecciona una Reserva para agendar --</option>
          {reservas
            .filter((r) => {
              const estadoReserva = r.estado ?? 'SIN_AGENDAR';
              if (estadoReserva === 'COMPLETADA' || estadoReserva === 'CANCELADA') return false;
              const pasajerosList = Array.isArray(r.pasajeros) ? r.pasajeros : [];
              return pasajerosList.some(pasajeroPendiente);
            })
            .map((r) => {
              const pasajerosList = Array.isArray(r.pasajeros) ? r.pasajeros : [];
              const totalP = pasajerosList.length;
              const pendientesP = pasajerosList.filter(pasajeroPendiente).length;
              const estadoLabel = pendientesP === totalP ? '[📅 Pendiente]' : `[⏳ Parcial ${totalP - pendientesP}/${totalP}]`;
              return (
                <option key={r.id} value={r.id}>
                  Reserva #{r.numeroReserva || r.id} - {r.nombreTitular} ({totalP} pas.) {estadoLabel}
                </option>
              );
            })}
        </select>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Elige una reserva para cargar sus pasajeros y asignarles fecha, hora y piloto.
      </p>
    </div>
  );
}
