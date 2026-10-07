"use client";

interface VoucherLocationCardProps {
  puntoDeEncuentro: string;
}

export function VoucherLocationCard({ puntoDeEncuentro }: VoucherLocationCardProps) {
  return (
    <div>
      <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block">
        Punto de Encuentro
      </span>
      <p className="font-extrabold text-sm text-slate-900 dark:text-slate-100 mt-0.5">
        {puntoDeEncuentro}
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Pista Principal de Vuelo</p>
      <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">
        Presentarse 15 min antes
      </p>
    </div>
  );
}
