"use client";

import { X, CheckCircle2 } from 'lucide-react';
import type { ReservaConPasajeros } from '@/types/reservaDetalle';
import { Button } from './ui';
import { SlideToComplete } from './pagos/SlideToComplete';
import { PagoSummaryCard } from './pagos/PagoSummaryCard';
import { PagoFormSection } from './pagos/PagoFormSection';
import { DevolucionesSection } from './pagos/DevolucionesSection';
import { PasajerosVueloSection } from './pagos/PasajerosVueloSection';
import { usePagosModalController } from './pagos/usePagosModalController';

export interface PagosModalProps {
  reserva: ReservaConPasajeros | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function PagosModal({ reserva, isOpen, onClose, onSuccess }: PagosModalProps) {
  const c = usePagosModalController({ reserva: reserva as Parameters<typeof usePagosModalController>[0]['reserva'], onSuccess, onClose });

  if (!isOpen || !reserva) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col">
        
        {/* Cabecera */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/50">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-2.5 py-0.5 rounded-full">
                #{reserva.numeroReserva || reserva.id}
              </span>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                Historial de Pagos y Abonos
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Titular: <strong>{reserva.nombreTitular}</strong> • {reserva.pasajeros?.length || 1} pasajeros
            </p>
          </div>
          <button 
            onClick={onClose}
            aria-label="Cerrar modal"
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6 flex-1 overflow-y-auto">
          {/* Tarjeta de Resumen Financiero */}
          <PagoSummaryCard
            valorTotal={c.valorTotal}
            abonoActual={c.abonoActual}
            saldoPendiente={c.saldoPendiente}
            porcentajePagado={c.porcentajePagado}
            estadoPago={reserva.estadoPago}
            montoDevuelto={reserva.montoDevuelto}
          />

          {/* Formulario para Registrar Nuevo Abono y Lista de Pagos */}
          <PagoFormSection
            esCancelada={reserva.estado === 'CANCELADA'}
            saldoPendiente={c.saldoPendiente}
            monto={c.monto}
            setMonto={c.setMonto}
            metodoPago={c.metodoPago}
            setMetodoPago={c.setMetodoPago}
            comprobante={c.comprobante}
            setComprobante={c.setComprobante}
            notas={c.notas}
            setNotas={c.setNotas}
            onAddPago={c.handleAddPago}
            pagos={c.pagos}
            pendingPagos={c.pendingPagos}
            deletingPagos={c.deletingPagos}
            onToggleDeletePago={c.toggleDeletePago}
            onRemovePendingPago={(idx) =>
              c.setPendingPagos((prev) => prev.filter((_, i) => i !== idx))
            }
          />

          {/* Sección Devoluciones */}
          <DevolucionesSection
            puedeDevolver={c.puedeDevolver}
            montoDisponibleDevolucion={c.montoDisponibleDevolucion}
            devoluciones={c.devoluciones}
            pendingDevoluciones={c.pendingDevoluciones}
            deletingDevoluciones={c.deletingDevoluciones}
            montoDevolucion={c.montoDevolucion}
            setMontoDevolucion={c.setMontoDevolucion}
            metodoDevolucion={c.metodoDevolucion}
            setMetodoDevolucion={c.setMetodoDevolucion}
            comprobanteDevolucion={c.comprobanteDevolucion}
            setComprobanteDevolucion={c.setComprobanteDevolucion}
            notasDevolucion={c.notasDevolucion}
            setNotasDevolucion={c.setNotasDevolucion}
            onAddDevolucion={c.handleAddDevolucion}
            onToggleDeleteDevolucion={c.toggleDeleteDevolucion}
            onRemovePendingDevolucion={(idx) =>
              c.setPendingDevoluciones((prev) => prev.filter((_, i) => i !== idx))
            }
          />

          {/* Sección Pasajeros */}
          <PasajerosVueloSection
            esFinalizadaOCancelada={c.esFinalizadaOCancelada}
            tienePasajeros={c.tienePasajeros}
            vueloCompletado={c.vueloCompletado}
            pasajeros={c.pasajeros}
            estadoPasajeros={c.estadoPasajeros}
            setEstadoPasajeros={c.setEstadoPasajeros}
          />
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex flex-wrap items-center justify-between gap-3">
          {c.mostrarSlide ? (
            <SlideToComplete
              isCompleted={c.vueloCompletado}
              onToggle={(completed) => c.setVueloCompletado(completed)}
              disabled={!c.puedeCompletar && !c.vueloCompletado}
              disabledReason={!c.puedeCompletar && !c.vueloCompletado ? c.slideDisabledReason : null}
            />
          ) : !c.esFinalizadaOCancelada ? (
            <p
              className="text-[11px] text-slate-400 dark:text-slate-500 max-w-64 leading-tight"
              title={c.slideDisabledReason ?? undefined}
            >
              {c.slideDisabledReason}
            </p>
          ) : null}

          {c.tieneCambios ? (
            <Button
              onClick={c.handleSave}
              loading={c.isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-500 px-5 py-2 rounded-xl text-xs font-bold shadow-md cursor-pointer"
            >
              <CheckCircle2 size={15} />
              {c.isSubmitting ? 'Guardando...' : 'Guardar'}
            </Button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Cerrar
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
