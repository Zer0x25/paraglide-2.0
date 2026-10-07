"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Wrench, Trash2, PlusCircle } from 'lucide-react';
import { 
  CreateMantenimientoPayloadSchema, 
  CreateMantenimientoPayload, 
  EquipoDTO,
  dateKeyLocal
} from '@parapente/shared';
import { formatCLP } from '../utils/format';
import { Button, Modal } from './ui';

interface MantenimientoModalProps {
  equipo: EquipoDTO | null;
  isOpen: boolean;
  onClose: () => void;
  onAddMantenimiento: (equipoId: number, data: CreateMantenimientoPayload) => Promise<void>;
  onDeleteMantenimiento: (equipoId: number, mantenimientoId: number) => Promise<void>;
}

export function MantenimientoModal({ 
  equipo, 
  isOpen, 
  onClose, 
  onAddMantenimiento, 
  onDeleteMantenimiento 
}: MantenimientoModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateMantenimientoPayload>({
    resolver: zodResolver(CreateMantenimientoPayloadSchema) as unknown as import('react-hook-form').Resolver<CreateMantenimientoPayload>,
    defaultValues: {
      fecha: dateKeyLocal(),
      tipo: 'INSPECCION_ANUAL',
      descripcion: '',
      taller: '',
      costo: 0,
      proximaRevision: '',
    },
  });

  const onSubmit = async (data: CreateMantenimientoPayload) => {
    if (!equipo) return;
    setIsSubmitting(true);
    try {
      await onAddMantenimiento(equipo.id, data);
      reset({
        fecha: dateKeyLocal(),
        tipo: 'INSPECCION_ANUAL',
        descripcion: '',
        taller: '',
        costo: 0,
        proximaRevision: '',
      });
      setShowForm(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !equipo) return null;

  const mantenimientos = equipo.mantenimientos || [];

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Bitácora de Mantenimiento"
      size="2xl"
    >
      <div className="space-y-6">
          
          {/* Botón para desplegar formulario de registro */}
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Historial de Servicios ({mantenimientos.length})
            </h3>

            <Button
              type="button"
              onClick={() => setShowForm(!showForm)}
              size="sm"
              className="rounded-xl shadow-sm"
            >
              <PlusCircle size={14} />
              <span>{showForm ? 'Cerrar Formulario' : 'Nuevo Servicio / Mantenimiento'}</span>
            </Button>
          </div>

          {/* Formulario Nuevo Mantenimiento */}
          {showForm && (
            <form onSubmit={handleSubmit(onSubmit)} className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3 animate-in fade-in duration-200">
              <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase">Registrar Nuevo Servicio</h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Fecha</label>
                  <input
                    type="date"
                    {...register('fecha')}
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Tipo de Servicio</label>
                  <select
                    {...register('tipo')}
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="REPLEGADO_PARACAIDAS">Replegado de Paracaídas</option>
                    <option value="TEST_POROSIDAD">Prueba de Porosidad / Bettsometer</option>
                    <option value="REVISION_LINEAS">Calibración / Trimado de Líneas</option>
                    <option value="REPARACION">Reparación / Parche de Vela</option>
                    <option value="INSPECCION_ANUAL">Inspección Anual General</option>
                    <option value="OTRO">Otro Servicio</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Descripción del Trabajo *</label>
                <input
                  type="text"
                  placeholder="Ej: Replegado semestral de paracaídas y cambio de bandas elásticas"
                  {...register('descripcion')}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.descripcion && <span className="text-[10px] text-red-500 font-bold">{errors.descripcion.message}</span>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Taller / Técnico</label>
                  <input
                    type="text"
                    placeholder="Ej: Taller Vuelo Libre"
                    {...register('taller')}
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Costo ($ CLP)</label>
                  <input
                    type="number"
                    {...register('costo', { valueAsNumber: true })}
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Próxima Revisión</label>
                  <input
                    type="date"
                    {...register('proximaRevision')}
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  type="submit"
                  loading={isSubmitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold shadow-md"
                >
                  {isSubmitting ? 'Guardando...' : 'Guardar Mantenimiento'}
                </Button>
              </div>
            </form>
          )}

          {/* Lista de Registros Anteriores */}
          {mantenimientos.length === 0 ? (
            <div className="p-8 text-center text-slate-400 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-800">
              <Wrench size={32} className="mx-auto text-slate-300 dark:text-slate-700 mb-1" />
              <p className="text-xs font-bold text-slate-600 dark:text-slate-400">Sin registros de mantenimiento aún</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {mantenimientos.map((m) => (
                <div
                  key={m.id}
                  className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex justify-between items-start gap-3 shadow-xs"
                >
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded-md">
                        {m.tipo.replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs text-slate-400 font-bold">
                        {new Date(m.fecha).toLocaleDateString('es-CL', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </span>
                    </div>

                    <p className="text-xs font-semibold text-slate-900 dark:text-white mt-1.5">
                      {m.descripcion}
                    </p>

                    <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-3">
                      {m.taller && <span>Taller: <strong>{m.taller}</strong></span>}
                      {m.costo > 0 && <span>Costo: <strong className="text-emerald-600 dark:text-emerald-400">{formatCLP(m.costo)}</strong></span>}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onDeleteMantenimiento(equipo.id, m.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/50 transition"
                    title="Eliminar registro"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

        </div>
    </Modal>
  );
}
