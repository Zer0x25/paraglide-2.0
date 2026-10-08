'use client';

import { X } from 'lucide-react';
import { Horario } from './types';

interface ConfigBloqueFormModalProps {
  editingId: number | null;
  nombre: string;
  setNombre: (n: string) => void;
  tipoConfig: 'RANGO' | 'INDEFINIDO' | 'EXACTA';
  setTipoConfig: (t: 'RANGO' | 'INDEFINIDO' | 'EXACTA') => void;
  fechaInicio: string;
  setFechaInicio: (f: string) => void;
  fechaFin: string;
  setFechaFin: (f: string) => void;
  fechaExacta: string;
  setFechaExacta: (f: string) => void;
  bloqueado: boolean;
  setBloqueado: (b: boolean) => void;
  horariosForm: Horario[];
  setHorariosForm: (h: Horario[]) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function ConfigBloqueFormModal({
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
  onClose,
  onSubmit,
}: ConfigBloqueFormModalProps) {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl w-full max-w-2xl p-5 sm:p-6 relative my-auto max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          aria-label="Cerrar modal"
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
        >
          <X size={24} />
        </button>
        <h2 className="text-xl font-bold mb-4 text-slate-800 dark:text-white">
          {editingId ? 'Editar Regla de Horario' : 'Crear Regla de Horario'}
        </h2>

        <form onSubmit={onSubmit} className="space-y-6">
          <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-md border border-slate-200 dark:border-slate-700">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Nombre de la Regla
            </label>
            <input
              type="text"
              required
              placeholder="Ej: Temporada Alta, Horario Base, Evento Especial..."
              className="w-full text-slate-900 border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>

          <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-md border border-slate-200 dark:border-slate-700">
            <h3 className="font-semibold text-slate-800 dark:text-white mb-3 text-sm">
              Duración de la Regla
            </h3>
            <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 mb-4">
              <label className="flex items-center space-x-2 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="radio"
                  checked={tipoConfig === 'INDEFINIDO'}
                  onChange={() => setTipoConfig('INDEFINIDO')}
                />
                <span>Indefinido</span>
              </label>
              <label className="flex items-center space-x-2 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="radio"
                  checked={tipoConfig === 'RANGO'}
                  onChange={() => setTipoConfig('RANGO')}
                />
                <span>Rango de Fechas</span>
              </label>
              <label className="flex items-center space-x-2 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="radio"
                  checked={tipoConfig === 'EXACTA'}
                  onChange={() => setTipoConfig('EXACTA')}
                />
                <span>Día Específico (Override)</span>
              </label>
            </div>

            {tipoConfig === 'RANGO' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Desde</label>
                  <input
                    type="date"
                    required
                    className="w-full border rounded px-3 py-1 text-sm text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 dark:border-slate-700"
                    value={fechaInicio}
                    onChange={(e) => setFechaInicio(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Hasta (Opcional)
                  </label>
                  <input
                    type="date"
                    className="w-full border rounded px-3 py-1 text-sm text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 dark:border-slate-700"
                    value={fechaFin}
                    onChange={(e) => setFechaFin(e.target.value)}
                  />
                </div>
              </div>
            )}

            {tipoConfig === 'EXACTA' && (
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Fecha Exacta
                </label>
                <input
                  type="date"
                  required
                  className="w-full border rounded px-3 py-1 text-sm text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 dark:border-slate-700"
                  value={fechaExacta}
                  onChange={(e) => setFechaExacta(e.target.value)}
                />
                <p className="text-xs text-orange-600 mt-1">
                  ⚠️ Esta regla sobrescribirá cualquier rango que aplique a este mismo día.
                </p>
              </div>
            )}
          </div>

          <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-md border border-slate-200 dark:border-slate-700">
            <label className="flex items-center space-x-2 cursor-pointer mb-4">
              <input
                type="checkbox"
                className="w-4 h-4 text-red-600 rounded border-slate-300"
                checked={bloqueado}
                onChange={(e) => setBloqueado(e.target.checked)}
              />
              <span className="text-sm font-medium text-red-600">
                Día(s) Completamente Bloqueados (Sin vuelos)
              </span>
            </label>

            {!bloqueado && (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold text-slate-800 dark:text-white text-sm">
                    Bloques de Vuelo Disponibles
                  </h3>
                  <button
                    type="button"
                    onClick={() =>
                      setHorariosForm([...horariosForm, { horaInicio: '', horaFin: '' }])
                    }
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    + Añadir Bloque
                  </button>
                </div>

                <div className="space-y-2">
                  {horariosForm.map((h, i) => (
                    <div key={i} className="flex items-center space-x-2">
                      <input
                        type="time"
                        required
                        className="border rounded px-2 py-1 text-sm text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 dark:border-slate-700"
                        value={h.horaInicio}
                        onChange={(e) => {
                          const newH = [...horariosForm];
                          newH[i].horaInicio = e.target.value;
                          setHorariosForm(newH);
                        }}
                      />
                      <span className="text-slate-500">hasta</span>
                      <input
                        type="time"
                        required
                        className="border rounded px-2 py-1 text-sm text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 dark:border-slate-700"
                        value={h.horaFin}
                        onChange={(e) => {
                          const newH = [...horariosForm];
                          newH[i].horaFin = e.target.value;
                          setHorariosForm(newH);
                        }}
                      />
                      {horariosForm.length > 1 && (
                        <button
                          type="button"
                          aria-label="Eliminar bloque de horario"
                          onClick={() => {
                            const newH = [...horariosForm];
                            newH.splice(i, 1);
                            setHorariosForm(newH);
                          }}
                          className="text-red-400 hover:text-red-600"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-3 border-t pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Guardar Regla
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
