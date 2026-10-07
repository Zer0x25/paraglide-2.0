"use client";

import {
  Lock,
  Phone,
  Calendar as CalendarIcon,
  Ticket,
} from 'lucide-react';
import type { ReservaConPasajeros, PasajeroConVuelos, VueloConPiloto } from '@/types/reservaDetalle';
import type { ReservaCardState } from '../utils/reservaCardState';
import { ReservaCardMenu } from './ReservaCardMenu';

interface ReservaCardHeaderProps {
  reserva: ReservaConPasajeros;
  state: ReservaCardState;
  onEdit: (reserva: ReservaConPasajeros) => void;
  onDelete: (reserva: ReservaConPasajeros) => void;
  onOpenPagos: (reserva: ReservaConPasajeros) => void;
  onOpenDesagendar?: (reserva: ReservaConPasajeros) => void;
  onReabrir?: (reserva: ReservaConPasajeros) => void;
}

export function ReservaCardHeader({
  reserva,
  state,
  onEdit,
  onDelete,
  onOpenPagos,
  onOpenDesagendar,
  onReabrir,
}: ReservaCardHeaderProps) {
  const {
    esCerrada,
    badgeEstado,
    estaTotalmenteAgendado,
    estaParcialmenteAgendado,
    pasajerosAgendados,
    totalPasajeros,
  } = state;

  return (
    <>
      {/* Encabezado de la Tarjeta */}
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <span className="text-xs font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wider bg-blue-50 dark:bg-blue-950/80 px-2.5 py-1 rounded-xl">
          #{reserva.numeroReserva || reserva.id}
        </span>

        <div className="flex items-center gap-1.5 shrink-0">
          {esCerrada && (
            <span
              className="text-[11px] font-bold bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200 px-2.5 py-0.5 rounded-full flex items-center gap-1"
              title="Cerrada e inmutable (historial contable)"
            >
              <Lock size={10} className="text-slate-500 dark:text-slate-400" />
              Cerrada
            </span>
          )}
          {badgeEstado === 'COMPLETADA' ? (
            <span className="text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2.5 py-0.5 rounded-full">
              ✓ Completada
            </span>
          ) : badgeEstado === 'CANCELADA' ? (
            <span className="text-[11px] font-bold bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 px-2.5 py-0.5 rounded-full">
              ✗ Cancelada<span className="sr-only">CANCELADA</span>
            </span>
          ) : estaTotalmenteAgendado ? (
            <span className="text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2.5 py-0.5 rounded-full">
              ✓ Agendado
            </span>
          ) : estaParcialmenteAgendado ? (
            <span className="text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 px-2.5 py-0.5 rounded-full">
              ⏳ Parcial ({pasajerosAgendados}/{totalPasajeros})
            </span>
          ) : (
            <span className="text-[11px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 px-2.5 py-0.5 rounded-full">
              📅 Sin Agendar
            </span>
          )}

          <ReservaCardMenu
            reserva={reserva}
            state={state}
            onEdit={onEdit}
            onDelete={onDelete}
            onOpenPagos={onOpenPagos}
            onOpenDesagendar={onOpenDesagendar}
            onReabrir={onReabrir}
          />
        </div>
      </div>

      {/* Nombre y Contacto */}
      <div className="space-y-2 mb-4">
        <div>
          <h3 className="font-bold text-lg text-slate-900 dark:text-white leading-tight">
            {reserva.nombreTitular}
          </h3>
          <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1 pt-1.5">
            {reserva.telefono ? (
              <a
                href={`tel:${reserva.telefono.replace(/[^+\d]/g, '')}`}
                className="flex items-center hover:text-blue-600 dark:hover:text-blue-400 hover:underline underline-offset-2 transition"
                aria-label={`Llamar a ${reserva.telefono}`}
              >
                <Phone size={12} className="mr-1.5 text-slate-400" />
                {reserva.telefono}
              </a>
            ) : (
              <p className="flex items-center">
                <Phone size={12} className="mr-1.5 text-slate-400" />
                Sin teléfono
              </p>
            )}
            {(() => {
              const allVuelos = (reserva.pasajeros || [])
                .flatMap((p: PasajeroConVuelos) => (p.vuelos || []) as VueloConPiloto[])
                .filter((v) => v.estado !== 'CANCELADO');
              const vuelosOrdenados = [...allVuelos].sort(
                (a, b) => new Date(a.fechaHora as string | Date).getTime() - new Date(b.fechaHora as string | Date).getTime()
              );
              const vueloRef = vuelosOrdenados[0];
              return (
                <p className="flex items-center gap-1.5">
                  <CalendarIcon size={12} className="text-slate-400 shrink-0" />
                  <span>
                    {vueloRef
                      ? `${new Date(vueloRef.fechaHora as string | Date).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })} ${new Date(vueloRef.fechaHora as string | Date).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`
                      : reserva.fechaAgenda
                      ? `${new Date(reserva.fechaAgenda as string | Date).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })} ${reserva.horaAgenda ? `a las ${reserva.horaAgenda}` : ''}`.trim()
                      : 'sin agenda'}
                  </span>
                  {Boolean(reserva.esGiftCard) && (
                    <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 px-2 py-0.5 rounded-full text-[10px] font-bold">
                      <Ticket size={10} /> Giftcard
                    </span>
                  )}
                </p>
              );
            })()}
          </div>
        </div>
      </div>
    </>
  );
}
