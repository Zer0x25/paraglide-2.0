"use client";

import { useState } from 'react';
import axios from 'axios';
import { Download, ExternalLink } from 'lucide-react';
import type { ReservaConPasajeros } from '@/types/reservaDetalle';
import { formatCLP } from '../utils/format';
import { formatFechaEspanol } from '@parapente/shared';
import { Modal, Button } from './ui';

interface VoucherModalProps {
  reserva: ReservaConPasajeros | null;
  isOpen: boolean;
  onClose: () => void;
}

export function VoucherModal({ reserva, isOpen, onClose }: VoucherModalProps) {
  // Enlaces públicos solo con identificadores no secuenciales (tokenPublico/shortId).
  const publicId = reserva ? (reserva.tokenPublico || reserva.shortId || '') : '';

  const [downloading, setDownloading] = useState(false);

  if (!isOpen || !reserva) return null;

  const handleDownloadPdf = async () => {
    if (downloading) return;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
    try {
      setDownloading(true);
      const res = await axios.get(`${apiUrl}/public/voucher/${publicId}/pdf`, { responseType: 'blob' });
      const isJson = (res.headers as Record<string, string> | undefined)?.['content-type']?.includes('application/json');
      if (isJson) { window.open(`/voucher/${publicId}`, '_blank'); return; }
      const blob: Blob = res.data instanceof Blob ? res.data : new Blob([res.data as unknown as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `voucher_${reserva.numeroReserva || publicId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch {
      window.open(`/voucher/${publicId}`, '_blank');
    } finally {
      setDownloading(false);
    }
  };

  const saldoPendiente = Math.max(0, (reserva.valorTotal || 0) - (reserva.abono || 0));
  const pasajeros = reserva.pasajeros || [];

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Ticket de Vuelo & Boarding Pass"
      size="2xl"
      footer={
        <div className="flex justify-end gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => window.open(`/voucher/${publicId}`, '_blank')}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
          >
            <ExternalLink size={14} />
            Ver voucher
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl text-xs font-bold transition"
          >
            Cerrar
          </button>
          <Button
            type="button"
            onClick={handleDownloadPdf}
            disabled={downloading}
            className="px-6 py-2.5 rounded-2xl text-xs font-black shadow-lg shadow-blue-600/20"
          >
            <Download size={16} />
            <span>{downloading ? 'Descargando…' : 'Descargar PDF'}</span>
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 space-y-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2.5 py-1 rounded-md border border-blue-200 dark:border-blue-900">
                Vuelo Biplaza Tandem
              </span>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mt-2">
                {reserva.nombreTitular}
              </h3>
              <p className="text-xs text-slate-400">{reserva.telefono} • {pasajeros.length} {pasajeros.length === 1 ? 'pasajero' : 'pasajeros'}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Fecha Programada</span>
                <span className="font-extrabold text-slate-800 dark:text-slate-200">
                  {reserva.fechaAgenda
                    ? formatFechaEspanol(reserva.fechaAgenda as string | Date, { day: '2-digit', month: '2-digit', year: 'numeric' })
                    : 'Por coordinar'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Hora</span>
                <span className="font-extrabold text-slate-800 dark:text-slate-200">
                  {reserva.horaAgenda ? `${reserva.horaAgenda} hrs` : 'Por coordinar'}
                </span>
              </div>
              <div className="sm:text-right">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Saldo Restante</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                  {saldoPendiente === 0 ? 'PAGADO ($0)' : formatCLP(saldoPendiente)}
                </span>
              </div>
            </div>

            {/* Desglose de Tarifa y Promoción */}
            {reserva.tarifa && (
              <div className="pt-3 border-t border-slate-200/60 dark:border-slate-700/60 text-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1.5 text-slate-600 dark:text-slate-300">
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{reserva.tarifa.nombre}</span>
                  {Number(reserva.descuento || 0) > 0 && (
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold ml-2">
                      🏷️ {reserva.promocion?.nombre || 'Promo'}: -{formatCLP(Number(reserva.descuento))}
                    </span>
                  )}
                </div>
                <span className="font-extrabold text-slate-900 dark:text-slate-100">
                  Total: {formatCLP(reserva.valorTotal)}
                </span>
              </div>
            )}
          </div>
        </div>
    </Modal>
  );
}
