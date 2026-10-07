"use client";

import {
  FileDown, Search, Plane, CheckCircle2, ShieldCheck, AlertTriangle
} from 'lucide-react';
import { ManifiestoDiarioDTO, ManifiestoItemDTO } from '@parapente/shared';

interface ManifiestoDiarioSectionProps {
  fechaManifiesto: string;
  onFechaChange: (fecha: string) => void;
  onFechaRelativa: (offsetDays: number) => void;
  searchManifiesto: string;
  onSearchChange: (query: string) => void;
  onPrint: () => void;
  manifiestoData: ManifiestoDiarioDTO | undefined;
  loadingManifiesto: boolean;
  vuelosFiltrados: ManifiestoItemDTO[];
}

export function ManifiestoDiarioSection({
  fechaManifiesto,
  onFechaChange,
  onFechaRelativa,
  searchManifiesto,
  onSearchChange,
  onPrint,
  manifiestoData,
  loadingManifiesto,
  vuelosFiltrados,
}: ManifiestoDiarioSectionProps) {
  return (
    <div className="space-y-6">
      {/* Barra de Controles (Oculto en Impresión) */}
      <div className="print:hidden bg-white dark:bg-slate-900 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          {/* Selectores de Fecha */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={fechaManifiesto}
              onChange={(e) => onFechaChange(e.target.value)}
              className="border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => onFechaRelativa(-1)}
              className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition"
            >
              Ayer
            </button>
            <button
              onClick={() => onFechaRelativa(0)}
              className="px-3 py-2 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 hover:bg-blue-100 rounded-xl text-xs font-bold transition border border-blue-200 dark:border-blue-900"
            >
              Hoy
            </button>
            <button
              onClick={() => onFechaRelativa(1)}
              className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition"
            >
              Mañana
            </button>
          </div>

          {/* Botones de Acción */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                id="manifiesto-search-input"
                name="searchManifiesto"
                aria-label="Filtrar piloto, pasajero o RUT"
                placeholder="Filtrar piloto, pasajero, RUT..."
                value={searchManifiesto}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={onPrint}
              className="flex items-center space-x-2 py-2 px-4 bg-slate-900 hover:bg-black text-white dark:bg-white dark:text-slate-900 rounded-2xl text-xs font-bold shadow-md transition shrink-0"
            >
              <FileDown size={15} />
              <span>Descargar PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Encabezado Oficial para Impresión Física / PDF */}
      <div className="hidden print:block border-b-2 border-black pb-4 mb-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-black uppercase tracking-tight text-black">
              MANIFIESTO DIARIO DE VUELO EN PARAPENTE
            </h1>
            <p className="text-xs text-black mt-0.5">Control de Operaciones y Seguridad Operacional</p>
          </div>
          <div className="text-right text-xs text-black">
            <p className="font-bold">Fecha: {fechaManifiesto}</p>
            <p>Generado: {new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        </div>
      </div>

      {/* Tarjetas de Resumen Rápido (Oculto en Impresión) */}
      <div className="print:hidden grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <Plane size={24} />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase">Total Vuelos Programados</span>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{manifiestoData?.totalVuelos || 0}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase">Vuelos Completados</span>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{manifiestoData?.totalCompletados || 0}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
            <ShieldCheck size={24} />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase">Deslindes Firmados</span>
            <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
              {manifiestoData?.totalFirmados || 0} / {manifiestoData?.totalVuelos || 0}
            </p>
          </div>
        </div>
      </div>

      {/* Tabla Oficial de Manifiesto */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden print:border-black print:rounded-none print:shadow-none">
        {loadingManifiesto ? (
          <div className="p-12 text-center text-slate-400">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-xs">Cargando manifiesto del día...</p>
          </div>
        ) : vuelosFiltrados.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <Plane size={36} className="mx-auto text-slate-300 dark:text-slate-700" />
            <p className="font-bold text-slate-700 dark:text-slate-300">No hay vuelos programados para esta fecha</p>
            <p className="text-xs text-slate-400">Prueba seleccionando otro día en el calendario.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-extrabold uppercase print:bg-slate-100 print:text-black print:border-black">
                  <th className="py-3 px-3 w-14">Hora</th>
                  <th className="py-3 px-3">Piloto al Mando</th>
                  <th className="py-3 px-3">Pasajero / Titular</th>
                  <th className="py-3 px-3">RUT / DNI</th>
                  <th className="py-3 px-3 text-center">Peso</th>
                  <th className="py-3 px-3">Contacto Emergencia</th>
                  <th className="py-3 px-3 text-center">Deslinde</th>
                  <th className="py-3 px-3 text-right">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 print:divide-black">
                {vuelosFiltrados.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition print:text-black">
                    <td className="py-3 px-3 font-extrabold text-blue-600 dark:text-blue-400 print:text-black whitespace-nowrap">
                      {v.hora}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900 dark:text-slate-100 print:text-black">{v.pilotoNombre}</div>
                      <div className="text-[10px] text-slate-400 print:text-black flex items-center gap-1">
                        {v.pilotoCategoria && <span>Cat: {v.pilotoCategoria}</span>}
                        {v.pilotoLicencia ? <span className="text-emerald-600 font-bold">• Lic. Vigente</span> : <span className="text-amber-500">• Sin Lic.</span>}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900 dark:text-slate-100 print:text-black">{v.pasajeroNombre}</div>
                      {v.reservaNumero && (
                        <div className="text-[10px] text-slate-400 print:text-black">Reserva: #{v.reservaNumero}</div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-400 print:text-black font-mono">
                      {v.pasajeroRut || (v as unknown as { pasajeroRutDni?: string }).pasajeroRutDni || 'N/A'}
                    </td>
                    <td className="py-3 px-3 text-center font-semibold text-slate-700 dark:text-slate-300 print:text-black">
                      {v.pasajeroPesoVerificado ? `${v.pasajeroPesoVerificado} kg` : v.pasajeroPeso ? `${v.pasajeroPeso} kg` : '—'}
                    </td>
                    <td className="py-3 px-3">
                      {v.pasajeroContactoEmergencia ? (
                        <div>
                          <div className="font-medium">{v.pasajeroContactoEmergencia}</div>
                          <div className="text-[10px] text-slate-400 print:text-black">{v.pasajeroTelefonoEmergencia || ''}</div>
                        </div>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {v.pasajeroFirmaDeslinde ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 rounded-full print:border print:border-black">
                          <CheckCircle2 size={11} /> Firmado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-100 dark:bg-red-950 dark:text-red-300 px-2 py-0.5 rounded-full">
                          <AlertTriangle size={11} /> Pendiente
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
                        v.estado === 'COMPLETADO' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                        v.estado === 'CANCELADO' ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300' :
                        'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
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

      {/* Firmas de Control en Impresión */}
      <div className="hidden print:grid grid-cols-3 gap-8 pt-12 text-center text-xs text-black">
        <div className="border-t border-black pt-2">
          <p className="font-bold">Director de Vuelo / Operaciones</p>
          <p className="text-[10px]">Firma y Timbre</p>
        </div>
        <div className="border-t border-black pt-2">
          <p className="font-bold">Responsable de Seguridad</p>
          <p className="text-[10px]">Firma y Timbre</p>
        </div>
        <div className="border-t border-black pt-2">
          <p className="font-bold">Recepción / Pista</p>
          <p className="text-[10px]">Verificación de Deslindes</p>
        </div>
      </div>
    </div>
  );
}
