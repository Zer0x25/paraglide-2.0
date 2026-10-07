"use client";

import { formatCLP } from '@/utils/format';

interface ReservaCardFinancialsProps {
  estadoPago: string;
  valorTotal: number;
  saldoPendiente: number;
}

export function ReservaCardFinancials({
  estadoPago,
  valorTotal,
  saldoPendiente,
}: ReservaCardFinancialsProps) {
  const badgeColor =
    estadoPago === 'PAGADO'
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
      : estadoPago === 'ABONADO'
      ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
      : estadoPago === 'DEVUELTO'
      ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
      : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300';

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 mb-4">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-slate-500 dark:text-slate-400">Pago:</span>
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${badgeColor}`}>
          {estadoPago}
        </span>
      </div>
      {valorTotal > 0 && (
        <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
          <span>{formatCLP(valorTotal)}</span>
          {saldoPendiente > 0 && (
            <span className="text-amber-600 dark:text-amber-400 ml-1.5 font-medium text-[11px]">
              (Resta: {formatCLP(saldoPendiente)})
            </span>
          )}
        </div>
      )}
    </div>
  );
}
