"use client";

import { Tag } from 'lucide-react';
import { formatCLP } from '@/utils/format';
import type { TarifaPublica, PromocionPublica } from '../types';

interface VoucherTarifaDetailProps {
  tarifa: TarifaPublica;
  promocion?: PromocionPublica | null;
  descuento?: number | null;
  valorTotal: number;
  pasajerosCount: number;
}

export function VoucherTarifaDetail({
  tarifa,
  promocion,
  descuento,
  valorTotal,
  pasajerosCount,
}: VoucherTarifaDetailProps) {
  const count = Math.max(1, pasajerosCount);

  return (
    <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-700 space-y-2.5 print:border-black print:bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block print:text-black">
          Detalle de la Experiencia Contratada
        </span>
        <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-900 print:text-black print:border-black">
          Tarifa Oficial
        </span>
      </div>

      {/* Fila Tarifa Base */}
      <div className="flex justify-between items-center text-xs">
        <div>
          <p className="font-extrabold text-slate-900 dark:text-slate-100 print:text-black">
            {tarifa.nombre}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 print:text-black">
            {count} {count === 1 ? 'vuelo' : 'vuelos'} × {formatCLP(tarifa.precio)}
          </p>
        </div>
        <span className="font-bold text-slate-900 dark:text-slate-100 print:text-black">
          {formatCLP(tarifa.precio * count)}
        </span>
      </div>

      {/* Fila Promoción (si aplica) */}
      {Number(descuento || 0) > 0 && (
        <div className="flex justify-between items-center text-xs text-emerald-700 dark:text-emerald-400 pt-2 border-t border-dashed border-slate-200 dark:border-slate-700 print:text-black">
          <div>
            <p className="font-extrabold flex items-center gap-1.5">
              <Tag size={13} className="text-emerald-600 dark:text-emerald-400 print:text-black" />
              {promocion?.nombre || 'Descuento Promocional'}
            </p>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400/90 print:text-black">
              {promocion?.tipoDescuento === 'PORCENTAJE'
                ? `Descuento ${promocion.valor}%`
                : `Descuento ${formatCLP(promocion?.valor || Number(descuento) / count)}/vuelo × ${count} ${count === 1 ? 'vuelo' : 'vuelos'}`}
            </p>
          </div>
          <span className="font-extrabold text-emerald-700 dark:text-emerald-400 print:text-black">
            -{formatCLP(Number(descuento))}
          </span>
        </div>
      )}

      {/* Fila Total de la Reserva */}
      <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-200 dark:border-slate-700">
        <span className="font-bold text-slate-600 dark:text-slate-400 uppercase text-[10px] tracking-wider print:text-black">
          Valor Total de la Reserva
        </span>
        <span className="font-black text-sm text-slate-900 dark:text-slate-100 print:text-black">
          {formatCLP(valorTotal)}
        </span>
      </div>
    </div>
  );
}
