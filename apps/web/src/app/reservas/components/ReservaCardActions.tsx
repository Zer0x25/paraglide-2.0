"use client";

import Link from 'next/link';
import { Ticket, DollarSign, MessageSquare, Zap, Calendar as CalendarIcon, XCircle } from 'lucide-react';
import type { ReservaConPasajeros } from '@/types/reservaDetalle';
import type { ReservaCardState } from '../utils/reservaCardState';

interface ReservaCardActionsProps {
  reserva: ReservaConPasajeros;
  state: ReservaCardState;
  onOpenPagos: (reserva: ReservaConPasajeros) => void;
  onOpenVoucher: (reserva: ReservaConPasajeros) => void;
  onOpenAgendar: (reserva: ReservaConPasajeros) => void;
  onOpenCancelar: (reserva: ReservaConPasajeros) => void;
  onWhatsAppConfirmation: (reserva: ReservaConPasajeros) => void;
}

export function ReservaCardActions({
  reserva,
  state,
  onOpenPagos,
  onOpenVoucher,
  onOpenAgendar,
  onOpenCancelar,
  onWhatsAppConfirmation,
}: ReservaCardActionsProps) {
  const {
    estadoReserva,
    esCerrada,
    puedeVerVoucher,
    estaTotalmenteAgendado,
    estaSinAgendar,
  } = state;

  if (estadoReserva === 'COMPLETADA' || esCerrada) {
    return (
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onOpenVoucher(reserva)}
            className="w-full flex items-center justify-center space-x-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition border bg-slate-50 hover:bg-slate-100 text-slate-700 dark:bg-slate-800/80 dark:hover:bg-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 cursor-pointer min-h-10"
            title="Ver / descargar Voucher y Ticket de Vuelo"
          >
            <Ticket size={13} className="shrink-0 text-indigo-500" />
            <span>Voucher</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenPagos(reserva)}
            className="w-full flex items-center justify-center space-x-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition border bg-slate-50 hover:bg-slate-100 text-slate-700 dark:bg-slate-800/80 dark:hover:bg-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 cursor-pointer min-h-10"
            title="Ver pagos registrados"
          >
            <DollarSign size={13} className="shrink-0 text-emerald-500" />
            <span>Ver Pagos ({reserva.pagos?.length || 0})</span>
          </button>
        </div>
      </div>
    );
  }

  if (estadoReserva === 'CANCELADA') {
    return (
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onOpenVoucher(reserva)}
            className="w-full flex items-center justify-center space-x-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition border bg-slate-50 hover:bg-slate-100 text-slate-700 dark:bg-slate-800/80 dark:hover:bg-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 cursor-pointer min-h-10"
            title="Ver Voucher / Ticket de Vuelo"
          >
            <Ticket size={13} className="shrink-0 text-slate-400" />
            <span>Voucher</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenPagos(reserva)}
            className="w-full flex items-center justify-center space-x-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition border bg-slate-50 hover:bg-slate-100 text-slate-700 dark:bg-slate-800/80 dark:hover:bg-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 cursor-pointer min-h-10"
            title="Ver pagos o reembolsos"
          >
            <DollarSign size={13} className="shrink-0 text-slate-400" />
            <span>Ver Pagos ({reserva.pagos?.length || 0})</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
      {/* Botón Gestión de Pagos / Abonos */}
      <button
        type="button"
        onClick={() => onOpenPagos(reserva)}
        className="w-full flex items-center justify-between py-2.5 px-3 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition border border-slate-200 dark:border-slate-700 cursor-pointer min-h-10"
      >
        <div className="flex items-center space-x-1.5">
          <DollarSign size={14} className="text-emerald-600 dark:text-emerald-400" />
          <span>Gestionar Pagos y Abonos</span>
        </div>
        <span className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full font-bold">
          {reserva.pagos?.length || 0} {reserva.pagos?.length === 1 ? 'pago' : 'pagos'}
        </span>
      </button>

      {(puedeVerVoucher || estaTotalmenteAgendado) && (
        <div className={`grid gap-2 ${puedeVerVoucher && estaTotalmenteAgendado ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {puedeVerVoucher && (
            <button
              type="button"
              onClick={() => onOpenVoucher(reserva)}
              title="Ver / descargar Voucher y Ticket de Vuelo"
              className="w-full flex items-center justify-center space-x-1 py-2.5 px-1.5 rounded-xl text-[11px] font-bold transition border min-h-10 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:hover:bg-indigo-950 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900 cursor-pointer"
            >
              <Ticket size={13} className="shrink-0" />
              <span>Voucher</span>
            </button>
          )}
          {estaTotalmenteAgendado && (
            <button
              type="button"
              onClick={() => onWhatsAppConfirmation(reserva)}
              title="Enviar confirmación por WhatsApp"
              className="w-full flex items-center justify-center space-x-1 py-2.5 px-1.5 rounded-xl text-[11px] font-bold transition border min-h-10 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:hover:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900 cursor-pointer"
            >
              <MessageSquare size={13} className="shrink-0" />
              <span>WhatsApp</span>
            </button>
          )}
        </div>
      )}

      {/* Acciones de ciclo de vida + Agendamiento (reservas SIN_AGENDAR) */}
      {estaSinAgendar && (
        <div className="space-y-1.5">
          {!estaTotalmenteAgendado ? (
            <button
              type="button"
              onClick={() => onOpenAgendar(reserva)}
              className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-blue-600/20 transition cursor-pointer min-h-10"
            >
              <Zap size={14} className="text-yellow-300 fill-yellow-300" />
              <span>Agendar</span>
            </button>
          ) : (
            <Link
              href={`/calendario?reservaId=${reserva.id}`}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition font-bold text-xs shadow-xs min-h-10"
            >
              <CalendarIcon size={14} />
              <span>Reagendar / Ver en Calendario</span>
            </Link>
          )}
        </div>
      )}

      {/* Acciones para reservas agendadas: Calendario + Cancelar */}
      {!estaSinAgendar && (
        <div className="space-y-1.5">
          <Link
            href={`/calendario?reservaId=${reserva.id}`}
            className="w-full flex items-center justify-center space-x-1.5 px-3 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition font-bold text-xs shadow-xs min-h-10 text-center"
            title="Ver en el calendario o reagendar horarios"
          >
            <CalendarIcon size={13} className="shrink-0" />
            <span>Calendario</span>
          </Link>

          <button
            type="button"
            onClick={() => onOpenCancelar(reserva)}
            className="w-full flex items-center justify-center space-x-2 py-2 px-4 bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-950/60 dark:hover:bg-red-950 dark:text-red-300 rounded-xl text-xs font-bold transition border border-red-200 dark:border-red-900 cursor-pointer min-h-9"
          >
            <XCircle size={14} className="shrink-0" />
            <span>Cancelar Reserva</span>
          </button>
        </div>
      )}
    </div>
  );
}
