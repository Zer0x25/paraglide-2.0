"use client";

import { useState, useEffect } from 'react';
import { Lock, Trash2, CheckCircle2 } from 'lucide-react';
import { VueloModalHeader } from './VueloModalHeader';
import { VueloModalSelectReserva, pasajeroPendiente } from './VueloModalSelectReserva';
import { VueloModalDateTime } from './VueloModalDateTime';
import { VueloModalSingleAssign } from './VueloModalSingleAssign';
import { VueloModalGroupAssign } from './VueloModalGroupAssign';
import { VueloModalFinancialDetail } from './VueloModalFinancialDetail';
import type { ReservaConPasajeros } from '../../../types/reservaDetalle';
import type { HorarioBloque, Pasajero, Piloto, Vuelo } from '../hooks/types';

export { pasajeroPendiente };

interface VueloModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingId: number | null;
  filterReservaId: number | null;
  setFilterReservaId: (id: number | null) => void;
  formData: {
    pilotoId: string;
    pasajeroId: string;
    fecha: string;
    hora: string;
    valorPactado: string;
  };
  setFormData: React.Dispatch<React.SetStateAction<{
    pilotoId: string;
    pasajeroId: string;
    fecha: string;
    hora: string;
    valorPactado: string;
  }>>;
  groupPilotSelections: Record<number, string>;
  setGroupPilotSelections: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  reservas: ReservaConPasajeros[];
  pasajeros: Pasajero[];
  pilotos: Piloto[];
  vuelos: Vuelo[];
  isBloqueado: boolean;
  availableBlocks: HorarioBloque[];
  selectedTimeIsCustom: boolean;
  handleAsignacionAutomatica: () => Promise<void>;
  isPilotoDisabled: (pilotoId: number, currentPasajeroId?: number) => boolean;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  cancelarVuelo: (id: number) => void;
  openConfigBloques: () => void;
  setDate: (d: Date) => void;
  onOpenPagos?: (reserva: ReservaConPasajeros) => void;
  onCompletarReserva?: (reservaId: number, vueloId: number, versionReserva?: number) => Promise<void>;
  vuelosQueryRefetch?: () => void;
  editingEstado?: string;
  setEditingEstado?: (estado: string) => void;
  editingVersion?: number;
  setEditingVersion?: (version: number) => void;
}

export function VueloModal({
  isOpen,
  onClose,
  editingId,
  filterReservaId,
  setFilterReservaId,
  formData,
  setFormData,
  groupPilotSelections,
  setGroupPilotSelections,
  reservas,
  pasajeros,
  pilotos,
  vuelos,
  isBloqueado,
  availableBlocks,
  selectedTimeIsCustom,
  handleAsignacionAutomatica,
  isPilotoDisabled,
  handleSubmit,
  cancelarVuelo,
  openConfigBloques,
  setDate,
  onOpenPagos,
  onCompletarReserva,
}: VueloModalProps) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!isOpen) return;
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [isOpen]);

  const [isCompleting, setIsCompleting] = useState(false);

  // Datos para el header y tarjetas
  const editingFlight = editingId ? vuelos.find((v) => v.id === editingId) : null;
  const currentPasajero = editingId
    ? pasajeros.find((p) => p.id === (editingFlight?.pasajeroId || Number(formData.pasajeroId)))
    : null;
  const currentReserva = filterReservaId
    ? reservas.find((r) => r.id === filterReservaId)
    : currentPasajero?.reservaId
    ? reservas.find((r) => r.id === currentPasajero.reservaId)
    : editingFlight?.reservaId
    ? reservas.find((r) => r.id === editingFlight.reservaId)
    : editingFlight?.reserva?.id
    ? (reservas.find((r) => r.id === editingFlight.reserva?.id) ?? (editingFlight.reserva as unknown as ReservaConPasajeros))
    : null;

  const fechaHoraVuelo = editingFlight?.fechaHora
    ? new Date(editingFlight.fechaHora)
    : formData.fecha && formData.hora
    ? new Date(`${formData.fecha}T${formData.hora}:00`)
    : null;

  const paso15Min = Boolean(fechaHoraVuelo && now >= fechaHoraVuelo.getTime() + 15 * 60 * 1000);
  const esCerrada = Boolean(
    currentReserva?.cerradaAt ||
    editingFlight?.reserva?.cerradaAt
  );

  const horaDesbloqueo = fechaHoraVuelo
    ? new Date(fechaHoraVuelo.getTime() + 15 * 60 * 1000).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
    : null;

  const handleMarcarCompletada = async () => {
    if (!currentReserva?.id || !onCompletarReserva) return;
    setIsCompleting(true);
    try {
      await onCompletarReserva(currentReserva.id, editingFlight?.id || 0, currentReserva.version);
    } finally {
      setIsCompleting(false);
    }
  };

  const poolPasajeros = currentReserva
    ? pasajeros.filter((p) => p.reservaId === currentReserva.id)
    : (currentPasajero?.reservaId ? pasajeros.filter((p) => p.reservaId === currentPasajero.reservaId) : pasajeros);

  const currentGroupPassengers = filterReservaId
    ? ((currentReserva?.pasajeros?.filter(pasajeroPendiente) as Pasajero[] | undefined) || [])
    : [];

  const handleSelectReserva = (resId: number | null) => {
    setFilterReservaId(resId);
    if (resId) {
      const selectedReserva = reservas.find((r) => r.id === resId);
      const groupPassengers = pasajeros.filter((p) => p.reservaId === resId);
      const existingFlight = vuelos?.find((v) => groupPassengers.some((gp) => gp.id === v.pasajeroId));

      let defaultFecha = formData.fecha;
      let defaultHora = formData.hora;

      if (existingFlight) {
        const start = new Date(existingFlight.fechaHora);
        const localDate = new Date(start.getTime() - start.getTimezoneOffset() * 60000);
        defaultFecha = localDate.toISOString().split('T')[0];
        defaultHora = localDate.toISOString().split('T')[1].substring(0, 5);
        setDate(start);
      } else if (selectedReserva?.fechaAgenda) {
        const fr = selectedReserva.fechaAgenda as string | Date;
        defaultFecha = typeof fr === 'string' ? fr.split('T')[0] : new Date(fr).toISOString().split('T')[0];
      }

      setFormData((prev) => ({ ...prev, fecha: defaultFecha, hora: defaultHora }));

      const autoSelections: Record<number, string> = {};
      groupPassengers.forEach((p: Pasajero) => {
        const pFlight = vuelos?.find((v: Vuelo) => v.pasajeroId === p.id);
        if (pFlight) {
          autoSelections[p.id] = String(pFlight.pilotoId);
        }
      });
      setGroupPilotSelections(autoSelections);
    } else {
      setGroupPilotSelections({});
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-vuelo-titulo"
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800"
      >
        <VueloModalHeader
          esCerrada={esCerrada}
          editingId={editingId}
          filterReservaId={filterReservaId}
          currentReserva={currentReserva}
          currentPasajero={currentPasajero}
          currentGroupPassengersCount={currentGroupPassengers.length}
          onClose={onClose}
        />

        <form onSubmit={handleSubmit} className="p-6 space-y-6 flex-1 overflow-y-auto">
          {/* Banner informativo si la reserva está cerrada contablemente */}
          {esCerrada && (
            <div className="p-4 bg-slate-100 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-2xl flex items-start gap-3 text-xs text-slate-700 dark:text-slate-300 shadow-xs">
              <Lock size={18} className="text-slate-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-900 dark:text-white block text-sm">
                  Reserva cerrada contablemente (Solo lectura)
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 block">
                  Esta reserva fue sellada y congelada con snapshot inmutable. Por integridad contable y legal, sus vuelos, pasajeros y pagos no admiten modificaciones operativas.
                </span>
              </div>
            </div>
          )}

          {/* Selección de Reserva en modo nuevo */}
          {!editingId && !filterReservaId && (
            <VueloModalSelectReserva
              reservas={reservas}
              filterReservaId={filterReservaId}
              onSelectReserva={handleSelectReserva}
            />
          )}

          {/* Paso 1: Fecha y Horario del Vuelo */}
          <VueloModalDateTime
            fecha={formData.fecha}
            hora={formData.hora}
            esCerrada={esCerrada}
            isBloqueado={isBloqueado}
            availableBlocks={availableBlocks}
            selectedTimeIsCustom={selectedTimeIsCustom}
            isEditing={Boolean(editingId)}
            hasFilterReserva={Boolean(filterReservaId)}
            onFechaChange={(nuevaFecha) => {
              setFormData({ ...formData, fecha: nuevaFecha, hora: '', pilotoId: '' });
              setGroupPilotSelections({});
              if (nuevaFecha) {
                setDate(new Date(nuevaFecha + 'T12:00:00'));
              }
            }}
            onHoraChange={(nuevaHora) => {
              setFormData({ ...formData, hora: nuevaHora, pilotoId: '' });
              setGroupPilotSelections({});
            }}
            openConfigBloques={openConfigBloques}
            handleAsignacionAutomatica={handleAsignacionAutomatica}
          />

          {/* Paso 2: Asignación de Pilotos (Grupo vs Individual) */}
          {!editingId ? (
            filterReservaId ? (
              <VueloModalGroupAssign
                currentGroupPassengers={currentGroupPassengers}
                groupPilotSelections={groupPilotSelections}
                setGroupPilotSelections={setGroupPilotSelections}
                pilotos={pilotos}
                isPilotoDisabled={isPilotoDisabled}
                onResetReserva={() => setFilterReservaId(null)}
              />
            ) : null
          ) : (
            <VueloModalSingleAssign
              pasajeroId={formData.pasajeroId}
              pilotoId={formData.pilotoId}
              esCerrada={esCerrada}
              poolPasajeros={poolPasajeros}
              pilotos={pilotos}
              isPilotoDisabled={(pId) => isPilotoDisabled(pId)}
              onPasajeroChange={(pId) => setFormData({ ...formData, pasajeroId: pId })}
              onPilotoChange={(pId) => setFormData({ ...formData, pilotoId: pId })}
            />
          )}

          {/* Detalle Financiero / Pago */}
          {currentReserva && (
            <VueloModalFinancialDetail
              infoReserva={currentReserva}
              isEditing={Boolean(editingId)}
              esCerrada={esCerrada}
              editingFlightEstado={editingFlight?.estado}
              paso15Min={paso15Min}
              horaDesbloqueo={horaDesbloqueo}
              isCompleting={isCompleting}
              onOpenPagos={onOpenPagos}
              onMarcarCompletada={handleMarcarCompletada}
            />
          )}

          {/* Footer de Acciones */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
            <div>
              {editingId && !esCerrada ? (
                <button
                  type="button"
                  onClick={() => cancelarVuelo(editingId)}
                  title="Eliminar Agenda"
                  aria-label="Eliminar Agenda"
                  className="p-2.5 rounded-2xl border border-red-200 dark:border-red-900/60 text-red-500 hover:text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition cursor-pointer flex items-center justify-center shrink-0"
                >
                  <Trash2 size={18} />
                  <span className="sr-only">Eliminar Agenda</span>
                </button>
              ) : null}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 min-w-[120px] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl text-xs font-bold transition cursor-pointer whitespace-nowrap flex items-center justify-center text-center"
              >
                {esCerrada ? 'Cerrar' : 'Cancelar'}
              </button>
              <button
                type="submit"
                disabled={esCerrada || isBloqueado || (!editingId && availableBlocks.length === 0 && !!formData.fecha)}
                className={`px-5 py-2.5 min-w-[120px] rounded-2xl text-xs font-black transition flex items-center justify-center gap-2 whitespace-nowrap text-center ${
                  esCerrada
                    ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-300 dark:border-slate-700 cursor-not-allowed shadow-none'
                    : 'shadow-lg shadow-blue-600/20 bg-blue-600 hover:bg-blue-700 text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
              >
                {esCerrada ? (
                  <>
                    <Lock size={15} />
                    <span>Solo Lectura</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    <span>{editingId ? 'Guardar Cambios' : filterReservaId ? 'Confirmar y Crear Vuelos' : 'Confirmar Vuelo'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
