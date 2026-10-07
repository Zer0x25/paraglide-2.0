"use client";

import { useState } from 'react';
import { X, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { apiRaw as api } from '../services/api';
import { PasajeroDTO } from '@parapente/shared';
import { FirmaDeslindeForm, FirmaData } from './FirmaDeslindeForm';

interface FirmaDeslindeModalProps {
  pasajero: PasajeroDTO | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function FirmaDeslindeModal({ pasajero, isOpen, onClose, onSuccess }: FirmaDeslindeModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !pasajero) return null;

  const handleSubmit = async (data: FirmaData) => {
    setIsSubmitting(true);
    try {
      await api.post(`/pasajeros/${pasajero.id}/firma`, data);
      toast.success('Deslinde de responsabilidad y firma guardados con éxito');
      onSuccess();
      onClose();
    } catch (error: unknown) {
      console.error(error);
      toast.error((error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Error al guardar el deslinde');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col">
        
        {/* Cabecera */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/50">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-2xl">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Deslinde de Responsabilidad</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Pasajero: <strong className="text-slate-700 dark:text-slate-200">{pasajero.nombre}</strong></p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition">
            <X size={20} />
          </button>
        </div>

        {/* Formulario Reutilizable */}
        <div className="p-6 flex-1 overflow-y-auto">
          <FirmaDeslindeForm
            pasajero={pasajero}
            isSubmitting={isSubmitting}
            onSubmit={handleSubmit}
            onCancel={onClose}
          />
        </div>
      </div>
    </div>
  );
}
