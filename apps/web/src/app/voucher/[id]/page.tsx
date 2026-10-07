"use client";

import { useVoucherController } from '../hooks/useVoucherController';
import {
  VoucherActionBar,
  VoucherHeader,
  VoucherFlightCard,
  VoucherLocationCard,
  VoucherPassengerList,
  VoucherTarifaDetail,
  VoucherQrFinancialCard,
  VoucherSafetyInstructions,
  VoucherLoading,
  VoucherNotFound,
} from '../components';

export default function VoucherPublicoPage({ params }: { params: Promise<{ id: string }> }) {
  const {
    reserva,
    loading,
    error,
    puntoDeEncuentro,
    qrDataUrl,
    downloadingPdf,
    saldoPendiente,
    fechaFormateada,
    publicIdentifier,
    handleDownloadPdf,
    handleShare,
    handleAddToCalendar,
    handleGoogleCalendar1Click,
  } = useVoucherController({ params });

  if (loading) {
    return <VoucherLoading />;
  }

  if (error || !reserva) {
    return <VoucherNotFound error={error} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-6 sm:py-8 px-4 sm:px-6 flex flex-col items-center justify-center font-sans antialiased text-slate-900 dark:text-slate-100">
      {/* Barra de Acciones (Oculta en Impresión) */}
      <VoucherActionBar
        publicIdentifier={publicIdentifier}
        downloadingPdf={downloadingPdf}
        onGoogleCalendar={handleGoogleCalendar1Click}
        onAddToCalendar={handleAddToCalendar}
        onShare={handleShare}
        onDownloadPdf={handleDownloadPdf}
      />

      {/* TICKET DE EMBARQUE / BOARDING PASS */}
      <div className="w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 print:bg-white print:text-black print:shadow-none print:border-black print:rounded-none">
        {/* Cabecera del Voucher */}
        <VoucherHeader
          numeroReserva={reserva.numeroReserva}
          reservaId={reserva.shortId ?? reserva.id}
          estado={reserva.estado}
        />

        {/* Detalles del Voucher */}
        <div className="p-6 sm:p-8 space-y-6">
          {/* Fila 1: Titular, Fecha y Ubicación */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pb-6 border-b border-slate-200 dark:border-slate-800">
            <VoucherFlightCard
              nombreTitular={reserva.nombreTitular}
              telefono={reserva.telefono}
              fechaFormateada={fechaFormateada}
              horaAgenda={reserva.horaAgenda}
            />
            <VoucherLocationCard puntoDeEncuentro={puntoDeEncuentro} />
          </div>

          {/* Fila 2: Lista de Pasajeros y Deslindes */}
          <VoucherPassengerList pasajeros={reserva.pasajeros} />

          {/* Desglose de Tarifa y Promoción (si aplica) */}
          {reserva.tarifa && (
            <VoucherTarifaDetail
              tarifa={reserva.tarifa}
              promocion={reserva.promocion}
              descuento={reserva.descuento}
              valorTotal={reserva.valorTotal}
              pasajerosCount={reserva.pasajeros.length}
            />
          )}

          {/* Fila 3: Código QR y Desglose Financiero */}
          <VoucherQrFinancialCard
            qrDataUrl={qrDataUrl}
            publicIdentifier={publicIdentifier}
            estadoPago={reserva.estadoPago}
            saldoPendiente={saldoPendiente}
            abono={reserva.abono}
            valorTotal={reserva.valorTotal}
            montoDevuelto={reserva.montoDevuelto}
          />

          {/* Instrucciones de Seguridad para el Vuelo */}
          <VoucherSafetyInstructions />
        </div>

        {/* Perforación / Footer del Ticket */}
        <div className="bg-slate-100 dark:bg-slate-800/80 px-6 py-4 text-center border-t border-dashed border-slate-300 dark:border-slate-700 text-[10px] text-slate-500 dark:text-slate-400 print:border-black print:text-black">
          Ticket emitido por Paraglide Flight Management System • Válido para la fecha agendada
        </div>
      </div>
    </div>
  );
}
