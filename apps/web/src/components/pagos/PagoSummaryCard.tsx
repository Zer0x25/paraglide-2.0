"use client";

import { formatCLP } from '../../utils/format';

interface PagoSummaryCardProps {
  valorTotal: number;
  abonoActual: number;
  saldoPendiente: number;
  porcentajePagado: number;
  estadoPago?: string;
  montoDevuelto?: number;
}

export function PagoSummaryCard({
  valorTotal,
  abonoActual,
  saldoPendiente,
  porcentajePagado,
  estadoPago,
  montoDevuelto,
}: PagoSummaryCardProps) {
  return (
    <div className="bg-linear-to-br from-slate-900 to-slate-800 text-white p-5 rounded-3xl shadow-md space-y-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <span className="text-[11px] text-slate-400 uppercase font-bold tracking-wider">Total Vuelo</span>
          <p className="text-sm sm:text-lg font-black text-white mt-0.5 break-words">{formatCLP(valorTotal)}</p>
        </div>
        <div className="border-x border-slate-700">
          <span className="text-[11px] text-emerald-400 uppercase font-bold tracking-wider">Abonado</span>
          <p className="text-sm sm:text-lg font-black text-emerald-400 mt-0.5 break-words">{formatCLP(abonoActual)}</p>
        </div>
        <div>
          <span className="text-[11px] text-amber-400 uppercase font-bold tracking-wider">Saldo Restante</span>
          <p className="text-sm sm:text-lg font-black text-amber-400 mt-0.5 break-words">{formatCLP(saldoPendiente)}</p>
        </div>
      </div>

      {estadoPago === 'DEVUELTO' && (
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="col-span-2 rounded-2xl bg-red-500/10 border border-red-500/30 px-3 py-2">
            <span className="text-[11px] text-red-400 uppercase font-bold tracking-wider">Devuelto</span>
            <p className="text-sm sm:text-lg font-black text-red-400 mt-0.5 break-words">{formatCLP(montoDevuelto || 0)}</p>
          </div>
        </div>
      )}

      {/* Barra de Progreso */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-slate-300">
          <span>Progreso de Pago</span>
          <span className="font-bold">{porcentajePagado}%</span>
        </div>
        <div className="w-full h-2.5 bg-slate-700 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-500 rounded-full ${
              porcentajePagado === 100 ? 'bg-emerald-500' : 'bg-blue-500'
            }`}
            style={{ width: `${porcentajePagado}%` }}
          />
        </div>
      </div>
    </div>
  );
}
