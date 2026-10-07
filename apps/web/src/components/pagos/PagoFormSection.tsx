"use client";

import { 
  PlusCircle, DollarSign, Smartphone, Banknote, CreditCard, 
  Trash2, Undo2, CheckCircle2
} from 'lucide-react';
import { formatCLP } from '../../utils/format';
import { Button } from '../ui';
import type { MetodoPago } from '@parapente/shared';

export interface PagoItem {
  id: number;
  monto: number;
  metodoPago: MetodoPago;
  fecha: string;
  comprobante?: string | null;
  notas?: string | null;
}

export interface PendingPago {
  monto: number;
  metodoPago: MetodoPago;
  comprobante: string | null;
  notas: string | null;
}

interface PagoFormSectionProps {
  saldoPendiente: number;
  monto: number | '';
  setMonto: (val: number | '') => void;
  metodoPago: MetodoPago;
  setMetodoPago: (val: MetodoPago) => void;
  comprobante: string;
  setComprobante: (val: string) => void;
  notas: string;
  setNotas: (val: string) => void;
  onAddPago: (e: React.FormEvent) => void;
  pagos: PagoItem[];
  pendingPagos: PendingPago[];
  deletingPagos: number[];
  onToggleDeletePago: (pagoId: number) => void;
  onRemovePendingPago: (idx: number) => void;
  esCancelada?: boolean;
}

export function getMetodoIcon(metodo: MetodoPago) {
  switch (metodo) {
    case 'TRANSFERENCIA':
      return <Smartphone size={15} className="text-blue-500" />;
    case 'EFECTIVO':
      return <Banknote size={15} className="text-emerald-500" />;
    case 'WEBPAY':
    case 'TARJETA':
      return <CreditCard size={15} className="text-purple-500" />;
    default:
      return <DollarSign size={15} className="text-slate-500" />;
  }
}

export function PagoFormSection({
  saldoPendiente,
  monto,
  setMonto,
  metodoPago,
  setMetodoPago,
  comprobante,
  setComprobante,
  notas,
  setNotas,
  onAddPago,
  pagos,
  pendingPagos,
  deletingPagos,
  onToggleDeletePago,
  onRemovePendingPago,
  esCancelada,
}: PagoFormSectionProps) {
  const estaPagado = saldoPendiente <= 0;
  const cancelada = Boolean(esCancelada);
  return (
    <div className="space-y-6">
      {!cancelada && (
        estaPagado ? (
        <div className="flex items-center gap-2.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 rounded-3xl px-4 py-3.5">
          <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
          <div>
            <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">Sin saldo pendiente — reserva pagada por completo</p>
            <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400/70">No es necesario registrar más abonos.</p>
          </div>
        </div>
      ) : (
        <form onSubmit={onAddPago} className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-3xl border border-slate-200 dark:border-slate-700/80 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <PlusCircle size={16} className="text-blue-600 dark:text-blue-400" />
              Registrar Nuevo Abono / Pago
            </h3>
            <button
              type="button"
              onClick={() => setMonto(saldoPendiente)}
              className="text-[11px] bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 hover:bg-blue-100 border border-blue-200 dark:border-blue-800 px-2.5 py-1 rounded-xl transition font-bold cursor-pointer"
            >
              Pagar Saldo Restante ({formatCLP(saldoPendiente)})
            </button>
          </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Monto ($ CLP) <span className="text-red-500">*</span>
            </label>
            <input 
              type="number"
              placeholder="Ej: 30000"
              value={monto}
              onChange={e => setMonto(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Método de Pago
            </label>
            <select
              value={metodoPago}
              onChange={e => setMetodoPago(e.target.value as MetodoPago)}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="TRANSFERENCIA">📱 Transferencia Bancaria</option>
              <option value="EFECTIVO">💵 Efectivo (Pista)</option>
              <option value="WEBPAY">🌐 Webpay / Débito</option>
              <option value="TARJETA">💳 Tarjeta de Crédito</option>
              <option value="OTRO">🏷️ Otro Medio</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
              N° Comprobante / Transacción
            </label>
            <input 
              type="text"
              placeholder="Ej: Op-98124 o Banco Estado"
              value={comprobante}
              onChange={e => setComprobante(e.target.value)}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Notas / Observación
            </label>
            <input 
              type="text"
              placeholder="Ej: Pago de Juan y Pedro"
              value={notas}
              onChange={e => setNotas(e.target.value)}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <Button
            type="submit"
            disabled={!monto}
            className="py-2.5 px-5 rounded-2xl text-xs shadow-md"
          >
            <DollarSign size={15} />
            <span>Registrar Abono</span>
          </Button>
        </div>
        </form>
      )
      )}

      {/* Lista de Transacciones Registradas */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Historial de Transacciones ({pagos.length + pendingPagos.length})
        </h3>

        {pagos.length === 0 && pendingPagos.length === 0 ? (
          <div className="text-center p-6 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-slate-400 text-xs">
            No hay transacciones registradas para esta reserva.
          </div>
        ) : (
          <div className="space-y-2">
            {/* Pagos ya registrados en el servidor */}
            {pagos.map((p) => {
              const isDeleting = deletingPagos.includes(p.id);
              return (
                <div
                  key={p.id}
                  className={`flex items-center justify-between p-3.5 rounded-2xl border bg-white dark:bg-slate-800/80 shadow-2xs transition ${
                    isDeleting
                      ? 'border-red-200 dark:border-red-900/60 bg-red-50/40 dark:bg-red-950/20'
                      : 'border-slate-100 dark:border-slate-800 hover:border-slate-200'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                      {getMetodoIcon(p.metodoPago)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`font-extrabold text-sm text-slate-800 dark:text-slate-100 ${isDeleting ? 'line-through opacity-50' : ''}`}>
                          {formatCLP(p.monto)}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 ${isDeleting ? 'line-through opacity-50' : ''}`}>
                          {p.metodoPago}
                        </span>
                        {isDeleting && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300">
                            Eliminar
                          </span>
                        )}
                      </div>
                      <div className={`text-[11px] text-slate-400 flex items-center gap-2 mt-0.5 ${isDeleting ? 'line-through opacity-50' : ''}`}>
                        <span>{new Date(p.fecha).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                        {p.comprobante && <span>• Comprobante: {p.comprobante}</span>}
                        {p.notas && <span>• {p.notas}</span>}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onToggleDeletePago(p.id)}
                    className={`p-2.5 rounded-lg transition cursor-pointer ${
                      isDeleting
                        ? 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                        : 'text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50'
                    }`}
                    title={isDeleting ? 'Cancelar eliminación' : 'Eliminar este pago'}
                    aria-label={isDeleting ? 'Cancelar eliminación' : 'Eliminar este pago'}
                  >
                    {isDeleting ? <Undo2 size={16} /> : <Trash2 size={16} />}
                  </button>
                </div>
              );
            })}

            {/* Abonos en borrador local (aún no guardados) */}
            {pendingPagos.map((p, idx) => (
              <div
                key={`pending-${idx}`}
                className="flex items-center justify-between p-3.5 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-2xs transition"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                    {getMetodoIcon(p.metodoPago)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-slate-800 dark:text-slate-100">
                        {formatCLP(p.monto)}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                        {p.metodoPago}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                        Nuevo
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                      <span>Pendiente de guardar</span>
                      {p.comprobante && <span>• Comprobante: {p.comprobante}</span>}
                      {p.notas && <span>• {p.notas}</span>}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onRemovePendingPago(idx)}
                  className="p-2.5 text-slate-300 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/50 transition cursor-pointer"
                  title="Quitar abono pendiente"
                  aria-label="Quitar abono pendiente"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
