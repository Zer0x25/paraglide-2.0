"use client";

import { Download, DollarSign, Plane, ChevronDown, ChevronUp } from 'lucide-react';
import { formatCLP } from '@/utils/format';
import { ReporteLiquidacionesDTO } from '@parapente/shared';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function legacyNumber(obj: unknown, key: string): number | undefined {
  if (obj !== null && typeof obj === 'object') {
    const v = (obj as Record<string, unknown>)[key];
    return typeof v === 'number' ? v : undefined;
  }
  return undefined;
}
function legacyString(obj: unknown, key: string): string | undefined {
  if (obj !== null && typeof obj === 'object') {
    const v = (obj as Record<string, unknown>)[key];
    return typeof v === 'string' ? v : undefined;
  }
  return undefined;
}

interface LiquidacionesSectionProps {
  targetMonth: number;
  onMonthChange: (m: number) => void;
  targetYear: number;
  onYearChange: (y: number) => void;
  onDownloadCsv: () => void;
  liquidacionesData: ReporteLiquidacionesDTO | undefined;
  loadingLiquidaciones: boolean;
  expandedPilotoId: number | null;
  onToggleExpandPiloto: (id: number) => void;
}

export function LiquidacionesSection({
  targetMonth,
  onMonthChange,
  targetYear,
  onYearChange,
  onDownloadCsv,
  liquidacionesData,
  loadingLiquidaciones,
  expandedPilotoId,
  onToggleExpandPiloto,
}: LiquidacionesSectionProps) {
  return (
    <div className="space-y-6">
      {/* Controles de Período */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <select
              value={targetMonth}
              onChange={(e) => onMonthChange(Number(e.target.value))}
              className="w-full sm:w-auto border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-500"
            >
              {MESES.map((m, idx) => (
                <option key={idx} value={idx}>{m}</option>
              ))}
            </select>

            <select
              value={targetYear}
              onChange={(e) => onYearChange(Number(e.target.value))}
              className="w-full sm:w-auto border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-500"
            >
              {[2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Botón Descargar Excel .xlsx nativo (csv legacy sigue en /liquidaciones/csv) */}
          <button
            onClick={onDownloadCsv}
            className="w-full sm:w-auto flex items-center justify-center space-x-2 py-2.5 px-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold shadow-md transition"
          >
            <Download size={16} />
            <span>Exportar Liquidaciones a Excel (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Tarjetas de Resumen Global */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-linear-to-br from-slate-900 to-slate-800 text-white p-6 rounded-3xl shadow-md flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total a Pagar a Pilotos</span>
            <p className="text-3xl font-black text-emerald-400 mt-1">
              {formatCLP(liquidacionesData?.totalMontoGlobal ?? legacyNumber(liquidacionesData, 'totalPagarPilotos') ?? 0)}
            </p>
            <p className="text-xs text-slate-400 mt-1">Período: {liquidacionesData?.periodo || `${MESES[targetMonth]} ${targetYear}`}</p>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center font-bold">
            <DollarSign size={28} className="text-emerald-400" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Vuelos Completados</span>
            <p className="text-3xl font-black text-slate-900 dark:text-white mt-1">
              {liquidacionesData?.totalVuelosGlobal ?? legacyNumber(liquidacionesData, 'totalVuelos') ?? 0}
            </p>
            <p className="text-xs text-slate-400 mt-1">Vuelos liquidados con éxito</p>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950 flex items-center justify-center font-bold text-blue-600 dark:text-blue-400">
            <Plane size={28} />
          </div>
        </div>
      </div>

      {/* Lista de Liquidaciones por Piloto */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-slate-800 dark:text-slate-200">
          Desglose Individual por Piloto ({liquidacionesData?.pilotos.length || 0})
        </h2>

        {loadingLiquidaciones ? (
          <div className="p-12 text-center text-slate-400">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-xs">Calculando liquidaciones del período...</p>
          </div>
        ) : (liquidacionesData?.pilotos || []).length === 0 ? (
          <div className="p-12 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800">
            No hay pilotos registrados.
          </div>
        ) : (
          (liquidacionesData?.pilotos || []).map((piloto) => {
            const isExpanded = expandedPilotoId === piloto.pilotoId;
            const vuelos = piloto.vuelos || [];
            const totalVuelosCompletados = piloto.totalVuelosCompletados ?? legacyNumber(piloto, 'totalVuelos') ?? 0;
            const totalAPagar = piloto.totalAPagar ?? legacyNumber(piloto, 'totalGanado') ?? 0;

            return (
              <div
                key={piloto.pilotoId}
                className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden transition"
              >
                <div 
                  onClick={() => onToggleExpandPiloto(piloto.pilotoId)}
                  className="p-5 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-black text-lg shadow-sm">
                      {(piloto.nombre || legacyString(piloto, 'nombrePiloto') || 'P').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                        {piloto.nombre || legacyString(piloto, 'nombrePiloto') || 'Piloto'}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Tarifa Base: <strong>{formatCLP(piloto.tarifaBase || legacyNumber(piloto, 'tarifaPorVuelo') || 0)}</strong> por vuelo • {piloto.telefono || 'Sin teléfono'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto">
                    <div className="text-left sm:text-right">
                      <span className="text-xs text-slate-400 block">Vuelos Completados</span>
                      <span className="font-extrabold text-sm text-slate-800 dark:text-slate-200">
                        {totalVuelosCompletados} {totalVuelosCompletados === 1 ? 'vuelo' : 'vuelos'}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-xs text-slate-400 block">Monto a Liquidar</span>
                      <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                        {formatCLP(totalAPagar)}
                      </span>
                    </div>

                    <div className="text-slate-400">
                      {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                  </div>
                </div>

                {/* Detalle Desplegable de Vuelos del Piloto */}
                {isExpanded && (
                  <div className="p-5 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 space-y-3 animate-in fade-in duration-200">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Detalle de Vuelos Realizados ({vuelos.length})
                    </h4>

                    {vuelos.length === 0 ? (
                      <p className="text-xs text-slate-400 py-2">No registró vuelos en este período.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 uppercase font-bold">
                              <th className="py-2 px-2">ID</th>
                              <th className="py-2 px-2">Fecha y Hora</th>
                              <th className="py-2 px-2">Pasajero</th>
                              <th className="py-2 px-2 text-right">Pago Piloto</th>
                              <th className="py-2 px-2 text-right">Estado</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200/60 dark:divide-slate-700/60">
                            {vuelos.map((v) => (
                              <tr key={v.vueloId}>
                                <td className="py-2.5 px-2 font-mono text-slate-400">#{v.vueloId}</td>
                                <td className="py-2.5 px-2 font-medium text-slate-700 dark:text-slate-300">
                                  {new Date(v.fechaHora).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </td>
                                <td className="py-2.5 px-2 font-bold text-slate-800 dark:text-slate-200">{v.pasajeroNombre}</td>
                                <td className="py-2.5 px-2 text-right font-extrabold text-emerald-600 dark:text-emerald-400">
                                  {formatCLP(v.pagoPiloto)}
                                </td>
                                <td className="py-2.5 px-2 text-right">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                    v.estado === 'COMPLETADO' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-200 text-slate-600'
                                  }`}>
                                    {v.estado}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
