"use client";

import { Lock } from 'lucide-react';

export function PantallaAccesoRestringido() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-8 text-center">
      <div className="w-16 h-16 rounded-3xl bg-slate-800 flex items-center justify-center mb-6">
        <Lock size={28} className="text-slate-400" />
      </div>
      <h1 className="text-2xl font-black tracking-tight mb-2">Enlace no disponible</h1>
      <p className="text-slate-400 max-w-md text-sm leading-relaxed mb-8">
        El tablero de vuelos en vivo está disponible solo el día de tu vuelo, mediante el enlace
        que te envía la escuela. Si este enlace caducó o tu vuelo ya fue, solicita uno nuevo por WhatsApp.
      </p>
      <a
        href="/reservas"
        className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 rounded-2xl text-xs font-black transition"
      >
        Ir a Reservas
      </a>
    </div>
  );
}
