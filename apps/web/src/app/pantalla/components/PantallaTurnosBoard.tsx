"use client";

import { Plane, CheckCircle2, AlertTriangle, Sparkles } from 'lucide-react';
import { PantallaData } from '../hooks/usePantallaController';

interface PantallaTurnosBoardProps {
  data: PantallaData | null;
  loading: boolean;
}

export function PantallaTurnosBoard({ data, loading }: PantallaTurnosBoardProps) {
  return (
    <div className="lg:col-span-3 bg-slate-900/70 border border-slate-800 rounded-3xl p-6 flex flex-col justify-between shadow-2xl backdrop-blur-md">
      <div className="space-y-4">
        <div className="flex justify-between items-center pb-3 border-b border-slate-800">
          <h2 className="text-lg font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Plane size={18} className="text-cyan-400" />
            <span>Turnos de Vuelo de Hoy</span>
          </h2>

          <div className="text-xs text-slate-400 font-bold">
            Total programados: <strong className="text-white">{data?.totalVuelos || 0}</strong> • Completados:{' '}
            <strong className="text-emerald-400">{data?.completados || 0}</strong>
          </div>
        </div>

        {loading ? (
          <div className="p-16 text-center text-slate-500">
            <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-xs">Actualizando salidas en tiempo real...</p>
          </div>
        ) : (data?.vuelos || []).length === 0 ? (
          <div className="p-16 text-center text-slate-500 space-y-2">
            <Plane size={48} className="mx-auto text-slate-800" />
            <p className="text-base font-bold text-slate-400">No hay vuelos programados para hoy</p>
            <p className="text-xs text-slate-600">Los vuelos agendados aparecerán automáticamente aquí.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500 font-black uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-3 w-16">Hora</th>
                  <th className="py-3 px-4">Pasajero</th>
                  <th className="py-3 px-4">Piloto al Mando</th>
                  <th className="py-3 px-3 text-center">Deslinde</th>
                  <th className="py-3 px-3 text-right">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {(data?.vuelos || []).map((vuelo) => (
                  <tr key={vuelo.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-4 px-3 font-mono font-black text-sm text-cyan-400">
                      {vuelo.hora}
                    </td>
                    <td className="py-4 px-4 font-bold text-sm text-white">
                      {vuelo.pasajeroNombre}
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-bold text-slate-200 text-sm">{vuelo.pilotoNombre}</div>
                      <span className="text-[10px] text-slate-500 uppercase font-bold">
                        Cat. {vuelo.pilotoCategoria || 'MASTER'}
                      </span>
                    </td>
                    <td className="py-4 px-3 text-center">
                      {vuelo.pasajeroFirmaDeslinde ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-400 bg-emerald-950/80 border border-emerald-800/60 px-3 py-1 rounded-full">
                          <CheckCircle2 size={12} /> LISTO
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-black text-amber-400 bg-amber-950/80 border border-amber-800/60 px-3 py-1 rounded-full">
                          <AlertTriangle size={12} /> FIRMAR DESLINDE
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-3 text-right">
                      <span
                        className={`text-[11px] font-black uppercase px-3 py-1 rounded-xl shadow-xs ${
                          vuelo.estado === 'COMPLETADO'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : vuelo.estado === 'CANCELADO'
                            ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                            : 'bg-blue-500/20 text-cyan-300 border border-cyan-500/40'
                        }`}
                      >
                        {vuelo.estado === 'AGENDADO' ? 'EMBARCANDO' : vuelo.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500 font-medium">
        <span className="flex items-center gap-1.5">
          <Sparkles size={13} className="text-cyan-400" />
          Actualización en tiempo real activa (Auto-refresh 10s)
        </span>
        <span>Paraglide TV FIDS v1.0</span>
      </div>
    </div>
  );
}
