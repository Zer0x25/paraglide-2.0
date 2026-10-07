"use client";

import Link from 'next/link';

interface VoucherQrFinancialCardProps {
  qrDataUrl: string;
  publicIdentifier: string | number | null | undefined;
  estadoPago: string;
  saldoPendiente: number;
  abono: number;
  valorTotal: number;
  montoDevuelto?: number | null;
}

export function VoucherQrFinancialCard({
  qrDataUrl,
  publicIdentifier,
  estadoPago,
  saldoPendiente,
  abono,
  valorTotal,
  montoDevuelto,
}: VoucherQrFinancialCardProps) {
  const devuelto = Number(montoDevuelto || 0);

  const color =
    estadoPago === 'DEVUELTO'
      ? 'text-red-400'
      : estadoPago === 'PAGADO'
      ? 'text-emerald-400'
      : estadoPago === 'ABONADO'
      ? 'text-sky-400'
      : 'text-amber-400';

  const principal =
    estadoPago === 'DEVUELTO'
      ? `$${devuelto.toLocaleString('es-CL')} DEVUELTO`
      : estadoPago === 'PAGADO'
      ? '$0 (PAGADO)'
      : `$${saldoPendiente.toLocaleString('es-CL')} (${estadoPago})`;

  return (
    <div className="bg-slate-900 dark:bg-slate-800 text-white rounded-3xl p-5 border border-slate-800 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-6 print:bg-slate-50 print:text-black print:border print:border-black">
      {/* Código QR */}
      <div className="flex items-center space-x-4">
        {qrDataUrl && (
          <Link
            href={`/deslinde/${publicIdentifier}`}
            className="block p-2 rounded-2xl shadow-md shrink-0 hover:scale-105 hover:shadow-lg transition-all duration-300 ring-2 ring-transparent hover:ring-blue-500 cursor-pointer bg-white"
            title="Toca para abrir el deslinde"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- data URL base64, no optimizable por next/image */}
            <img src={qrDataUrl} alt="QR Deslinde" className="w-20 h-20 sm:w-28 sm:h-28" />
          </Link>
        )}
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 block print:text-black">
            Check-in & Deslinde
          </span>
          <p className="text-[11px] sm:text-xs font-bold text-slate-200 print:text-black leading-tight">
            Escanea para completar tus datos y firmar tu deslinde.
          </p>
          <Link
            href={`/deslinde/${publicIdentifier}`}
            className="inline-block mt-2 text-[10px] bg-blue-600/30 hover:bg-blue-600 text-blue-200 hover:text-white font-bold py-1 px-3 rounded-full border border-blue-500/30 print:hidden transition"
          >
            Toca aquí para abrir el link
          </Link>
        </div>
      </div>

      {/* Estado Financiero */}
      <div className="text-left sm:text-right border-t sm:border-t-0 sm:border-l border-slate-800 dark:border-slate-700 sm:pl-6 pt-4 sm:pt-0 w-full sm:w-auto print:border-black">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 print:text-black">
          Saldo de la Reserva
        </span>
        <p className={`text-2xl font-black print:text-black ${color}`}>
          {principal}
        </p>
        <p className="text-[11px] text-slate-300 dark:text-slate-300 mt-0.5 print:text-black">
          {estadoPago === 'DEVUELTO'
            ? `Devuelto: $${devuelto.toLocaleString('es-CL')} • Abono: $${(abono || 0).toLocaleString('es-CL')}`
            : `Abono: $${(abono || 0).toLocaleString('es-CL')} / $${(valorTotal || 0).toLocaleString('es-CL')}`}
        </p>
      </div>
    </div>
  );
}
