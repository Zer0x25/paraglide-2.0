"use client";

import { useState, useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  ShieldCheck, Activity, Search, RefreshCw, User,
  DollarSign, Plane, BookOpen, Wrench, Wind, Receipt, Settings,
} from 'lucide-react';
import { useAuditoria } from '../../hooks/useAuditoria';
import { OfflinePageGuard } from '@/components/OfflinePageGuard';

export default function AuditoriaPage() {
  const { logs, loading, refetch, total, totalPages, fetchNextPage, hasNextPage, isFetchingNextPage } = useAuditoria();

  const [entidadFilter, setEntidadFilter] = useState('TODAS');
  const [accionFilter, setAccionFilter] = useState('TODAS');
  const [searchQuery, setSearchQuery] = useState('');
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref con los filtros vigentes: el callback del debounce (400 ms) no debe
  // capturar los valores del render donde se tecleó (stale closure): si el
  // usuario cambia el select antes de que dispare, el timeout revertía el filtro.
  const filtersRef = useRef({ entidad: 'TODAS', accion: 'TODAS' });
  useEffect(() => {
    filtersRef.current = { entidad: entidadFilter, accion: accionFilter };
  }, [entidadFilter, accionFilter]);

  const parentRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual useVirtualizer devuelve funciones no memoizables; skipped compilation es esperado (ver docs TanStack)
  const virtualizer = useVirtualizer({
    count: logs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 96,
    overscan: 6,
  });

  const handleFilterChange = (entidad: string, accion: string, busqueda: string) => {
    refetch(entidad, accion, busqueda);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      handleFilterChange(filtersRef.current.entidad, filtersRef.current.accion, value);
    }, 400);
  };

  useEffect(() => {
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, []);

  const getEntityIcon = (entidad: string) => {
    switch (entidad.toUpperCase()) {
      case 'PAGO':
        return <DollarSign size={16} className="text-emerald-500" />;
      case 'VUELO':
        return <Plane size={16} className="text-cyan-500" />;
      case 'RESERVA':
        return <BookOpen size={16} className="text-blue-500" />;
      case 'EQUIPO':
        return <Wrench size={16} className="text-amber-500" />;
      case 'CLIMA':
      case 'METEOROLOGIA':
        return <Wind size={16} className="text-teal-500" />;
      case 'PILOTO':
        return <User size={16} className="text-indigo-500" />;
      case 'PASAJERO':
        return <User size={16} className="text-violet-500" />;
      case 'GASTO':
        return <Receipt size={16} className="text-red-500" />;
      case 'CONFIGURACION':
        return <Settings size={16} className="text-slate-500" />;
      default:
        return <Activity size={16} className="text-slate-400" />;
    }
  };

  const getActionBadge = (accion: string) => {
    if (accion.includes('ELIMINAR') || accion.includes('ANULAR')) {
      return (
        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900">
          {accion.replace(/_/g, ' ')}
        </span>
      );
    }
    if (accion.includes('CREAR') || accion.includes('REGISTRAR')) {
      return (
        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
          {accion.replace(/_/g, ' ')}
        </span>
      );
    }
    return (
      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
        {accion.replace(/_/g, ' ')}
      </span>
    );
  };

  return (
    <OfflinePageGuard pageTitle="Auditoría y Logs">
      <div className="space-y-6 relative pb-16 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-white/40 dark:bg-slate-900/40 p-5 sm:p-6 rounded-3xl border border-white/60 dark:border-slate-800 backdrop-blur-xl shadow-sm">
        <div>
          <h1 className="text-xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <ShieldCheck className="text-blue-600 dark:text-blue-400 shrink-0" size={28} />
            <span>Auditoría & Bitácora de Actividades</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1">
            Registro cronológico y trazabilidad de operaciones, pagos, reservas y vuelos
          </p>
        </div>

        <button
          onClick={() => refetch(entidadFilter, accionFilter, searchQuery)}
          className="flex items-center justify-center space-x-2 py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl text-xs font-bold transition w-full sm:w-auto"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refrescar Registro</span>
        </button>
      </div>

      {/* Controles de Búsqueda y Filtros */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col md:flex-row gap-3">

        {/* Buscador */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Buscar por usuario, descripción o ID..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Filtros Dropdown */}
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          <select
            value={entidadFilter}
            onChange={(e) => {
              setEntidadFilter(e.target.value);
              handleFilterChange(e.target.value, accionFilter, searchQuery);
            }}
            className="w-full sm:w-auto px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="TODAS">Todas las Entidades</option>
            <option value="RESERVA">Reservas</option>
            <option value="PAGO">Pagos y Abonos</option>
            <option value="VUELO">Vuelos</option>
            <option value="PASAJERO">Pasajeros</option>
            <option value="PILOTO">Pilotos</option>
            <option value="EQUIPO">Equipos</option>
            <option value="CLIMA">Meteorología</option>
            <option value="GASTO">Gastos</option>
            <option value="CONFIGURACION">Configuración de Bloques</option>
          </select>

          <select
            value={accionFilter}
            onChange={(e) => {
              setAccionFilter(e.target.value);
              handleFilterChange(entidadFilter, e.target.value, searchQuery);
            }}
            className="w-full sm:w-auto px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="TODAS">Todas las Acciones</option>
            <option value="CREAR">Creación</option>
            <option value="EDITAR">Modificación</option>
            <option value="ELIMINAR">Eliminación</option>
            <option value="REGISTRAR_PAGO">Registro de Pago</option>
            <option value="ANULAR_PAGO">Anulación de Pago</option>
            <option value="ASIGNAR_VUELO">Asignación de Vuelo</option>
            <option value="CAMBIAR_ESTADO">Cambio de Estado</option>
            <option value="MANTENIMIENTO">Mantenimiento</option>
            <option value="CAMBIAR_ESTADO_PISTA">Estado de Pista</option>
          </select>
        </div>
      </div>

      {/* Feed de Auditoría / Timeline */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 p-4 sm:p-6">
        {loading ? (
          <div className="p-12 sm:p-16 text-center text-slate-400">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-xs">Consultando bitácora de auditoría...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 sm:p-16 text-center text-slate-400 space-y-2">
            <Activity size={36} className="mx-auto text-slate-300 dark:text-slate-700" />
            <p className="font-bold text-slate-700 dark:text-slate-300">No hay registros de auditoría que coincidan</p>
            <p className="text-xs text-slate-400">Las acciones operativas aparecerán automáticamente aquí.</p>
          </div>
        ) : (
          // Pilar 5.3: virtualización — solo renderiza filas visibles
          <div ref={parentRef} className="max-h-[65vh] overflow-y-auto pr-1">
            <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
              {virtualizer.getVirtualItems().map((vi) => {
                const log = logs[vi.index];
                return (
                  <div
                    key={log.id}
                    ref={virtualizer.measureElement}
                    data-index={vi.index}
                    className="absolute left-0 top-0 w-full p-3.5 sm:p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 hover:bg-slate-100/50 dark:hover:bg-slate-800/80 transition flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4"
                    style={{ transform: `translateY(${vi.start}px)` }}
                  >
                <div className="flex items-start space-x-3 sm:space-x-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-bold shadow-2xs shrink-0 mt-0.5">
                    {getEntityIcon(log.entidad)}
                  </div>

                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {getActionBadge(log.accion)}
                      <span className="text-xs font-bold bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-2 py-0.5 rounded-md">
                        {log.entidad} {log.entidadId ? `#${log.entidadId}` : ''}
                      </span>
                    </div>

                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      {log.descripcion}
                    </p>

                    <div className="flex flex-wrap items-center gap-x-3 text-xs text-slate-400">
                      <span>
                        Por: <strong className="text-slate-700 dark:text-slate-300">{log.usuarioNombre || 'Sistema'}</strong>
                      </span>
                      {log.usuarioEmail && (
                        <span className="truncate max-w-[9rem] sm:max-w-none">{log.usuarioEmail}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-left sm:text-right shrink-0 text-xs text-slate-400 pl-[3.25rem] sm:pl-0">
                  <div className="font-mono font-bold text-slate-700 dark:text-slate-300">
                    {new Date(log.fechaHora).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} hrs
                  </div>
                  <div className="text-[11px]">
                    {new Date(log.fechaHora).toLocaleDateString('es-CL', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </div>
                </div>
              </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Carga incremental (Pilar 5.2: keyset + useInfiniteQuery) */}
      {!loading && logs.length > 0 && (
        <div className="flex items-center justify-between flex-wrap gap-3 mt-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {total.toLocaleString('es-CL')} registro{total !== 1 ? 's' : ''} · {totalPages.toLocaleString('es-CL')} página{totalPages !== 1 ? 's' : ''}
          </p>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => fetchNextPage()}
              disabled={!hasNextPage || isFetchingNextPage}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              {isFetchingNextPage ? 'Cargando...' : 'Cargar más ↓'}
            </button>
          </div>
        </div>
      )}

      </div>
    </OfflinePageGuard>
  );
}
