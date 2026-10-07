"use client";

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2 } from 'lucide-react';
import { 
  CreateEquipoPayloadSchema, 
  CreateEquipoPayload, 
  EquipoDTO, 
  PilotoDTO,
  dateKeyLocal
} from '@parapente/shared';
import { Modal, Button } from './ui';
import api from '../services/api';

interface EquipoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (data: CreateEquipoPayload) => Promise<void>;
  equipo?: EquipoDTO | null;
}

export function EquipoModal({ isOpen, onClose, onSuccess, equipo }: EquipoModalProps) {
  const [pilotos, setPilotos] = useState<PilotoDTO[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateEquipoPayload>({
    resolver: zodResolver(CreateEquipoPayloadSchema) as unknown as import('react-hook-form').Resolver<CreateEquipoPayload>,
    defaultValues: {
      codigo: '',
      nombre: '',
      tipo: 'VELA',
      marca: '',
      modelo: '',
      numeroSerie: '',
      anoFabricacion: new Date().getFullYear(),
      estado: 'OPERATIVO',
      horasVueloEstimadas: 0,
      vuelosRealizados: 0,
      limiteHorasInspeccion: 100,
      notas: '',
      pilotoAsignadoId: null,
    },
  });

  useEffect(() => {
    const fetchPilotos = async () => {
      try {
        const res = await api.pilotos.listar({ activo: 'true', pageSize: 500 });
        const list = res.data;
        setPilotos(list.filter((p: PilotoDTO) => p.activo));
      } catch (err) {
        console.error(err);
      }
    };
    fetchPilotos();
  }, []);

  useEffect(() => {
    if (equipo) {
      reset({
        codigo: equipo.codigo,
        nombre: equipo.nombre,
        tipo: equipo.tipo as unknown as CreateEquipoPayload['tipo'],
        marca: equipo.marca || '',
        modelo: equipo.modelo || '',
        numeroSerie: equipo.numeroSerie || '',
        anoFabricacion: equipo.anoFabricacion || new Date().getFullYear(),
        fechaAdquisicion: equipo.fechaAdquisicion ? dateKeyLocal(equipo.fechaAdquisicion) : '',
        estado: equipo.estado as unknown as CreateEquipoPayload['estado'],
        horasVueloEstimadas: equipo.horasVueloEstimadas || 0,
        vuelosRealizados: equipo.vuelosRealizados || 0,
        limiteHorasInspeccion: equipo.limiteHorasInspeccion || 100,
        fechaUltimaRevision: equipo.fechaUltimaRevision ? dateKeyLocal(equipo.fechaUltimaRevision) : '',
        fechaProximaRevision: equipo.fechaProximaRevision ? dateKeyLocal(equipo.fechaProximaRevision) : '',
        notas: equipo.notas || '',
        pilotoAsignadoId: equipo.pilotoAsignadoId || null,
      });
    } else {
      reset({
        codigo: '',
        nombre: '',
        tipo: 'VELA',
        marca: '',
        modelo: '',
        numeroSerie: '',
        anoFabricacion: new Date().getFullYear(),
        estado: 'OPERATIVO',
        horasVueloEstimadas: 0,
        vuelosRealizados: 0,
        limiteHorasInspeccion: 100,
        notas: '',
        pilotoAsignadoId: null,
      });
    }
  }, [equipo, reset]);

  const onSubmit = async (data: CreateEquipoPayload) => {
    setIsSubmitting(true);
    try {
      await onSuccess(data);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={equipo ? 'Editar Equipo de Vuelo' : 'Registrar Nuevo Equipo'}
      size="2xl"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Código Único *
              </label>
              <input
                type="text"
                placeholder="Ej: VELA-01, RES-02"
                {...register('codigo')}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-500 uppercase"
              />
              {errors.codigo && <span className="text-[10px] text-red-500 font-bold">{errors.codigo.message}</span>}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Tipo de Equipo *
              </label>
              <select
                {...register('tipo')}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="VELA">Vela / Ala Biplaza</option>
                <option value="PARACAIDAS_EMERGENCIA">Paracaídas de Emergencia</option>
                <option value="ARNES_PILOTO">Arnés / Silla Piloto</option>
                <option value="ARNES_PASAJERO">Arnés / Silla Pasajero</option>
                <option value="CASCO">Casco</option>
                <option value="MOSQUETONES">Mosquetones / Separadores</option>
                <option value="OTRO">Otro Accesorio</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Nombre / Modelo Completo *
            </label>
            <input
              type="text"
              placeholder="Ej: Ozone Magnum 3 41m² (Tandem)"
              {...register('nombre')}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.nombre && <span className="text-[10px] text-red-500 font-bold">{errors.nombre.message}</span>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Marca</label>
              <input
                type="text"
                placeholder="Ej: Ozone, Gin, Niviuk"
                {...register('marca')}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">N° de Serie</label>
              <input
                type="text"
                placeholder="Ej: MG3-41-10293"
                {...register('numeroSerie')}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Estado</label>
              <select
                {...register('estado')}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="OPERATIVO">✓ Operativo / En Vuelo</option>
                <option value="REVISION_PENDIENTE">⚠️ Revisión Pendiente</option>
                <option value="EN_MANTENIMIENTO">🔧 En Taller / Mantenimiento</option>
                <option value="DE_BAJA">🛑 De Baja / Retirado</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Horas de Vuelo</label>
              {/* step="any": el simulador genera decimales largos (ej. 157.5084...) y step="0.5" bloqueaba el submit en silencio */}
              <input
                type="number"
                step="any"
                {...register('horasVueloEstimadas', { valueAsNumber: true })}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Vuelos Realizados</label>
              <input
                type="number"
                {...register('vuelosRealizados', { valueAsNumber: true })}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Límite Revisión (Hrs)</label>
              <input
                type="number"
                {...register('limiteHorasInspeccion', { valueAsNumber: true })}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Próxima Revisión / Replegado</label>
              <input
                type="date"
                {...register('fechaProximaRevision')}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Piloto Asignado</label>
              <select
                {...register('pilotoAsignadoId', { 
                  setValueAs: (v) => v ? Number(v) : null 
                })}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-bold"
              >
                <option value="">-- Sin piloto fijo (Uso general) --</option>
                {pilotos.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Notas / Observaciones</label>
            <textarea
              rows={2}
              placeholder="Detalles sobre estado de las líneas, porosidad, parches, etc."
              {...register('notas')}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
            ></textarea>
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl text-xs font-bold transition"
            >
              Cancelar
            </button>
            <Button
              type="submit"
              loading={isSubmitting}
              className="px-6 py-2.5 rounded-2xl text-xs font-black shadow-lg shadow-blue-600/20"
            >
              <CheckCircle2 size={16} />
              <span>{isSubmitting ? 'Guardando...' : equipo ? 'Guardar Cambios' : 'Registrar Equipo'}</span>
            </Button>
          </div>
        </form>
    </Modal>
  );
}
