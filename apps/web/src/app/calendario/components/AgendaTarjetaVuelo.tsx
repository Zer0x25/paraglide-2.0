import React from 'react';
import { Badge } from '@/components/ui';
import { formatCLP } from '@/utils/format';
import { horaLocalHHMM, type VueloVista } from '../agendas.util';

export type AcentoEstado = 'blue' | 'green' | 'red' | 'slate';

/** Misma semántica que `eventStyleGetter` de la página: los AGENDADO pasados van en slate. */
export const acentoDe = (v: VueloVista): AcentoEstado => {
  if (v.estado === 'COMPLETADO' || v.reserva?.estado === 'COMPLETADA') return 'green';
  if (v.estado === 'CANCELADO' || v.reserva?.estado === 'CANCELADA') return 'red';
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fecha = new Date(v.fechaHora);
  fecha.setHours(0, 0, 0, 0);
  return fecha.getTime() < hoy.getTime() ? 'slate' : 'blue';
};

export const dotClass: Record<AcentoEstado, string> = {
  blue: 'bg-blue-500 dark:bg-blue-400',
  green: 'bg-green-500 dark:bg-green-400',
  red: 'bg-red-500 dark:bg-red-400',
  slate: 'bg-slate-400 dark:bg-slate-500',
};

export const badgeVariant = (v: VueloVista): 'blue' | 'green' | 'red' => {
  if (v.estado === 'COMPLETADO' || v.reserva?.estado === 'COMPLETADA') return 'green';
  if (v.estado === 'CANCELADO' || v.reserva?.estado === 'CANCELADA') return 'red';
  return 'blue';
};

export interface AgendaTarjetaVueloProps {
  vuelo: VueloVista;
  onEditar?: (vuelo: VueloVista) => void;
}

export const AgendaTarjetaVuelo: React.FC<AgendaTarjetaVueloProps> = ({ vuelo: v, onEditar }) => {
  const acento = acentoDe(v);
  const estadoVisible =
    v.reserva?.estado === 'COMPLETADA' || v.estado === 'COMPLETADO'
      ? 'COMPLETADO'
      : v.reserva?.estado === 'CANCELADA' || v.estado === 'CANCELADO'
      ? 'CANCELADO'
      : v.estado || 'AGENDADO';

  return (
    <div
      onClick={() => onEditar?.(v)}
      role={onEditar ? 'button' : undefined}
      tabIndex={onEditar ? 0 : undefined}
      onKeyDown={
        onEditar
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onEditar(v);
              }
            }
          : undefined
      }
      title={onEditar ? `Editar reserva de ${v.pasajero?.nombre ?? 'Pasajero'}` : undefined}
      aria-label={onEditar ? `Editar reserva de ${v.pasajero?.nombre ?? 'Pasajero'}` : undefined}
      className={`rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 shadow-sm space-y-1 ${
        onEditar
          ? 'cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/40'
          : ''
      }`}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass[acento]}`} />
        <span className="truncate text-sm font-semibold text-slate-900 dark:text-white">
          {v.pasajero?.nombre ?? 'Pasajero'}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {horaLocalHHMM(v.fechaHora)} hs
        </span>
        <Badge variant={badgeVariant(v)} soft>
          {estadoVisible}
        </Badge>
      </div>
      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{formatCLP(v.valorPactado)}</p>
    </div>
  );
};
