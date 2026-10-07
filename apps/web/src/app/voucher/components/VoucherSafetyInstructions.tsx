"use client";

import { Sparkles } from 'lucide-react';

export function VoucherSafetyInstructions() {
  return (
    <div className="p-4 bg-blue-50/60 dark:bg-blue-950/30 rounded-2xl border border-blue-100 dark:border-blue-900/50 text-xs space-y-2 text-slate-800 dark:text-slate-200 print:border-black">
      <h4 className="font-extrabold text-blue-900 dark:text-blue-300 uppercase flex items-center gap-1.5 print:text-black">
        <Sparkles size={14} className="text-blue-600 dark:text-blue-400" />
        Recomendaciones Importantes para tu Vuelo:
      </h4>
      <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-700 dark:text-slate-300 print:text-black">
        <li>
          <strong>Calzado:</strong> Zapatillas deportivas o bototos de trekking (prohibido sandalias o tacones).
        </li>
        <li>
          <strong>Vestimenta:</strong> Pantalón largo y cortavientos o abrigo ligero según la temperatura.
        </li>
        <li>
          <strong>Llegada:</strong> Estar en la zona de despegue con 15 minutos de anticipación.
        </li>
        <li>
          <strong>Límite de peso:</strong> El peso máximo por pasajero es de 115 kg por seguridad operacional.
        </li>
      </ul>
    </div>
  );
}
