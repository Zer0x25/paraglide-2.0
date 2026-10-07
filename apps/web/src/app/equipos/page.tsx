"use client";

import {
  Wrench, PlusCircle, Search, AlertTriangle,
  Clock, Calendar, User, Trash2, Edit2
} from 'lucide-react';
import { EquipoModal } from '../../components/EquipoModal';
import { MantenimientoModal } from '../../components/MantenimientoModal';
import { type CreateEquipoPayload } from '@parapente/shared';
import { withModule } from '@/components/withModule';
import { useEquiposController } from './hooks/useEquiposController';
import { EquiposStatsCards } from './components/EquiposStatsCards';

function EquiposPage() {
  const c = useEquiposController();

  return (
    <div className="space-y-6 relative pb-16 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/40 dark:bg-slate-900/40 p-5 sm:p-6 rounded-3xl border border-white/60 dark:border-slate-800 backdrop-blur-xl shadow-sm">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <Wrench className="text-amber-500 shrink-0" size={28} />
            <span>Control de Equipos & Mantenimiento</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1">
            Gestión técnica de velas, paracaídas de emergencia, arneses y bitácora de inspecciones
          </p>
        </div>

        <button
          onClick={c.handleOpenCreate}
          className="w-full sm:w-auto flex items-center justify-center space-x-2 py-3 px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-black shadow-lg shadow-blue-600/20 transition cursor-pointer"
        >
          <PlusCircle size={16} />
          <span>Registrar Equipo</span>
        </button>
      </div>

      {/* Tarjetas de Resumen Rápido */}
      <EquiposStatsCards stats={c.stats} />

      {/* Barra de Filtros y Búsqueda */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col md:flex-row gap-3 items-center justify-between">
        {/* Buscador */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Buscar por código, modelo, serie, piloto..."
            value={c.searchQuery}
            onChange={(e) => c.setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition"
          />
        </div>

        {/* Selectores de Filtro */}
        <div className="flex flex-wrap w-full md:w-auto gap-2">
          <select
            value={c.tipoFilter}
            onChange={(e) => c.setTipoFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs px-3 py-2 text-slate-700 dark:text-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          >
            <option value="TODOS">Todos los Tipos</option>
            <option value="VELA">Velas</option>
            <option value="PARACAIDAS_EMERGENCIA">Paracaídas Emergencia</option>
            <option value="ARNES_PILOTO">Arnés Piloto</option>
            <option value="ARNES_PASAJERO">Arnés Pasajero</option>
            <option value="CASCO">Cascos</option>
            <option value="VARIOMETRO_GPS">Variómetros / GPS</option>
            <option value="RADIO">Radios VHF</option>
            <option value="OTRO">Otros Accesorios</option>
          </select>

          <select
            value={c.estadoFilter}
            onChange={(e) => c.setEstadoFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs px-3 py-2 text-slate-700 dark:text-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          >
            <option value="TODOS">Todos los Estados</option>
            <option value="OPERATIVO">Operativo</option>
            <option value="REVISION_PENDIENTE">Revisión Pendiente</option>
            <option value="EN_MANTENIMIENTO">En Taller</option>
            <option value="DE_BAJA">De Baja</option>
          </select>
        </div>
      </div>

      {/* Listado de Tarjetas */}
      {c.loading ? (
        <div className="p-12 text-center text-slate-400">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p>Cargando inventario de equipos...</p>
        </div>
      ) : c.equiposFiltrados.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 p-12 rounded-3xl border border-slate-100 dark:border-slate-800 text-center space-y-2">
          <Wrench size={36} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
          <p className="font-bold text-slate-700 dark:text-slate-300">No se encontraron equipos</p>
          <p className="text-slate-400 text-xs">Prueba cambiando los filtros o el término de búsqueda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {c.equiposFiltrados.map((equipo) => {
            const horas = equipo.horasVueloEstimadas || 0;
            const limite = equipo.limiteHorasInspeccion || 100;
            const pct = Math.min(100, Math.round((horas / limite) * 100));

            return (
              <div
                key={equipo.id}
                className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 p-5 flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition"
              >
                <div>
                  {/* Encabezado Tarjeta */}
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-xs font-black tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/80 px-2.5 py-1 rounded-xl">
                      {equipo.codigo}
                    </span>
                    <span
                      className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-xl ${
                        equipo.estado === 'OPERATIVO'
                          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/80 dark:text-emerald-400'
                          : equipo.estado === 'REVISION_PENDIENTE'
                          ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/80 dark:text-amber-400'
                          : equipo.estado === 'EN_MANTENIMIENTO'
                          ? 'bg-purple-50 text-purple-600 dark:bg-purple-950/80 dark:text-purple-400'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {equipo.estado.replace('_', ' ')}
                    </span>
                  </div>

                  {/* Título & Detalle */}
                  <h3 className="font-extrabold text-base text-slate-800 dark:text-slate-100 mb-1 leading-snug">
                    {equipo.nombre}
                  </h3>
                  <p className="text-slate-400 text-xs mb-4">
                    {equipo.marca} {equipo.modelo} {equipo.numeroSerie ? `• S/N: ${equipo.numeroSerie}` : ''}
                  </p>

                  {/* Barra de Progreso de Horas */}
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl mb-4 border border-slate-100 dark:border-slate-800/80">
                    <div className="flex justify-between text-xs font-bold mb-1.5">
                      <span className="text-slate-500 flex items-center gap-1">
                        <Clock size={12} /> Horas de Vuelo
                      </span>
                      <span className={pct >= 90 ? 'text-red-500 font-extrabold' : 'text-slate-700 dark:text-slate-300'}>
                        {horas.toFixed(1)} / {limite} hrs ({pct}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          pct >= 90 ? 'bg-red-500' : pct >= 75 ? 'bg-amber-500' : 'bg-blue-600'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {pct >= 90 && (
                      <p className="text-[10px] text-red-500 font-bold mt-1 flex items-center gap-1">
                        <AlertTriangle size={10} /> Límite de horas alcanzado o próximo. Inspección requerida.
                      </p>
                    )}
                  </div>

                  {/* Fechas de Revisión & Piloto */}
                  <div className="text-xs space-y-1.5 text-slate-600 dark:text-slate-400">
                    {equipo.fechaProximaRevision && (
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1 text-slate-400">
                          <Calendar size={13} /> Próxima Revisión:
                        </span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {new Date(equipo.fechaProximaRevision).toLocaleDateString('es-CL')}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 text-slate-400">
                        <User size={13} /> Piloto Asignado:
                      </span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {equipo.pilotoAsignado?.nombre || 'Sin asignar'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Acciones de la Tarjeta */}
                <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <button
                    onClick={() => c.handleOpenMantenimiento(equipo)}
                    className="flex-1 flex items-center justify-center space-x-1.5 py-2 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    <Wrench size={14} className="text-amber-500" />
                    <span>Bitácora ({equipo.mantenimientos?.length || 0})</span>
                  </button>

                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => c.handleOpenEdit(equipo)}
                      className="p-2 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-xl transition cursor-pointer"
                      title="Editar equipo"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => c.deleteEquipo(equipo.id)}
                      className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-xl transition cursor-pointer"
                      title="Eliminar equipo"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Equipo */}
      <EquipoModal
        isOpen={c.isEquipoModalOpen}
        onClose={c.handleCloseEquipoModal}
        onSuccess={async (data) => {
          if (c.editingEquipo) {
            await c.updateEquipo(c.editingEquipo.id, {
              ...data,
              version: c.editingEquipo.version ?? 0,
            } as unknown as CreateEquipoPayload);
          } else {
            await c.createEquipo(data);
          }
        }}
        equipo={c.editingEquipo}
      />

      {/* Modal de Bitácora de Mantenimiento */}
      <MantenimientoModal
        equipo={c.selectedEquipoMantenimiento}
        isOpen={c.isMantenimientoModalOpen}
        onClose={c.handleCloseMantenimientoModal}
        onAddMantenimiento={async (equipoId, data) => {
          await c.addMantenimiento(equipoId, data);
        }}
        onDeleteMantenimiento={async (equipoId, mantenimientoId) => {
          await c.deleteMantenimiento(equipoId, mantenimientoId);
        }}
      />
    </div>
  );
}

export default withModule('equipos', EquiposPage);
