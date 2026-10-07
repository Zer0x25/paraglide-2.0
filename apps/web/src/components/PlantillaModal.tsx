"use client";

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Send } from 'lucide-react';
import { 
  CreatePlantillaMensajePayloadSchema, 
  CreatePlantillaMensajePayload, 
  PlantillaMensajeDTO 
} from '@parapente/shared';
import { Modal } from './ui';

interface PlantillaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (data: CreatePlantillaMensajePayload) => Promise<void>;
  plantilla?: PlantillaMensajeDTO | null;
}

export function PlantillaModal({ isOpen, onClose, onSuccess, plantilla }: PlantillaModalProps) {
  const {
    register,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreatePlantillaMensajePayload>({
    resolver: zodResolver(CreatePlantillaMensajePayloadSchema) as unknown as import('react-hook-form').Resolver<CreatePlantillaMensajePayload>,
    defaultValues: {
      tipo: '',
      titulo: '',
      canal: 'WHATSAPP',
      cuerpo: '',
      variables: 'nombre, fecha, hora, link_voucher, link_deslinde, saldo, link_pantalla',
      activo: true,
    },
  });

  useEffect(() => {
    if (plantilla) {
      reset({
        tipo: plantilla.tipo,
        titulo: plantilla.titulo,
        canal: plantilla.canal as unknown as CreatePlantillaMensajePayload['canal'],
        cuerpo: plantilla.cuerpo,
        variables: plantilla.variables || '',
        activo: plantilla.activo,
      });
    } else {
      reset({
        tipo: '',
        titulo: '',
        canal: 'WHATSAPP',
        cuerpo: '',
        variables: 'nombre, fecha, hora, link_voucher, link_deslinde, saldo, link_pantalla',
        activo: true,
      });
    }
  }, [plantilla, reset]);

  const insertVariable = (varName: string) => {
    // eslint-disable-next-line react-hooks/incompatible-library -- watch() no memoizable
    const current = watch('cuerpo') || '';
    setValue('cuerpo', `${current} {{${varName}}}`);
  };

  const onSubmit = async (data: CreatePlantillaMensajePayload) => {
    try {
      await onSuccess(data);
      onClose();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={plantilla ? 'Editar Plantilla de Mensaje' : 'Nueva Plantilla'}
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400 -mt-1">
            Personaliza mensajes automatizados para WhatsApp / Correo
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Identificador / Tipo *
              </label>
              <input
                type="text"
                placeholder="EJ: CONFIRMACION_VIP"
                {...register('tipo')}
                disabled={!!plantilla}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono uppercase font-bold outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
              />
              {errors.tipo && <p className="text-[10px] text-red-500 mt-1">{errors.tipo.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Canal *
              </label>
              <select
                {...register('canal')}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="WHATSAPP">WhatsApp</option>
                <option value="EMAIL">Correo Electrónico</option>
                <option value="SMS">Mensaje SMS</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Título Descriptivo *
            </label>
            <input
              type="text"
              placeholder="Ej: Confirmación de Vuelo Tandem"
              {...register('titulo')}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {errors.titulo && <p className="text-[10px] text-red-500 mt-1">{errors.titulo.message}</p>}
          </div>

          {/* Variables Disponibles para 1-Click */}
          <div className="space-y-1.5">
            <span className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">
              Insertar Variable Dinámica:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {['nombre', 'fecha', 'hora', 'numero_reserva', 'link_voucher', 'link_deslinde', 'saldo', 'link_pantalla'].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => insertVariable(v)}
                  className="px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-mono font-bold border border-emerald-200 dark:border-emerald-900 hover:bg-emerald-100 transition"
                >
                  +{`{{${v}}}`}
                </button>
              ))}
            </div>
          </div>

          {/* Cuerpo del Mensaje */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Cuerpo del Mensaje *
            </label>
            <textarea
              rows={6}
              placeholder="Escribe el texto del mensaje aquí..."
              {...register('cuerpo')}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 font-sans"
            ></textarea>
            {errors.cuerpo && <p className="text-[10px] text-red-500 mt-1">{errors.cuerpo.message}</p>}
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-md transition flex items-center space-x-1.5"
            >
              <Send size={14} />
              <span>{isSubmitting ? 'Guardando...' : 'Guardar Plantilla'}</span>
            </button>
          </div>

        </form>
    </Modal>
  );
}
