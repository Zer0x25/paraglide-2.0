"use client";

import { CheckCircle2, Check, ShieldCheck, MessageSquare, ChevronDown } from 'lucide-react';
import type { ReservaConPasajeros, PasajeroConVuelos, VueloConPiloto } from '@/types/reservaDetalle';

interface ReservaCardPassengerListProps {
  reserva: ReservaConPasajeros;
  totalPasajeros: number;
  todosDeslindesFirmados: boolean;
  pasajerosActivos: PasajeroConVuelos[];
  pasajerosCompletados: PasajeroConVuelos[];
  estadoReserva: string;
  onOpenFirma: (pasajero: PasajeroConVuelos) => void;
  onWhatsAppPiloto: (reserva: ReservaConPasajeros, pasajero: PasajeroConVuelos, vuelo: VueloConPiloto) => void;
}

export function ReservaCardPassengerList({
  reserva,
  totalPasajeros,
  todosDeslindesFirmados,
  pasajerosActivos,
  pasajerosCompletados,
  estadoReserva,
  onOpenFirma,
  onWhatsAppPiloto,
}: ReservaCardPassengerListProps) {
  return (
    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-3.5 border border-slate-100 dark:border-slate-800 mb-4 space-y-2">
      <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase">
        <span>Pasajeros ({totalPasajeros})</span>
        {todosDeslindesFirmados ? (
          <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-extrabold text-[10px]">
            <CheckCircle2 size={12} /> Deslindes OK
          </span>
        ) : (
          <span className="text-amber-600 dark:text-amber-400 text-[10px]">
            Faltan firmas
          </span>
        )}
      </div>

      <ul className="text-xs space-y-2">
        {pasajerosActivos.map((p: PasajeroConVuelos) => {
          const sortedVuelos = (p.vuelos || []).sort(
            (a: VueloConPiloto, b: VueloConPiloto) =>
              new Date(b.fechaHora as string | Date).getTime() - new Date(a.fechaHora as string | Date).getTime()
          );
          const latestVuelo = sortedVuelos[0];
          let estadoPax = latestVuelo ? latestVuelo.estado : 'SIN_AGENDAR';

          if (estadoPax === 'AGENDADO' && sortedVuelos.some((v: VueloConPiloto) => v.estado === 'CANCELADO')) {
            estadoPax = 'REAGENDADO';
          }

          return (
            <li key={p.id} className="pt-1.5 border-t border-slate-200/50 dark:border-slate-700/50 first:border-0 first:pt-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {p.nombre}
                  </span>
                  {estadoPax === 'SIN_AGENDAR' && estadoReserva !== 'COMPLETADA' && (
                    <span className="text-[9px] bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 px-1.5 py-0.5 rounded-md font-bold uppercase">
                      Sin Agendar
                    </span>
                  )}
                  {estadoPax === 'REAGENDADO' && estadoReserva !== 'COMPLETADA' && (
                    <span className="text-[9px] bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300 px-1.5 py-0.5 rounded-md font-bold uppercase">
                      Re-agendado
                    </span>
                  )}
                  {estadoPax === 'CANCELADO' && (
                    <span className="text-[9px] bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300 px-1.5 py-0.5 rounded-md font-bold uppercase">
                      Cancelado
                    </span>
                  )}
                  {(estadoPax === 'COMPLETADO' || estadoReserva === 'COMPLETADA' || p.estado === 'VUELO_COMPLETADO') && (
                    <span className="text-[9px] bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 px-1.5 py-0.5 rounded-md font-bold uppercase">
                      ✓ Completado
                    </span>
                  )}

                  {p.peso && <span className="text-slate-400 ml-0.5 text-[10px]">({p.peso}kg)</span>}
                </div>
                <div className="flex items-center gap-1.5">
                  {p.firmaDeslinde ? (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold inline-flex items-center gap-0.5">
                      <Check size={11} /> Firmado
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onOpenFirma(p)}
                      className="text-[10px] bg-amber-100 hover:bg-amber-200 text-amber-900 dark:bg-amber-950 dark:text-amber-300 px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-1 transition cursor-pointer"
                    >
                      <ShieldCheck size={11} /> Firmar en Pista
                    </button>
                  )}
                </div>
              </div>
              {(p.vuelos || [])
                .filter((v: VueloConPiloto) => v.estado !== 'CANCELADO' && Boolean(v.piloto))
                .map((v: VueloConPiloto) => {
                  return (
                    <div key={v.id} className="flex items-center justify-between gap-2 mt-1.5 pl-1">
                      <span className="text-[10px] text-slate-400 truncate">
                        {v.piloto!.nombre}
                      </span>
                      <button
                        type="button"
                        onClick={() => onWhatsAppPiloto(reserva, p, v)}
                        aria-label={`Notificar por WhatsApp a ${v.piloto!.nombre}`}
                        className="text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:hover:bg-indigo-950 dark:text-indigo-300 px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-1 transition shrink-0 cursor-pointer"
                        title={`Notificar por WhatsApp a ${v.piloto!.nombre}`}
                      >
                        <MessageSquare size={10} /> Piloto
                      </button>
                    </div>
                  );
                })}
            </li>
          );
        })}
      </ul>

      {pasajerosCompletados.length > 0 && (
        <details className="group mt-2">
          <summary className="text-[11px] font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 cursor-pointer list-none flex items-center gap-1 select-none py-1">
            <ChevronDown size={14} className="group-open:-rotate-180 transition-transform duration-200" />
            Ver {pasajerosCompletados.length} pasajero{pasajerosCompletados.length !== 1 ? 's' : ''} archivado{pasajerosCompletados.length !== 1 ? 's' : ''}
          </summary>
          <ul className="text-xs space-y-2 mt-2 opacity-75 bg-slate-100/50 dark:bg-slate-900/50 p-2 rounded-lg">
            {pasajerosCompletados.map((p: PasajeroConVuelos) => (
              <li key={p.id} className="pt-1.5 border-t border-slate-200/50 dark:border-slate-700/50 first:border-0 first:pt-0">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 line-through">
                      {p.nombre}
                    </span>
                    {p.peso && <span className="text-slate-400 ml-1.5">({p.peso}kg)</span>}
                  </div>
                  <span className="text-[10px] bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full font-bold">
                    COMPLETADO
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
