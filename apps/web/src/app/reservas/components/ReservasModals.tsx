import type { useReservasController } from '../hooks/useReservasController';
import { ReservaFormModal } from './ReservaFormModal';
import { ReservaCancelarModal } from './ReservaCancelarModal';
import { ReservaDesagendarModal } from './ReservaDesagendarModal';
import { ReservaEliminarModal } from './ReservaEliminarModal';
import { FirmaDeslindeModal } from '@/components/FirmaDeslindeModal';
import { PagosModal } from '@/components/PagosModal';
import { AgendamientoRapidoModal } from '@/components/AgendamientoRapidoModal';
import { VoucherModal } from '@/components/VoucherModal';

export interface ReservasModalsProps {
  controller: ReturnType<typeof useReservasController>;
}

export function ReservasModals({ controller: c }: ReservasModalsProps) {
  return (
    <>
      {/* Modal de Creación / Edición */}
      <ReservaFormModal
        isOpen={c.isModalOpen}
        onClose={() => c.setIsModalOpen(false)}
        editingId={c.editingId}
        register={c.register}
        handleSubmit={c.handleSubmit}
        onSubmit={c.onSubmit}
        onInvalid={c.onInvalid}
        errors={c.errors}
        isDirty={c.isDirty}
        pasajerosFields={c.pasajerosFields}
        append={c.append}
        remove={c.remove}
        tarifaSeleccionada={c.tarifaSeleccionada}
        setTarifaSeleccionada={c.setTarifaSeleccionada}
        promoSeleccionada={c.promoSeleccionada}
        setPromoSeleccionada={c.setPromoSeleccionada}
        tarifasActivas={c.tarifasActivas}
        promosVigentes={c.promosVigentes}
        detalleCalculo={c.detalleCalculo}
        copiarDatosTitular={c.copiarDatosTitular}
        calcularValor={c.calcularValor}
      />

      {/* Modal de Firma Digital Interno */}
      <FirmaDeslindeModal
        pasajero={c.pasajeroFirma}
        isOpen={c.isFirmaModalOpen}
        onClose={() => {
          c.setIsFirmaModalOpen(false);
          c.setPasajeroFirma(null);
        }}
        onSuccess={() => {
          c.fetchReservas();
        }}
      />

      {/* Modal de Historial y Registro de Pagos / Abonos */}
      <PagosModal
        key={c.selectedReservaPagos?.id ?? 'cerrado'}
        reserva={c.selectedReservaPagos}
        isOpen={c.isPagosModalOpen}
        onClose={() => {
          c.setIsPagosModalOpen(false);
          c.setSelectedReservaPagos(null);
        }}
        onSuccess={() => {
          c.fetchReservas();
        }}
      />

      {/* Modal de Agendamiento Rápido */}
      <AgendamientoRapidoModal
        reserva={c.selectedReservaAgendar}
        isOpen={c.isAgendarModalOpen}
        onClose={() => {
          c.setIsAgendarModalOpen(false);
          c.setSelectedReservaAgendar(null);
        }}
        onSuccess={() => {
          c.fetchReservas();
        }}
      />

      {/* Modal de Ticket de Vuelo / Boarding Pass */}
      <VoucherModal
        reserva={c.selectedReservaVoucher}
        isOpen={c.isVoucherModalOpen}
        onClose={() => {
          c.setIsVoucherModalOpen(false);
          c.setSelectedReservaVoucher(null);
        }}
      />

      {/* Modal de Cancelación de Reserva */}
      <ReservaCancelarModal
        reserva={c.reservaACancelar}
        isOpen={!!c.reservaACancelar}
        onClose={c.cerrarModalCancelar}
        onConfirm={c.confirmarCancelarReserva}
        cancelando={c.cancelando}
        motivoCancelacion={c.motivoCancelacion}
        setMotivoCancelacion={c.setMotivoCancelacion}
        errorMotivoCancelacion={c.errorMotivoCancelacion}
        setErrorMotivoCancelacion={c.setErrorMotivoCancelacion}
      />

      {/* Modal de Desagendar Reserva */}
      <ReservaDesagendarModal
        reserva={c.reservaADesagendar}
        isOpen={!!c.reservaADesagendar}
        onClose={c.cerrarModalDesagendar}
        onConfirm={c.confirmarDesagendarReserva}
        desagendando={c.desagendando}
      />

      {/* Modal de Eliminación (con liberación de calendario) */}
      <ReservaEliminarModal
        reserva={c.reservaAEliminar}
        isOpen={!!c.reservaAEliminar}
        onClose={c.cancelarEliminar}
        onConfirm={c.confirmarEliminar}
        eliminando={c.eliminando}
      />
    </>
  );
}
