"use client";

import { UseFormReturn } from 'react-hook-form';
import { Radio, RefreshCw, Send } from 'lucide-react';
import { CreateCondicionPistaPayload } from '@parapente/shared';

interface MeteoBoletinFormProps {
  form: UseFormReturn<CreateCondicionPistaPayload>;
  isSubmitting: boolean;
  onSubmit: (data: CreateCondicionPistaPayload) => void;
  cargarDatosActuales: () => void;
  pronosticoAvailable: boolean;
  pronosticoLoading: boolean;
  refrescando: boolean;
}

export function MeteoBoletinForm({
  form,
  isSubmitting,
  onSubmit,
  cargarDatosActuales,
  pronosticoAvailable,
  pronosticoLoading,
  refrescando,
}: MeteoBoletinFormProps) {
  const { register, handleSubmit } = form;

  return (
    <div className="lg:col-span-1 bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <Radio size={16} />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
              Emitir Nuevo Boletín
            </h3>
            <p className="text-[11px] text-slate-400">Actualizar datos de viento y pista</p>
          </div>
        </div>

        <button
          type="button"
          onClick={cargarDatosActuales}
          disabled={!pronosticoAvailable || pronosticoLoading || refrescando}
          className="shrink-0 flex items-center justify-center space-x-2 py-2.5 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 dark:text-slate-300 rounded-2xl text-xs font-bold transition"
        >
          <RefreshCw size={14} className={pronosticoLoading || refrescando ? 'animate-spin' : ''} />
          <span>Cargar datos actuales</span>
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
            Estado de la Pista *
          </label>
          <select
            {...register('estadoPista')}
            className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ABIERTA">🟢 Pista Abierta (Normal)</option>
            <option value="PRECAUCION">🟡 Modo Precaución (Restringido)</option>
            <option value="CERRADA">🔴 Pista Cerrada (Cancelado)</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="meteo-velocidadViento" className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
              Viento (km/h)
            </label>
            <input
              id="meteo-velocidadViento"
              type="number"
              step="0.1"
              {...register('velocidadViento', { valueAsNumber: true })}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="meteo-rachaViento" className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
              Racha (km/h)
            </label>
            <input
              id="meteo-rachaViento"
              type="number"
              step="0.1"
              {...register('rachaViento', { valueAsNumber: true })}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="meteo-direccionViento" className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
              Dirección
            </label>
            <input
              id="meteo-direccionViento"
              type="text"
              placeholder="Ej: SO, S, O"
              {...register('direccionViento')}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold uppercase outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="meteo-temperatura" className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
              Temp (°C)
            </label>
            <input
              id="meteo-temperatura"
              type="number"
              step="any"
              {...register('temperatura', { valueAsNumber: true })}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label htmlFor="meteo-observaciones" className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
            Observaciones / Avisos de Seguridad
          </label>
          <textarea
            id="meteo-observaciones"
            rows={3}
            placeholder="Ej: Viento frontal constante, buena sustentación, térmicas suaves."
            {...register('observaciones')}
            className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
          ></textarea>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-2xl text-xs font-black shadow-md transition"
        >
          <Send size={14} />
          <span>{isSubmitting ? 'Publicando...' : 'Publicar Boletín Meteorológico'}</span>
        </button>
      </form>
    </div>
  );
}
