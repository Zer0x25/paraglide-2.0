import { useState } from 'react';
import { Search, X, Filter, ChevronDown, RotateCcw } from 'lucide-react';
import type { EstadoReservaFilter, DeslindeFilter } from '../hooks/useReservasController';
import type { ReservasFiltros } from '../../../hooks/useReservas';

interface ReservasFiltersProps {
  filtros: ReservasFiltros;
  setFiltros: (f: Partial<ReservasFiltros>) => void;
  total: number;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onClearSearch: () => void;
  estadoReservaFilter: EstadoReservaFilter;
  setEstadoReservaFilter: (val: EstadoReservaFilter) => void;
  deslindeFilter: DeslindeFilter;
  setDeslindeFilter: (val: DeslindeFilter) => void;
  reservasFiltradasCount: number;
}

export function ReservasFilters({
  filtros,
  setFiltros,
  total,
  searchQuery,
  onSearchChange,
  onClearSearch,
  estadoReservaFilter,
  setEstadoReservaFilter,
  deslindeFilter,
  setDeslindeFilter,
  reservasFiltradasCount,
}: ReservasFiltersProps) {
  const [showFilters, setShowFilters] = useState(false);

  const activeFiltersCount = [
    estadoReservaFilter !== 'TODOS',
    Boolean(filtros.estado && filtros.estado !== 'TODOS'),
    deslindeFilter !== 'TODOS',
  ].filter(Boolean).length;

  const handleResetFilters = () => {
    setEstadoReservaFilter('TODOS');
    setFiltros({ estado: undefined });
    setDeslindeFilter('TODOS');
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-3 sm:space-y-4">
      <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3 sm:gap-4">
        {/* Pestañas */}
        <div className="flex space-x-2 border-b lg:border-b-0 border-slate-100 dark:border-slate-800 pb-2 lg:pb-0 overflow-x-auto">
          <button
            onClick={() => setFiltros({ tab: 'PROXIMAS' })}
            className={`px-3 sm:px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
              filtros.tab === 'PROXIMAS'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Próximas Reservas
          </button>
          <button
            onClick={() => setFiltros({ tab: 'PASADAS' })}
            className={`px-3 sm:px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
              filtros.tab === 'PASADAS'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Pasadas / Historial
          </button>
          <button
            onClick={() => setFiltros({ tab: 'TODAS' })}
            className={`px-3 sm:px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
              filtros.tab === 'TODAS'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Todas ({total})
          </button>
        </div>

        {/* Buscador en tiempo real */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            id="reservas-busqueda-input"
            name="searchQuery"
            aria-label="Buscar por titular, RUT, pasajero o código"
            placeholder="Buscar por titular, RUT, pasajero o código..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-9 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white transition"
          />
          {searchQuery && (
            <button 
              onClick={onClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Barra de Filtros Colapsables */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-slate-600 dark:text-slate-400">
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setShowFilters(prev => !prev)}
              aria-expanded={showFilters}
              className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                showFilters || activeFiltersCount > 0
                  ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 font-semibold'
                  : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Filter size={13} className={activeFiltersCount > 0 ? "text-blue-600 dark:text-blue-400" : "text-slate-400"} />
              <span>Filtros</span>
              {activeFiltersCount > 0 && (
                <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full min-w-[16px] text-center leading-4">
                  {activeFiltersCount}
                </span>
              )}
              <ChevronDown size={14} className={`transition-transform duration-200 text-slate-400 ${showFilters ? 'rotate-180 text-blue-500' : ''}`} />
            </button>

            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center space-x-1 text-xs text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 transition-colors cursor-pointer px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30"
                title="Limpiar filtros activos"
              >
                <RotateCcw size={12} />
                <span>Limpiar</span>
              </button>
            )}
          </div>

          <span className="text-xs text-slate-400 sm:ml-auto">
            Mostrando <strong>{reservasFiltradasCount}</strong> de {total} reservas
          </span>
        </div>

        {/* Panel Desplegable de Filtros */}
        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-3 mt-2 border-t border-dashed border-slate-200 dark:border-slate-800/80 animate-in fade-in slide-in-from-top-1 duration-200">
            {/* Estado de la Reserva (Ciclo de Vida) */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Estado de Reserva
              </label>
              <select
                value={estadoReservaFilter}
                onChange={e => setEstadoReservaFilter(e.target.value as EstadoReservaFilter)}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500 font-medium text-xs"
              >
                <option value="TODOS">Todos los estados</option>
                <option value="SIN_AGENDAR">Sin Agendar</option>
                <option value="AGENDADA">Agendada</option>
                <option value="COMPLETADA">Completada</option>
                <option value="CANCELADA">Cancelada</option>
              </select>
            </div>

            {/* Pago */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Estado de Pago
              </label>
              <select
                value={filtros.estado ?? 'TODOS'}
                onChange={e => setFiltros({ estado: e.target.value === 'TODOS' ? undefined : e.target.value })}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500 text-xs"
              >
                <option value="TODOS">Todos los pagos</option>
                <option value="PENDIENTE">Pago Pendiente</option>
                <option value="ABONADO">Abonado</option>
                <option value="PAGADO">Pagado Total</option>
                <option value="DEVUELTO">Devuelto</option>
              </select>
            </div>

            {/* Deslinde */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Firmas y Deslindes
              </label>
              <select
                value={deslindeFilter}
                onChange={e => setDeslindeFilter(e.target.value as DeslindeFilter)}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500 text-xs"
              >
                <option value="TODOS">Todos los deslindes</option>
                <option value="PENDIENTES">Faltan Firmas</option>
                <option value="COMPLETOS">Todos Firmados</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
