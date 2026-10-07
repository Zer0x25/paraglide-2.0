"use client";

import { CheckCircle2, Lock, Clock, Users } from 'lucide-react';
import type { CalendarEvent } from '../hooks/types';
import { isSummaryResource } from '../hooks/types';

export function FichaMensual({ event }: { event: CalendarEvent }) {
  const r = event.resource;
  if (!r || !isSummaryResource(r)) {
    return <span className="truncate text-[11px]">{event.title}</span>;
  }

  if (r.isPastSummary) {
    const total = r.total ?? 0;
    const comp = r.completados ?? 0;
    const pct = total ? Math.round((comp / total) * 100) : 0;
    return (
      <div className="flex items-center gap-1.5 w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1 dark:border-slate-700 dark:bg-slate-800 text-[10px] sm:text-[11px] leading-none">
        <CheckCircle2 size={12} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
        {/* PC */}
        <span className="hidden sm:inline font-semibold text-slate-700 dark:text-slate-200">
          {comp}/{total} completados
        </span>
        <span className="hidden sm:inline text-slate-500 dark:text-slate-400">· {pct}%</span>
        {/* Móvil minimalista */}
        <span className="sm:hidden font-bold text-slate-700 dark:text-slate-200">
          {comp}/{total}
        </span>
      </div>
    );
  }

  if (r.isBloqueado) {
    return (
      <div className="flex items-center gap-1.5 w-full rounded-md border border-red-200 bg-red-50 px-2 py-1 dark:border-red-900 dark:bg-red-950/40 text-[10px] sm:text-[11px] text-red-700 dark:text-red-300">
        <Lock size={12} className="shrink-0" />
        <span className="hidden sm:inline font-semibold">Bloqueado</span>
        <span className="sm:hidden font-semibold">—</span>
      </div>
    );
  }

  if (r.isBlockSummary) {
    const reservas = r.reservas ?? 0;
    const disponibles = r.disponibles ?? 0;
    const total = r.totalPilotos ?? 0;
    const ocupacion = total ? reservas / total : 0;
    
    let container = 'bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300';
    let dot = 'bg-emerald-500';
    let horaColor = 'text-slate-800 dark:text-slate-100';
    if (ocupacion >= 1) {
      container = 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-900 dark:text-red-200';
      dot = 'bg-red-500';
      horaColor = 'text-red-800 dark:text-red-200';
    } else if (ocupacion >= 0.5) {
      container = 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-200';
      dot = 'bg-amber-500';
      horaColor = 'text-amber-800 dark:text-amber-200';
    } else if (reservas > 0) {
      container = 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/30 dark:border-blue-900 dark:text-blue-200';
      dot = 'bg-blue-500';
      horaColor = 'text-blue-800 dark:text-blue-200';
    } else {
      container = 'bg-emerald-50/60 border-emerald-200/60 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-900/30 dark:text-emerald-300';
      dot = 'bg-emerald-500';
      horaColor = 'text-emerald-800 dark:text-emerald-300';
    }
    return (
      <div className={`flex items-center gap-1.5 w-full rounded-md border px-2 py-1 text-[10px] sm:text-[11px] leading-none ${container}`}>
        <Clock size={11} className="shrink-0 opacity-70" />
        <span className={`font-mono font-bold ${horaColor}`}>{r.block.horaInicio}</span>
        {/* PC: detalle legible */}
        <span className="hidden sm:inline-flex items-center gap-1 ml-1">
          <span className="inline-flex items-center gap-0.5 opacity-80">
            <Users size={10} />
            {disponibles} disp.
          </span>
          <span className="opacity-30">•</span>
          <span className={reservas > 0 ? 'font-bold' : 'font-medium'}>{reservas} res.</span>
        </span>
        {/* Móvil: minimalista */}
        <span className="sm:hidden ml-auto inline-flex items-center gap-1 font-bold">
          <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
          {reservas}/{total || '—'}
        </span>
      </div>
    );
  }

  return <span className="truncate text-[11px]">{event.title}</span>;
}
