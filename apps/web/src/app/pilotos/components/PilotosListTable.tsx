"use client";

import { Edit2, Calendar as CalendarIcon, ArrowUp, ArrowDown } from 'lucide-react';
import type { PilotoDTO } from '@parapente/shared';

export function licenciaEstado(p: PilotoDTO): 'Vigente' | 'Vencida' | 'Sin Licencia' {
  if (!p.tieneLicencia) return 'Sin Licencia';
  if (!p.fechaVencimientoLicencia) return 'Vigente';
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const vence = new Date(p.fechaVencimientoLicencia);
  return vence >= hoy ? 'Vigente' : 'Vencida';
}

interface PilotosListTableProps {
  loading: boolean;
  pilotos: PilotoDTO[];
  filteredPilotos: PilotoDTO[];
  sortField: string;
  sortDirection: 'asc' | 'desc';
  onSort: (field: string) => void;
  onOpenAvailModal: (piloto: PilotoDTO) => void;
  onOpenEditModal: (piloto: PilotoDTO) => void;
}

export function PilotosListTable({
  loading,
  pilotos,
  filteredPilotos,
  sortField,
  sortDirection,
  onSort,
  onOpenAvailModal,
  onOpenEditModal,
}: PilotosListTableProps) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
      {loading ? (
        <p className="p-6 text-slate-500 dark:text-slate-400 text-center">Cargando pilotos...</p>
      ) : (
        <>
          {/* Mobile Card List (< md) */}
          <div className="block md:hidden divide-y divide-slate-100 dark:divide-slate-800/60">
            {filteredPilotos.map((p) => (
              <div key={p.id} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold px-2 py-0.5 rounded text-xs">#{p.prioridad}</span>
                    <h3 className="font-bold text-slate-900 dark:text-white text-base">{p.nombre}</h3>
                  </div>
                  <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${p.activo ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'}`}>
                    {p.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-lg border border-slate-100 dark:border-slate-700/60">
                  <div>
                    <span className="font-medium text-slate-400 dark:text-slate-500 block">Contacto:</span>
                    <p className="text-slate-700 dark:text-slate-200 truncate">{p.email || 'Sin email'}</p>
                    <p className="text-slate-700 dark:text-slate-200">{p.telefono || 'Sin teléfono'}</p>
                  </div>
                  <div>
                    <span className="font-medium text-slate-400 dark:text-slate-500 block">Detalles:</span>
                    <p className="text-slate-700 dark:text-slate-200">{p.rutDni || 'Sin RUT/DNI'}</p>
                    <p className="text-slate-700 dark:text-slate-200">{p.peso ? `${p.peso} kg` : 'Peso N/A'}</p>
                    <p className={
                      licenciaEstado(p) === 'Vigente' ? 'text-green-600 font-medium' :
                      licenciaEstado(p) === 'Vencida' ? 'text-red-600 font-medium' : 'text-slate-400 dark:text-slate-500'
                    }>
                      {licenciaEstado(p) === 'Vigente' ? '✓ Licencia Vigente' : licenciaEstado(p) === 'Vencida' ? '⚠ Licencia Vencida' : 'Sin Licencia'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-2 pt-1">
                  <button 
                    onClick={() => onOpenAvailModal(p)} 
                    className="flex-1 flex items-center justify-center space-x-1.5 px-3 py-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-950 transition cursor-pointer"
                  >
                    <CalendarIcon size={14} />
                    <span>Disponibilidad</span>
                  </button>
                  <button 
                    onClick={() => onOpenEditModal(p)} 
                    className="flex-1 flex items-center justify-center space-x-1.5 px-3 py-2 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-semibold hover:bg-blue-100 dark:hover:bg-blue-950 transition cursor-pointer"
                  >
                    <Edit2 size={14} />
                    <span>Editar</span>
                  </button>
                </div>
              </div>
            ))}
            {filteredPilotos.length === 0 && (
              <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                {pilotos.length === 0 ? 'No hay pilotos registrados aún.' : 'Sin resultados para la búsqueda.'}
              </div>
            )}
          </div>

          {/* Desktop Table (>= md) */}
          <div className="hidden md:block overflow-x-auto overflow-y-auto max-h-[65vh]">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
              <thead className="bg-slate-50 dark:bg-slate-800/60 sticky top-0 z-10">
                <tr>
                  <th onClick={() => onSort('prioridad')} className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800">
                    <div className="flex items-center space-x-1">
                      <span>Cat/Prio</span>
                      {sortField === 'prioridad' && (sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                    </div>
                  </th>
                  <th onClick={() => onSort('nombre')} className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800">
                    <div className="flex items-center space-x-1">
                      <span>Nombre/Email</span>
                      {sortField === 'nombre' && (sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                    </div>
                  </th>
                  <th onClick={() => onSort('email')} className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800">
                    <div className="flex items-center space-x-1">
                      <span>Teléfono / RUT</span>
                      {sortField === 'email' && (sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                    </div>
                  </th>
                  <th onClick={() => onSort('peso')} className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800">
                    <div className="flex items-center space-x-1">
                      <span>Peso / Lic.</span>
                      {sortField === 'peso' && (sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                    </div>
                  </th>
                  <th onClick={() => onSort('activo')} className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800">
                    <div className="flex items-center space-x-1">
                      <span>Estado</span>
                      {sortField === 'activo' && (sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                {filteredPilotos.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-7 h-7 flex items-center justify-center rounded-md text-xs font-bold border ${
                          p.categoria === 'MASTER' ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900' :
                          p.categoria === 'SENIOR' ? 'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900' :
                          p.categoria === 'JUNIOR' ? 'bg-green-100 text-green-900 border-green-300 dark:bg-green-950 dark:text-green-300 dark:border-green-900' :
                          'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}>
                          {(p.categoria || 'MASTER').charAt(0)}
                        </span>
                        <span className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold px-1.5 py-0.5 rounded text-[11px] text-center">
                          #{p.prioridad || 1}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-slate-900 dark:text-white">{p.nombre}</div>
                      {p.email && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 pl-3">{p.email}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {p.telefono ? (
                        <a
                          href={`https://wa.me/${p.telefono.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-700 dark:text-slate-200 hover:text-green-600 dark:hover:text-green-400 transition-colors"
                        >
                          {p.telefono}
                        </a>
                      ) : (
                        <span className="text-xs text-slate-500 dark:text-slate-400">-</span>
                      )}
                      <div className="text-xs text-slate-500 dark:text-slate-400 pl-3">{p.rutDni || 'Sin RUT'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs">
                      <div className="font-medium text-slate-700 dark:text-slate-200">Piloto: {p.peso ? `${p.peso} kg` : '-'}</div>
                      <div className="text-indigo-600 dark:text-indigo-400 font-medium">Pasajero: {p.pesoMinimoPasajero || 30}kg - {p.pesoMaximoPasajero || 110}kg</div>
                      <div className={
                        licenciaEstado(p) === 'Vigente' ? 'text-green-600 dark:text-green-400' :
                        licenciaEstado(p) === 'Vencida' ? 'text-red-600 dark:text-red-400' : 'text-slate-400 dark:text-slate-500'
                      }>
                        {licenciaEstado(p) === 'Vigente' ? '✓ Licencia Vigente' : licenciaEstado(p) === 'Vencida' ? '⚠ Licencia Vencida' : 'Sin Licencia'}
                        {p.numeroLicencia ? ` · ${p.numeroLicencia}` : ''}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-[10px] leading-5 font-semibold rounded-full ${p.activo ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'}`}>
                        {p.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium flex space-x-3">
                      <button onClick={() => onOpenAvailModal(p)} className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 flex items-center space-x-1 cursor-pointer">
                        <CalendarIcon size={16} />
                        <span>Disponibilidad</span>
                      </button>
                      <button onClick={() => onOpenEditModal(p)} className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 flex items-center space-x-1 cursor-pointer">
                        <Edit2 size={16} />
                        <span>Editar</span>
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredPilotos.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                      {pilotos.length === 0 ? 'No hay pilotos registrados aún.' : 'Sin resultados para la búsqueda.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
