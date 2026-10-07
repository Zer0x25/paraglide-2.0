"use client";

import Link from 'next/link';
import { ArrowLeft, Globe, Calendar, Share2, Download } from 'lucide-react';

interface VoucherActionBarProps {
  publicIdentifier: string | number | null | undefined;
  downloadingPdf: boolean;
  onGoogleCalendar: () => void;
  onAddToCalendar: () => void;
  onShare: () => void;
  onDownloadPdf: () => void;
}

export function VoucherActionBar({
  publicIdentifier,
  downloadingPdf,
  onGoogleCalendar,
  onAddToCalendar,
  onShare,
  onDownloadPdf,
}: VoucherActionBarProps) {
  return (
    <div className="w-full max-w-2xl mb-6 flex items-center justify-between print:hidden">
      <Link
        href={`/deslinde/${publicIdentifier}`}
        className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white text-xs font-bold transition"
      >
        <ArrowLeft size={16} />
        <span>Ir al Deslinde Digital</span>
      </Link>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={onGoogleCalendar}
          className="flex items-center space-x-1.5 py-2 px-3.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-md transition cursor-pointer"
          title="Añadir vuelo a Google Calendar en 1-clic"
        >
          <Globe size={14} />
          <span className="hidden sm:inline">Google Calendar</span>
        </button>

        <button
          type="button"
          onClick={onAddToCalendar}
          className="flex items-center space-x-1.5 py-2 px-3.5 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-100 rounded-xl text-xs font-bold shadow-xs dark:shadow-md transition border border-slate-200 dark:border-slate-700 cursor-pointer"
          title="Abrir en Calendario de iPhone / Android (.ics)"
        >
          <Calendar size={14} className="text-blue-500 dark:text-blue-400" />
          <span className="hidden sm:inline">Calendario (.ics)</span>
        </button>

        <button
          type="button"
          onClick={onShare}
          className="flex items-center space-x-1.5 py-2 px-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md transition cursor-pointer"
          title="Compartir voucher"
        >
          <Share2 size={14} />
          <span className="hidden sm:inline">Compartir</span>
        </button>

        <button
          type="button"
          onClick={onDownloadPdf}
          disabled={downloadingPdf}
          className="flex items-center space-x-1.5 py-2 px-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded-xl text-xs font-bold shadow-md transition cursor-pointer"
          title="Descargar voucher en PDF"
        >
          {downloadingPdf ? (
            <span className="w-3.5 h-3.5 border-2 border-white/60 border-t-white rounded-full animate-spin" />
          ) : (
            <Download size={14} />
          )}
          <span className="hidden sm:inline">{downloadingPdf ? 'Descargando…' : 'PDF'}</span>
        </button>
      </div>
    </div>
  );
}
