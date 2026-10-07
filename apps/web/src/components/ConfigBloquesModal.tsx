"use client";

import { PlusCircle, X } from 'lucide-react';
import { type ConfiguracionBloque } from './config-bloques/types';
import { useConfigBloquesController } from './config-bloques/useConfigBloquesController';
import { ConfigBloqueCard } from './config-bloques/ConfigBloqueCard';
import { ConfigBloqueFormModal } from './config-bloques/ConfigBloqueFormModal';
import { ConfigBloquesArchivadas } from './config-bloques/ConfigBloquesArchivadas';

export type { ConfiguracionBloque };

export function ConfigBloquesModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const {
    loading,
    isModalOpen,
    setIsModalOpen,
    editingId,
    nombre,
    setNombre,
    tipoConfig,
    setTipoConfig,
    fechaInicio,
    setFechaInicio,
    fechaFin,
    setFechaFin,
    fechaExacta,
    setFechaExacta,
    bloqueado,
    setBloqueado,
    horariosForm,
    setHorariosForm,
    mostrarArchivadas,
    setMostrarArchivadas,
    numeros,
    activas,
    archivadas,
    formatearFechaCalendario,
    handleOpenModalParaCrear,
    handleOpenModalParaEditar,
    handleSubmit,
    eliminarConfiguracion,
  } = useConfigBloquesController(isOpen);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl w-full max-w-4xl p-5 sm:p-6 relative my-auto max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
        >
          <X size={24} />
        </button>
        <h2 className="text-xl font-bold mb-4 text-slate-800 dark:text-white">Configuración de Horarios</h2>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
          <button
            onClick={handleOpenModalParaCrear}
            className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-medium shadow-sm"
          >
            <PlusCircle size={20} />
            <span>Nueva Regla</span>
          </button>
        </div>

        {isModalOpen && (
          <ConfigBloqueFormModal
            editingId={editingId}
            nombre={nombre}
            setNombre={setNombre}
            tipoConfig={tipoConfig}
            setTipoConfig={setTipoConfig}
            fechaInicio={fechaInicio}
            setFechaInicio={setFechaInicio}
            fechaFin={fechaFin}
            setFechaFin={setFechaFin}
            fechaExacta={fechaExacta}
            setFechaExacta={setFechaExacta}
            bloqueado={bloqueado}
            setBloqueado={setBloqueado}
            horariosForm={horariosForm}
            setHorariosForm={setHorariosForm}
            onClose={() => setIsModalOpen(false)}
            onSubmit={handleSubmit}
          />
        )}

        {/* Listado de Reglas Activas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <p className="text-slate-500">Cargando...</p>
          ) : activas.length === 0 ? (
            <p className="text-slate-500 col-span-full">No hay configuraciones creadas.</p>
          ) : (
            activas.map((config) => (
              <ConfigBloqueCard
                key={config.id}
                config={config}
                numeroItem={numeros.get(config.id)}
                onEdit={handleOpenModalParaEditar}
                onDelete={eliminarConfiguracion}
                formatearFecha={formatearFechaCalendario}
              />
            ))
          )}
        </div>

        {/* Archivadas / Expiradas */}
        <ConfigBloquesArchivadas
          archivadas={archivadas}
          mostrarArchivadas={mostrarArchivadas}
          onToggleMostrar={() => setMostrarArchivadas((prev) => !prev)}
          numeros={numeros}
        />
      </div>
    </div>
  );
}
