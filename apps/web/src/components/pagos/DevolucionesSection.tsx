"use client";

import { RotateCcw, Trash2, Undo2 } from 'lucide-react';
import { formatCLP } from '../../utils/format';
import { Button } from '../ui';
import type { MetodoPago } from '@parapente/shared';

export interface DevolucionItem {
  id: number;
  monto: number;
  metodoPago: MetodoPago;
  fecha: string;
  comprobante?: string | null;
  notas?: string | null;
}

export interface PendingDevolucion {
  monto: number;
  metodoPago: MetodoPago;
  comprobante: string | null;
  notas: string | null;
}

interface DevolucionesSectionProps {
  puedeDevolver: boolean;
  montoDisponibleDevolucion?: number;
  devoluciones: DevolucionItem[];
  pendingDevoluciones: PendingDevolucion[];
  deletingDevoluciones: number[];
  montoDevolucion: number | '';
  setMontoDevolucion: (val: number | '') => void;
  metodoDevolucion: MetodoPago;
  setMetodoDevolucion: (val: MetodoPago) => void;
  comprobanteDevolucion: string;
  setComprobanteDevolucion: (val: string) => void;
  notasDevolucion: string;
  setNotasDevolucion: (val: string) => void;
  onAddDevolucion: (e: React.FormEvent) => void;
  onToggleDeleteDevolucion: (id: number) => void;
  onRemovePendingDevolucion: (idx: number) => void;
}

export function DevolucionesSection({
  puedeDevolver,
  montoDisponibleDevolucion,
  devoluciones,
  pendingDevoluciones,
  deletingDevoluciones,
  montoDevolucion,
  setMontoDevolucion,
  metodoDevolucion,
  setMetodoDevolucion,
  comprobanteDevolucion,
  setComprobanteDevolucion,
  notasDevolucion,
  setNotasDevolucion,
  onAddDevolucion,
  onToggleDeleteDevolucion,
  onRemovePendingDevolucion,
}: DevolucionesSectionProps) {
  if (!puedeDevolver) return null;
  const sinMontoDisponible = typeof montoDisponibleDevolucion === 'number' && montoDisponibleDevolucion <= 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
          <RotateCcw size={16} className="text-red-600 dark:text-red-400" />
          Devoluciones
          {devoluciones.length + pendingDevoluciones.length > 0 && (
            <span className="text-[10px] font-bold bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 px-2 py-0.5 rounded-full">
              {devoluciones.length + pendingDevoluciones.length}
            </span>
          )}
        </h3>
      </div>

      {sinMontoDisponible ? (
        <div className="flex items-center gap-2.5 bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-3xl px-4 py-3.5">
          <RotateCcw size={18} className="text-slate-400 shrink-0" />
          <div>
            <p className="text-xs font-bold text-slate-600 dark:text-slate-300">Sin monto disponible para devolución</p>
            <p className="text-[11px] text-slate-500/80 dark:text-slate-400/70">Todo lo abonado ya fue devuelto o no hay abonos para devolver.</p>
          </div>
        </div>
      ) : (
        <form onSubmit={onAddDevolucion} className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-3xl border border-red-200/60 dark:border-red-900/40 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Monto a Devolver ($ CLP) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              placeholder="Ej: 30000"
              value={montoDevolucion}
              onChange={e => setMontoDevolucion(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Método de Devolución
            </label>
            <select
              value={metodoDevolucion}
              onChange={e => setMetodoDevolucion(e.target.value as MetodoPago)}
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
              value={comprobanteDevolucion}
              onChange={e => setComprobanteDevolucion(e.target.value)}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Notas / Observación
            </label>
            <input
              type="text"
              placeholder="Ej: Devolución por cancelación"
              value={notasDevolucion}
              onChange={e => setNotasDevolucion(e.target.value)}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <Button
            type="submit"
            variant="danger"
            disabled={!montoDevolucion}
            className="py-2.5 px-5 rounded-2xl text-xs shadow-md cursor-pointer"
          >
            <RotateCcw size={15} />
            <span>Registrar Devolución</span>
          </Button>
        </div>
        </form>
      )}

      {/* Lista: devoluciones registradas + borrador local */}
      {devoluciones.length + pendingDevoluciones.length > 0 ? (
        <div className="space-y-2">
          {devoluciones.map((d) => {
            const isDeleting = deletingDevoluciones.includes(d.id);
            return (
              <div
                key={d.id}
                className={`flex items-center justify-between p-3.5 rounded-2xl border bg-white dark:bg-slate-800/80 shadow-2xs transition ${
                  isDeleting
                    ? 'border-red-200 dark:border-red-900/60 bg-red-50/40 dark:bg-red-950/20'
                    : 'border-slate-100 dark:border-slate-800 hover:border-slate-200'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-xl bg-red-50 dark:bg-red-950/40 flex items-center justify-center shrink-0">
                    <RotateCcw size={15} className="text-red-500" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`font-extrabold text-sm text-slate-800 dark:text-slate-100 ${isDeleting ? 'line-through opacity-50' : ''}`}>
                        {formatCLP(d.monto)}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 ${isDeleting ? 'line-through opacity-50' : ''}`}>
                        {d.metodoPago}
                      </span>
                      {isDeleting && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300">
                          Eliminar
                        </span>
                      )}
                    </div>
                    <div className={`text-[11px] text-slate-400 flex items-center gap-2 mt-0.5 ${isDeleting ? 'line-through opacity-50' : ''}`}>
                      <span>{new Date(d.fecha).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                      {d.comprobante && <span>• Comprobante: {d.comprobante}</span>}
                      {d.notas && <span>• {d.notas}</span>}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onToggleDeleteDevolucion(d.id)}
                  className={`p-2.5 rounded-lg transition cursor-pointer ${
                    isDeleting
                      ? 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                      : 'text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50'
                  }`}
                  title={isDeleting ? 'Cancelar eliminación' : 'Eliminar esta devolución'}
                  aria-label={isDeleting ? 'Cancelar eliminación' : 'Eliminar esta devolución'}
                >
                  {isDeleting ? <Undo2 size={16} /> : <Trash2 size={16} />}
                </button>
              </div>
            );
          })}

          {/* Devoluciones en borrador local (aún no guardadas) */}
          {pendingDevoluciones.map((d, idx) => (
            <div
              key={`pending-dev-${idx}`}
              className="flex items-center justify-between p-3.5 rounded-2xl border border-red-200 dark:border-red-900/60 bg-red-50/40 dark:bg-red-950/20 shadow-2xs transition"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-red-50 dark:bg-red-950/40 flex items-center justify-center shrink-0">
                  <RotateCcw size={15} className="text-red-500" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-slate-800 dark:text-slate-100">
                      {formatCLP(d.monto)}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                      {d.metodoPago}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      Nuevo
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                    <span>Pendiente de guardar</span>
                    {d.comprobante && <span>• Comprobante: {d.comprobante}</span>}
                    {d.notas && <span>• {d.notas}</span>}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onRemovePendingDevolucion(idx)}
                className="p-2.5 text-slate-300 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/50 transition cursor-pointer"
                title="Quitar devolución pendiente"
                aria-label="Quitar devolución pendiente"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center p-6 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-slate-400 text-xs">
          No hay devoluciones registradas para esta reserva.
        </div>
      )}

      <p className="text-[11px] text-slate-400">
        Las devoluciones solo se permiten en reservas canceladas.
      </p>
    </div>
  );
}
