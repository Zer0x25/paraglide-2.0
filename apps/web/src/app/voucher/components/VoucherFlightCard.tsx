"use client";

interface VoucherFlightCardProps {
  nombreTitular: string;
  telefono: string;
  fechaFormateada: string;
  horaAgenda?: string | null;
}

export function VoucherFlightCard({
  nombreTitular,
  telefono,
  fechaFormateada,
  horaAgenda,
}: VoucherFlightCardProps) {
  return (
    <div className="space-y-4">
      <div>
        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block">
          Titular de Reserva
        </span>
        <p className="font-extrabold text-base text-slate-900 dark:text-slate-100 mt-0.5">
          {nombreTitular}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
          {telefono}
        </p>
      </div>

      <div>
        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block">
          Fecha del Vuelo
        </span>
        <p className="font-extrabold text-sm text-slate-900 dark:text-slate-100 mt-0.5 capitalize">
          {fechaFormateada}
        </p>
        {horaAgenda ? (
          <p className="font-extrabold text-sm text-slate-900 dark:text-slate-100 mt-0.5">
            🕐 {horaAgenda} hrs
          </p>
        ) : null}
      </div>
    </div>
  );
}
