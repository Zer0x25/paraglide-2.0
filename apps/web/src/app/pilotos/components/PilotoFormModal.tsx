"use client";

import { X } from 'lucide-react';

interface PilotoFormData {
  nombre: string;
  rutDni: string;
  email: string;
  telefono: string;
  activo: boolean;
  peso: string;
  tieneLicencia: boolean;
  numeroLicencia: string;
  fechaVencimientoLicencia: string;
  prioridad: string;
  categoria: string;
  pesoMaximoPasajero: string;
  tarifaPorVuelo: string;
}

interface PilotoFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingId: number | null;
  formData: PilotoFormData;
  setFormData: React.Dispatch<React.SetStateAction<PilotoFormData>>;
  onSubmit: (e: React.FormEvent) => Promise<void>;
}

export function PilotoFormModal({
  isOpen,
  onClose,
  editingId,
  formData,
  setFormData,
  onSubmit,
}: PilotoFormModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl w-full max-w-md p-5 sm:p-6 relative max-h-[90vh] overflow-y-auto my-auto">
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
        >
          <X size={24} />
        </button>
        <h2 className="text-xl font-bold mb-4 text-slate-800 dark:text-white">
          {editingId ? 'Editar Piloto' : 'Agregar Nuevo Piloto'}
        </h2>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre Completo</label>
              <input 
                type="text" 
                required 
                className="w-full text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 dark:bg-slate-800" 
                value={formData.nombre} 
                onChange={(e) => setFormData({...formData, nombre: e.target.value})} 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">RUT/DNI</label>
              <input 
                type="text" 
                className="w-full text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 dark:bg-slate-800" 
                value={formData.rutDni} 
                onChange={(e) => setFormData({...formData, rutDni: e.target.value})} 
                placeholder="Ej: 12.345.678-9" 
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
              <input 
                type="email" 
                className="w-full text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 dark:bg-slate-800" 
                value={formData.email} 
                onChange={(e) => setFormData({...formData, email: e.target.value})} 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Teléfono</label>
              <input 
                type="tel" 
                className="w-full text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 dark:bg-slate-800" 
                value={formData.telefono} 
                onChange={(e) => setFormData({...formData, telefono: e.target.value})} 
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Categoría</label>
              <select 
                className="w-full text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800"
                value={formData.categoria}
                onChange={(e) => {
                  const cat = e.target.value;
                  let prio = '3';
                  if (cat === 'MASTER') prio = '1';
                  else if (cat === 'SENIOR') prio = '2';
                  else if (cat === 'JUNIOR') prio = '3';
                  setFormData({...formData, categoria: cat, prioridad: prio});
                }}
              >
                <option value="MASTER">MASTER</option>
                <option value="SENIOR">SENIOR</option>
                <option value="JUNIOR">JUNIOR</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Prioridad Orden (1-10)</label>
              <input 
                type="number" 
                min="1" 
                max="10" 
                className="w-full text-center text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 dark:bg-slate-800" 
                value={formData.prioridad} 
                onChange={(e) => setFormData({...formData, prioridad: e.target.value})} 
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Peso Piloto (KG)</label>
              <input 
                type="number" 
                step="1" 
                min="0" 
                className="w-full text-center text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 dark:bg-slate-800" 
                value={formData.peso} 
                onChange={(e) => setFormData({...formData, peso: e.target.value})} 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Peso Máx. Pasajero</label>
              <input 
                type="number" 
                min="30" 
                max="200" 
                className="w-full text-center text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 dark:bg-slate-800" 
                value={formData.pesoMaximoPasajero} 
                onChange={(e) => setFormData({...formData, pesoMaximoPasajero: e.target.value})} 
              />
            </div>
          </div>

          <div className="pt-2 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Licencia</label>
              <div className="flex rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setFormData({...formData, tieneLicencia: true})}
                  className={`flex-1 py-2 text-sm font-semibold transition cursor-pointer ${
                    formData.tieneLicencia
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  Con Licencia
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({...formData, tieneLicencia: false, numeroLicencia: '', fechaVencimientoLicencia: ''})}
                  className={`flex-1 py-2 text-sm font-semibold transition cursor-pointer ${
                    !formData.tieneLicencia
                      ? 'bg-slate-600 text-white'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  Sin Licencia
                </button>
              </div>
            </div>

            {formData.tieneLicencia && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 rounded-lg p-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">N° de Licencia</label>
                  <input 
                    type="text" 
                    className="w-full text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 dark:bg-slate-800" 
                    value={formData.numeroLicencia} 
                    onChange={(e) => setFormData({...formData, numeroLicencia: e.target.value})} 
                    placeholder="Ej: LIC-ABC123" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Fecha de Vencimiento</label>
                  <input 
                    type="date" 
                    className="w-full text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 [color-scheme:light] dark:[color-scheme:dark]" 
                    value={formData.fechaVencimientoLicencia} 
                    onChange={(e) => setFormData({...formData, fechaVencimientoLicencia: e.target.value})} 
                  />
                </div>
              </div>
            )}

            <div className="flex items-center space-x-2">
              <input 
                type="checkbox" 
                id="activo" 
                checked={formData.activo} 
                onChange={(e) => setFormData({...formData, activo: e.target.checked})} 
                className="h-4 w-4 text-blue-600 rounded cursor-pointer" 
              />
              <label htmlFor="activo" className="text-sm font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap cursor-pointer">
                Piloto Activo (ticket piloto)
              </label>
            </div>

            {formData.activo && (
              <div className="flex items-center justify-between gap-4 pl-6 border-l-2 border-blue-200 dark:border-blue-900">
                <label htmlFor="tarifaPorVuelo" className="text-sm font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                  Pago por Vuelo ($)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  id="tarifaPorVuelo"
                  placeholder="0"
                  className="w-32 text-right text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 dark:bg-slate-800"
                  value={formData.tarifaPorVuelo ? Number(formData.tarifaPorVuelo).toLocaleString('es-CL') : ''}
                  onChange={(e) => setFormData({...formData, tarifaPorVuelo: e.target.value.replace(/\D/g, '')})}
                />
              </div>
            )}
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition font-medium cursor-pointer"
            >
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
