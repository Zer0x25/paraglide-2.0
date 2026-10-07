"use client";

import { Lock, CheckCircle2, AlertTriangle, CreditCard, Clock } from 'lucide-react';
import { formatCLP } from '../../../utils/format';
import type { ReservaConPasajeros } from '../../../types/reservaDetalle';

interface VueloModalFinancialDetailProps {
  infoReserva: ReservaConPasajeros;
  isEditing: boolean;
  esCerrada: boolean;
  editingFlightEstado?: string;
  paso15Min: boolean;
  horaDesbloqueo: string | null;
  isCompleting: boolean;
  onOpenPagos?: (reserva: ReservaConPasajeros) => void;
  onMarcarCompletada?: () => Promise<void>;
}

export function VueloModalFinancialDetail({
  infoReserva,
  isEditing,
  esCerrada,
  editingFlightEstado,
  paso15Min,
  horaDesbloqueo,
  isCompleting,
  onOpenPagos,
  onMarcarCompletada,
}: VueloModalFinancialDetailProps) {
  const total = infoReserva.valorTotal || 0;
  const abono = infoReserva.abono || 0;
  const saldo = Math.max(0, total - abono);
  const tieneSaldo = saldo > 0;
  const tieneHistorial = total <= 0 || (infoReserva.pagos && infoReserva.pagos.length > 0);
  const faltaHistorial = !tieneSaldo && !tieneHistorial;
  const esCompletada = editingFlightEstado === 'COMPLETADO' || infoReserva.estado === 'COMPLETADA';
  const esCancelada = editingFlightEstado === 'CANCELADO' || infoReserva.estado === 'CANCELADA';

  return (
    <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-xs space-y-2">
      <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1 border-b border-slate-200 dark:border-slate-700 pb-1.5">
        <span className="font-bold tracking-wide">
          DETALLE DE PAGO (RESERVA #{infoReserva.numeroReserva || infoReserva.id})
        </span>
        <span
          className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
            infoReserva.estadoPago === 'PAGADO'
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
              : infoReserva.estadoPago === 'DEVUELTO'
              ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
          }`}
        >
          {infoReserva.estadoPago}
        </span>
      </div>

      <div className="flex justify-between text-slate-700 dark:text-slate-300">
        <span>Valor Total Grupo:</span>
        <span className="font-semibold text-slate-900 dark:text-white">{formatCLP(total)}</span>
      </div>

      <div className="flex justify-between text-slate-700 dark:text-slate-300">
        <span>Abono Registrado:</span>
        <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCLP(abono)}</span>
      </div>

      <div className="flex justify-between text-slate-900 dark:text-white border-t border-slate-200 dark:border-slate-700 pt-1.5 font-bold text-sm">
        <span>Saldo Pendiente:</span>
        <span className="text-amber-600 dark:text-amber-400">{formatCLP(saldo)}</span>
      </div>

      {/* Acciones de Pago y Ciclo de Vida cuando se edita un vuelo existente */}
      {isEditing && (
        <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/80 space-y-2">
          {esCerrada ? (
            <div className="p-3 bg-slate-100 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock size={15} className="text-slate-500 shrink-0" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Valores conciliados y congelados en snapshot inmutable
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                Total: {formatCLP(total)}
              </span>
            </div>
          ) : esCompletada ? (
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>✓ Este vuelo y su reserva ya fueron completados con éxito.</span>
            </div>
          ) : esCancelada ? (
            <div className="p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl flex items-center gap-2 text-xs font-bold text-red-700 dark:text-red-300">
              <AlertTriangle size={16} className="text-red-600 dark:text-red-400 shrink-0" />
              <span>Este vuelo o reserva se encuentra cancelado.</span>
            </div>
          ) : tieneSaldo ? (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <span className="font-bold text-amber-800 dark:text-amber-200 block">
                  Saldo pendiente: {formatCLP(saldo)}
                </span>
                <span className="text-[11px] text-amber-700 dark:text-amber-300">
                  {paso15Min
                    ? 'Hora de vuelo cumplida (+15 min). Registra el pago para poder marcar como completada.'
                    : 'Registra el pago pendiente de este vuelo.'}
                </span>
              </div>
              {onOpenPagos && (
                <button
                  type="button"
                  onClick={() => onOpenPagos(infoReserva)}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition cursor-pointer shrink-0"
                >
                  <CreditCard size={14} />
                  <span>Registrar Pago / Saldar</span>
                </button>
              )}
            </div>
          ) : faltaHistorial ? (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <span className="font-bold text-amber-800 dark:text-amber-200 block">
                  Sin comprobante en historial de pagos
                </span>
                <span className="text-[11px] text-amber-700 dark:text-amber-300">
                  Para poder marcar como completada, registra el comprobante en el historial de pagos.
                </span>
              </div>
              {onOpenPagos && (
                <button
                  type="button"
                  onClick={() => onOpenPagos(infoReserva)}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition cursor-pointer shrink-0"
                >
                  <CreditCard size={14} />
                  <span>Registrar en Historial</span>
                </button>
              )}
            </div>
          ) : paso15Min ? (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <span className="font-bold text-emerald-800 dark:text-emerald-200 flex items-center gap-1.5">
                  <CheckCircle2 size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                  Hora cumplida (+15 min) y pago al día
                </span>
                <span className="text-[11px] text-emerald-700 dark:text-emerald-300 block mt-0.5">
                  El vuelo ya fue realizado. Puedes marcar la reserva como completada.
                </span>
              </div>
              {onMarcarCompletada && (
                <button
                  type="button"
                  disabled={isCompleting}
                  onClick={onMarcarCompletada}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 transition cursor-pointer shrink-0 disabled:opacity-50"
                >
                  <CheckCircle2 size={15} />
                  <span>{isCompleting ? 'Completando...' : 'Marcar como Completada'}</span>
                </button>
              )}
            </div>
          ) : (
            <div className="p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <Clock size={14} className="text-slate-400 shrink-0" />
              <span>
                Pago al día. Disponible para completar 15 min después del vuelo{' '}
                {horaDesbloqueo ? `(a las ${horaDesbloqueo})` : ''}.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
