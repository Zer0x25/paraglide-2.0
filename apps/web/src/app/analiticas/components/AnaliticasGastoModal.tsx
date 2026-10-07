import React from 'react';
import { Receipt, X } from 'lucide-react';
import type { GastoFormData } from '../hooks/useAnaliticasController';

export interface AnaliticasGastoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  formData: GastoFormData;
  setFormData: React.Dispatch<React.SetStateAction<GastoFormData>>;
  categorias: readonly string[];
}

export const AnaliticasGastoModal: React.FC<AnaliticasGastoModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  formData,
  setFormData,
  categorias,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-gasto-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 dark:border-slate-800">
        <div className="flex justify-between items-center p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800">
          <h2
            id="modal-gasto-title"
            className="text-xl font-bold text-slate-900 dark:text-white flex items-center"
          >
            <Receipt className="mr-2 text-red-500" size={24} /> Registrar Gasto
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal"
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-5 sm:p-6 space-y-4">
          <div>
            <label htmlFor="gasto-fecha" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Fecha
            </label>
            <input
              id="gasto-fecha"
              type="date"
              required
              value={formData.fecha}
              onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none transition"
            />
          </div>

          <div>
            <label htmlFor="gasto-categoria" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Categoría
            </label>
            <select
              id="gasto-categoria"
              required
              value={formData.categoria}
              onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none transition"
            >
              {categorias.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="gasto-monto" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Monto ($ CLP)
            </label>
            <input
              id="gasto-monto"
              type="number"
              required
              min="0"
              placeholder="Ej: 25000"
              value={formData.monto}
              onChange={(e) => setFormData({ ...formData, monto: e.target.value })}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none transition"
            />
          </div>

          <div>
            <label htmlFor="gasto-descripcion" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Descripción (Opcional)
            </label>
            <textarea
              id="gasto-descripcion"
              rows={2}
              placeholder="Ej: Carga de bencina para camioneta de traslado..."
              value={formData.descripcion}
              onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none transition resize-none"
            />
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition font-medium text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-md transition font-semibold text-sm"
            >
              Guardar Gasto
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
