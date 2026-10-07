"use client";

import { CheckCircle2 } from 'lucide-react';
import { Button } from './ui';
import type { ReservaConPasajeros } from '@/types/reservaDetalle';
import { AgendamientoRapidoHeader } from './agendamiento-rapido/AgendamientoRapidoHeader';
import { AgendamientoRapidoHorarios } from './agendamiento-rapido/AgendamientoRapidoHorarios';
import { AgendamientoRapidoPasajeros } from './agendamiento-rapido/AgendamientoRapidoPasajeros';
import { useAgendamientoRapidoController } from './agendamiento-rapido/useAgendamientoRapidoController';

interface AgendamientoRapidoModalProps {
  reserva: ReservaConPasajeros | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AgendamientoRapidoModal({ reserva, isOpen, onClose, onSuccess }: AgendamientoRapidoModalProps) {
  const c = useAgendamientoRapidoController({ reserva, onSuccess, onClose });

  if (!isOpen || !reserva) return null;

  type PasajeroSoftDelete = ReservaConPasajeros['pasajeros'][number] & { deletedAt?: string | Date | null };
  const pasajeros = ((reserva.pasajeros ?? []) as PasajeroSoftDelete[]).filter((p) => p.deletedAt == null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col">
        
        {/* Cabecera */}
        <AgendamientoRapidoHeader
          reserva={reserva}
          pasajerosCount={pasajeros.length}
          onClose={onClose}
        />

        <form onSubmit={c.handleConfirmarVuelos} className="p-6 space-y-6 flex-1 overflow-y-auto">
          {/* Paso 1: Horarios y Bloques */}
          <AgendamientoRapidoHorarios
            fecha={c.fecha}
            setFecha={c.setFecha}
            hora={c.hora}
            setHora={c.setHora}
            setAsignaciones={c.setAsignaciones}
            nombreConfig={c.nombreConfig}
            diaBloqueado={c.diaBloqueado}
            loadingBloques={c.loadingBloques}
            bloquesDelDia={c.bloquesDelDia}
            loadingMatch={c.loadingMatch}
            ejecutarAutoMatch={c.ejecutarAutoMatch}
          />

          {/* Paso 2: Pasajeros y Pilotos */}
          <AgendamientoRapidoPasajeros
            pasajeros={pasajeros}
            pilotos={c.pilotos}
            asignaciones={c.asignaciones}
            setAsignaciones={c.setAsignaciones}
          />

          {/* Footer de confirmación */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl text-xs font-bold transition cursor-pointer"
            >
              Cancelar
            </button>
            <Button
              type="submit"
              loading={c.isSubmitting}
              disabled={Object.keys(c.asignaciones).length < pasajeros.length}
              className="px-6 py-2.5 rounded-2xl text-xs font-black shadow-lg shadow-blue-600/20"
            >
              <CheckCircle2 size={16} />
              <span>{c.isSubmitting ? 'Agendando vuelos...' : 'Confirmar y Crear Vuelos'}</span>
            </Button>
          </div>
        </form>

      </div>
    </div>
  );
}
