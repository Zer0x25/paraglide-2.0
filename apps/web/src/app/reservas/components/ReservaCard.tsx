"use client";

import type { ReservaConPasajeros, PasajeroConVuelos, VueloConPiloto } from '@/types/reservaDetalle';
import { calcularEstadoReservaCard } from '../utils/reservaCardState';
import { ReservaCardHeader } from './ReservaCardHeader';
import { ReservaCardFinancials } from './ReservaCardFinancials';
import { ReservaCardPassengerList } from './ReservaCardPassengerList';
import { ReservaCardActions } from './ReservaCardActions';

export interface ReservaCardProps {
  reserva: ReservaConPasajeros;
  onEdit: (reserva: ReservaConPasajeros) => void;
  onDelete: (reserva: ReservaConPasajeros) => void;
  onOpenFirma: (pasajero: PasajeroConVuelos) => void;
  onOpenPagos: (reserva: ReservaConPasajeros) => void;
  onOpenVoucher: (reserva: ReservaConPasajeros) => void;
  onOpenAgendar: (reserva: ReservaConPasajeros) => void;
  onOpenCancelar: (reserva: ReservaConPasajeros) => void;
  onOpenDesagendar?: (reserva: ReservaConPasajeros) => void;
  onReabrir?: (reserva: ReservaConPasajeros) => void;
  onWhatsAppConfirmation: (reserva: ReservaConPasajeros) => void;
  onWhatsAppPiloto: (reserva: ReservaConPasajeros, pasajero: PasajeroConVuelos, vuelo: VueloConPiloto) => void;
}

export function ReservaCard({
  reserva,
  onEdit,
  onDelete,
  onOpenFirma,
  onOpenPagos,
  onOpenVoucher,
  onOpenAgendar,
  onOpenCancelar,
  onOpenDesagendar,
  onReabrir,
  onWhatsAppConfirmation,
  onWhatsAppPiloto,
}: ReservaCardProps) {
  const state = calcularEstadoReservaCard(reserva);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-slate-100 dark:border-slate-800 p-5 sm:p-6 flex flex-col justify-between hover:border-blue-500/30 transition-all group">
      <div>
        <ReservaCardHeader
          reserva={reserva}
          state={state}
          onEdit={onEdit}
          onDelete={onDelete}
          onOpenPagos={onOpenPagos}
          onOpenDesagendar={onOpenDesagendar}
          onReabrir={onReabrir}
        />
        <ReservaCardFinancials
          estadoPago={reserva.estadoPago}
          valorTotal={reserva.valorTotal}
          saldoPendiente={state.saldoPendiente}
        />
        <ReservaCardPassengerList
          reserva={reserva}
          totalPasajeros={state.totalPasajeros}
          todosDeslindesFirmados={state.todosDeslindesFirmados}
          pasajerosActivos={state.pasajerosActivos}
          pasajerosCompletados={state.pasajerosCompletados}
          estadoReserva={state.estadoReserva}
          onOpenFirma={onOpenFirma}
          onWhatsAppPiloto={onWhatsAppPiloto}
        />
      </div>

      <ReservaCardActions
        reserva={reserva}
        state={state}
        onOpenPagos={onOpenPagos}
        onOpenVoucher={onOpenVoucher}
        onOpenAgendar={onOpenAgendar}
        onOpenCancelar={onOpenCancelar}
        onWhatsAppConfirmation={onWhatsAppConfirmation}
      />
    </div>
  );
}
