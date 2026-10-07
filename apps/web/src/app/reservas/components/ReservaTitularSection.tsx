import { Ticket } from 'lucide-react';
import type { UseFormRegister, FieldErrors } from 'react-hook-form';
import type { CreateReservaPayload } from '@parapente/shared';

export interface ReservaTitularSectionProps {
  register: UseFormRegister<CreateReservaPayload>;
  errors: FieldErrors<CreateReservaPayload>;
}

export function ReservaTitularSection({ register, errors }: ReservaTitularSectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 border-b pb-2 dark:border-slate-800">
        1. Datos del Titular o Contacto
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
            Nombre Completo <span className="text-red-500">*</span>
          </label>
          <input
            {...register('nombreTitular')}
            placeholder="Ej: Juan Pérez"
            className={`w-full border rounded-xl px-3.5 py-2 text-sm focus:ring-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition ${
              errors.nombreTitular
                ? 'border-red-500 focus:ring-red-400'
                : 'border-slate-200 dark:border-slate-700 focus:ring-blue-500'
            }`}
          />
          {errors.nombreTitular && (
            <p className="text-red-500 text-xs mt-1 font-medium">{errors.nombreTitular.message}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
            RUT / DNI (Opcional)
          </label>
          <input
            {...register('rutDniTitular')}
            placeholder="Ej: 12.345.678-9"
            className={`w-full border rounded-xl px-3.5 py-2 text-sm focus:ring-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition ${
              errors.rutDniTitular
                ? 'border-red-500 focus:ring-red-400'
                : 'border-slate-200 dark:border-slate-700 focus:ring-blue-500'
            }`}
          />
          {errors.rutDniTitular && (
            <p className="text-red-500 text-xs mt-1 font-medium">{errors.rutDniTitular.message}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
            Teléfono / WhatsApp
          </label>
          <input
            {...register('telefono')}
            type="tel"
            placeholder="+56 9 1234 5678"
            className={`w-full border rounded-xl px-3.5 py-2 text-sm focus:ring-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition ${
              errors.telefono
                ? 'border-red-500 focus:ring-red-400'
                : 'border-slate-200 dark:border-slate-700 focus:ring-blue-500'
            }`}
          />
          {errors.telefono && (
            <p className="text-red-500 text-xs mt-1 font-medium">{errors.telefono.message}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
            Correo Electrónico (Opcional)
          </label>
          <input
            {...register('email')}
            type="email"
            placeholder="ejemplo@correo.com"
            className={`w-full border rounded-xl px-3.5 py-2 text-sm focus:ring-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition ${
              errors.email
                ? 'border-red-500 focus:ring-red-400'
                : 'border-slate-200 dark:border-slate-700 focus:ring-blue-500'
            }`}
          />
          {errors.email && (
            <p className="text-red-500 text-xs mt-1 font-medium">{errors.email.message}</p>
          )}
        </div>

        {/* Opción Giftcard / Regalo */}
        <div className="sm:col-span-2">
          <label className="flex items-center gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer hover:bg-slate-100/80 dark:hover:bg-slate-800 transition">
            <input
              type="checkbox"
              {...register('esGiftCard')}
              className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
            />
            <div className="flex items-center gap-2">
              <Ticket size={16} className="text-amber-500 shrink-0" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                ¿Es una reserva de tipo Giftcard / Regalo?
              </span>
            </div>
          </label>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 pl-1">
            Las reservas se crean sin fecha ni hora referenciales. Marca esta opción si corresponde a una Giftcard vendida o regalo para identificarla en el sistema.
          </p>
        </div>
      </div>
    </div>
  );
}
