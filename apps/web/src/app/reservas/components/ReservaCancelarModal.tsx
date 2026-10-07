import { useState } from 'react';
import { AlertTriangle, DollarSign, ArrowRight } from 'lucide-react';
import type { ReservaConPasajeros } from '@/types/reservaDetalle';
import { Modal, Button, inputClass } from '../../../components/ui';
import type { MetodoPago } from '@parapente/shared';

const MOTIVOS_FRECUENTES = [
  { id: 'clima', label: '🌧️ Mal tiempo / Clima adverso', texto: 'Mal tiempo / Condiciones climáticas no aptas para el vuelo' },
  { id: 'fuerza_mayor', label: '⚠️ Asunto de fuerza mayor', texto: 'Asuntos imprevistos de fuerza mayor' },
  { id: 'desistimiento', label: '👤 Desistimiento del cliente', texto: 'Desistimiento voluntario por parte del cliente o pasajero' },
  { id: 'medico', label: '🏥 Problema de salud / Médico', texto: 'Impedimento de salud o condición médica no compatible' },
];

export interface DatosDevolucionCancelacion {
  procesarDevolucion: boolean;
  monto: number;
  metodoPago?: MetodoPago;
  comprobante?: string;
  notas?: string;
}

interface ReservaCancelarModalProps {
  reserva: ReservaConPasajeros | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (datosDevolucion?: DatosDevolucionCancelacion) => void;
  cancelando: boolean;
  motivoCancelacion: string;
  setMotivoCancelacion: (val: string) => void;
  errorMotivoCancelacion: boolean;
  setErrorMotivoCancelacion: (val: boolean) => void;
}

interface ModalContentProps {
  reserva: ReservaConPasajeros;
  onClose: () => void;
  onConfirm: (datosDevolucion?: DatosDevolucionCancelacion) => void;
  cancelando: boolean;
  motivoCancelacion: string;
  setMotivoCancelacion: (val: string) => void;
  errorMotivoCancelacion: boolean;
  setErrorMotivoCancelacion: (val: boolean) => void;
}

function ReservaCancelarModalContent({
  reserva,
  onClose,
  onConfirm,
  cancelando,
  motivoCancelacion,
  setMotivoCancelacion,
  errorMotivoCancelacion,
  setErrorMotivoCancelacion,
}: ModalContentProps) {
  const abono = Number(reserva.abono || 0);
  const devueltoPrevio = Number(reserva.montoDevuelto || 0);
  const saldoADevolverMax = Math.max(0, abono - devueltoPrevio);

  const [procesarDevolucion, setProcesarDevolucion] = useState(saldoADevolverMax > 0);
  const [montoDevolucion, setMontoDevolucion] = useState<number>(saldoADevolverMax);
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('TRANSFERENCIA');
  const [comprobante, setComprobante] = useState('');

  const handleSelectMotivo = (texto: string) => {
    setMotivoCancelacion(texto);
    if (errorMotivoCancelacion) setErrorMotivoCancelacion(false);
  };

  const handleConfirmar = () => {
    if (procesarDevolucion && montoDevolucion > 0) {
      onConfirm({
        procesarDevolucion: true,
        monto: montoDevolucion,
        metodoPago,
        comprobante: comprobante.trim() || undefined,
        notas: `Devolución automática al cancelar reserva #${reserva.id}`,
      });
    } else {
      onConfirm();
    }
  };

  return (
    <>
      <div className="space-y-4">
        {/* Encabezado informativo */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Reserva a cancelar</p>
            <h4 className="text-base font-bold text-slate-900 dark:text-white">
              #{reserva.numeroReserva || reserva.id} — {reserva.nombreTitular}
            </h4>
          </div>
          <span className="px-2.5 py-1 text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 rounded-full">
            {reserva.estado || 'SIN_AGENDAR'}
          </span>
        </div>

        {/* Motivo de cancelación con chips rápidos */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
            Motivo de cancelación <span className="text-red-500">*</span>
          </label>

          {/* Chips de selección rápida */}
          <div className="flex flex-wrap gap-1.5 mb-2.5">
            {MOTIVOS_FRECUENTES.map((m) => {
              const seleccionado = motivoCancelacion === m.texto;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleSelectMotivo(m.texto)}
                  className={`px-3 py-1 text-xs font-semibold rounded-xl border transition cursor-pointer ${
                    seleccionado
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>

          <textarea
            id="motivo-cancelacion"
            rows={2}
            value={motivoCancelacion}
            onChange={(e) => {
              setMotivoCancelacion(e.target.value);
              if (errorMotivoCancelacion && e.target.value.trim()) setErrorMotivoCancelacion(false);
            }}
            placeholder="Escribe o selecciona un motivo rápido..."
            className={`${inputClass} resize-none ${errorMotivoCancelacion ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
            aria-invalid={errorMotivoCancelacion || undefined}
          />
          {errorMotivoCancelacion && (
            <p className="text-red-500 text-xs mt-1">El motivo de cancelación es obligatorio</p>
          )}
        </div>

        {/* Advertencia de vuelos liberados */}
        <div className="flex items-start gap-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-2xl p-3 text-xs text-amber-800 dark:text-amber-200">
          <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
          <span>
            Se liberarán todos los vuelos y turnos de pilotos asignados a los pasajeros de esta reserva.
          </span>
        </div>

        {/* Sección de Devolución Integrada (si el cliente tiene dinero pagado) */}
        {saldoADevolverMax > 0 ? (
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 rounded-lg">
                  <DollarSign size={16} />
                </div>
                <div>
                  <h5 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                    Devolución de Dinero Inmediata
                  </h5>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    El cliente abonó un total de <strong>${abono.toLocaleString('es-CL')}</strong>
                  </p>
                </div>
              </div>

              <label className="flex items-center space-x-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={procesarDevolucion}
                  onChange={(e) => setProcesarDevolucion(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  Emitir Devolución
                </span>
              </label>
            </div>

            {procesarDevolucion && (
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                    Monto a Devolver (CLP)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={saldoADevolverMax}
                    value={montoDevolucion || ''}
                    onChange={(e) => setMontoDevolucion(Math.min(saldoADevolverMax, Math.max(0, Number(e.target.value))))}
                    className={inputClass}
                  />
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Máximo a devolver: ${saldoADevolverMax.toLocaleString('es-CL')}
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                    Método de Devolución
                  </label>
                  <select
                    value={metodoPago}
                    onChange={(e) => setMetodoPago(e.target.value as MetodoPago)}
                    className={inputClass}
                  >
                    <option value="TRANSFERENCIA">Transferencia Electrónica</option>
                    <option value="EFECTIVO">Efectivo</option>
                    <option value="WEBPAY">Webpay / Tarjeta</option>
                    <option value="OTRO">Otro</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                    Comprobante / N° Transacción (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Transf. 981244 / Caja central"
                    value={comprobante}
                    onChange={(e) => setComprobante(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
            Esta reserva no registra abonos ni pagos pendientes de devolución ($0 CLP).
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between w-full pt-4 border-t border-slate-100 dark:border-slate-800">
        <Button variant="secondary" onClick={onClose} disabled={cancelando}>
          Volver / No cancelar
        </Button>
        <Button
          variant="danger"
          onClick={handleConfirmar}
          loading={cancelando}
          className="flex items-center space-x-1.5"
        >
          <span>
            {procesarDevolucion && montoDevolucion > 0
              ? 'Confirmar Cancelación y Devolución'
              : 'Confirmar Cancelación'}
          </span>
          <ArrowRight size={14} />
        </Button>
      </div>
    </>
  );
}

export function ReservaCancelarModal({
  reserva,
  isOpen,
  onClose,
  onConfirm,
  cancelando,
  motivoCancelacion,
  setMotivoCancelacion,
  errorMotivoCancelacion,
  setErrorMotivoCancelacion,
}: ReservaCancelarModalProps) {
  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Cancelar Reserva"
      size="lg"
    >
      {isOpen && reserva && (
        <ReservaCancelarModalContent
          key={reserva.id}
          reserva={reserva}
          onClose={onClose}
          onConfirm={onConfirm}
          cancelando={cancelando}
          motivoCancelacion={motivoCancelacion}
          setMotivoCancelacion={setMotivoCancelacion}
          errorMotivoCancelacion={errorMotivoCancelacion}
          setErrorMotivoCancelacion={setErrorMotivoCancelacion}
        />
      )}
    </Modal>
  );
}
