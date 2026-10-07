"use client";

import { QrCode, ShieldCheck } from 'lucide-react';

interface PantallaSidebarInfoProps {
  qrDataUrl: string;
}

export function PantallaSidebarInfo({ qrDataUrl }: PantallaSidebarInfoProps) {
  return (
    <div className="lg:col-span-1 space-y-6 flex flex-col justify-between">
      {/* Tarjeta de Check-in con QR */}
      <div className="bg-linear-to-br from-slate-900 to-blue-950 border border-slate-800 p-6 rounded-3xl shadow-2xl text-center space-y-4">
        <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold mx-auto">
          <QrCode size={22} />
        </div>

        <div>
          <h3 className="font-black text-base text-white">
            ¿Aún no firmas tu deslinde?
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Escanea con la cámara de tu celular para completar tus datos médicos antes del vuelo.
          </p>
        </div>

        {qrDataUrl && (
          <div className="p-3 bg-white rounded-2xl inline-block shadow-md mx-auto">
            {/* eslint-disable-next-line @next/next/no-img-element -- data URL base64, not optimizable by next/image */}
            <img src={qrDataUrl} alt="QR Check-in" className="w-32 h-32" />
          </div>
        )}

        <div className="text-[11px] font-bold text-cyan-300 bg-cyan-950/60 py-1.5 px-3 rounded-xl border border-cyan-900/60">
          Obligatorio para todos los pasajeros
        </div>
      </div>

      {/* Tarjeta de Normas de Seguridad en Despegue */}
      <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-3xl shadow-xl space-y-2.5 text-xs text-slate-300">
        <h4 className="font-black text-white uppercase flex items-center gap-1.5 text-xs">
          <ShieldCheck size={16} className="text-emerald-400" />
          Normas de Seguridad en Pista:
        </h4>
        <ul className="space-y-1.5 text-[11px] text-slate-400 list-disc list-inside">
          <li>Permanecer detrás de la línea de despegue.</li>
          <li>Atender atentamente las instrucciones del piloto.</li>
          <li>No correr hasta que el piloto dé la orden de carrera.</li>
          <li>Mantener calzado cerrado ajustado.</li>
        </ul>
      </div>
    </div>
  );
}
