import { X } from 'lucide-react';
import type { UseFormRegister, FieldErrors, FieldArrayWithId } from 'react-hook-form';
import type { CreateReservaPayload } from '@parapente/shared';

export interface ReservaPasajeroCardProps {
  field: FieldArrayWithId<CreateReservaPayload, 'pasajeros', 'id'>;
  index: number;
  totalPasajeros: number;
  register: UseFormRegister<CreateReservaPayload>;
  errors: FieldErrors<CreateReservaPayload>;
  onRemove: (index: number) => void;
  copiarDatosTitular: () => void;
}

export function ReservaPasajeroCard({
  field,
  index,
  totalPasajeros,
  register,
  errors,
  onRemove,
  copiarDatosTitular,
}: ReservaPasajeroCardProps) {
  return (
    <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 relative space-y-3">
      <input
        type="hidden"
        {...register(`pasajeros.${index}.id` as const, {
          setValueAs: (v) => (v === '' || v === undefined || v === null || Number.isNaN(Number(v)) ? undefined : Number(v)),
        })}
      />
      <input
        type="hidden"
        {...register(`pasajeros.${index}.firmaDeslinde` as const, {
          setValueAs: (v) => Boolean(v === true || v === 'true'),
        })}
      />

      {totalPasajeros > 1 && (
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="absolute top-3 right-3 text-slate-400 hover:text-red-600 cursor-pointer"
          title="Quitar pasajero"
        >
          <X size={18} />
        </button>
      )}

      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <h4 className="text-xs font-bold text-slate-500 uppercase">Pasajero {index + 1}</h4>
          {field.firmaDeslinde ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              ✓ Deslinde firmado
            </span>
          ) : (
            <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
              Sin firma
            </span>
          )}
        </div>
        {index === 0 && (
          <button
            type="button"
            onClick={copiarDatosTitular}
            className="text-xs bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 hover:bg-blue-100 border border-blue-200 dark:border-blue-800 px-2.5 py-1 rounded-xl transition font-medium cursor-pointer"
          >
            📋 Copiar datos del titular
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">
            Nombre completo <span className="text-red-500">*</span>
          </label>
          <input
            {...register(`pasajeros.${index}.nombre` as const)}
            placeholder="Nombre y Apellido"
            className={`w-full border rounded-xl px-3 py-1.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition ${
              errors.pasajeros?.[index]?.nombre
                ? 'border-red-500 focus:ring-red-400'
                : 'border-slate-200 dark:border-slate-700 focus:ring-blue-500'
            }`}
          />
          {errors.pasajeros?.[index]?.nombre && (
            <p className="text-red-500 text-xs mt-1 font-medium">
              {errors.pasajeros[index]?.nombre?.message}
            </p>
          )}
        </div>

        <div>
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">
            RUT/DNI (Opcional)
          </label>
          <input
            {...register(`pasajeros.${index}.rutDni` as const)}
            placeholder="Ej: 12.345.678-9"
            className={`w-full border rounded-xl px-3 py-1.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition ${
              errors.pasajeros?.[index]?.rutDni
                ? 'border-red-500 focus:ring-red-400'
                : 'border-slate-200 dark:border-slate-700 focus:ring-blue-500'
            }`}
          />
          {errors.pasajeros?.[index]?.rutDni && (
            <p className="text-red-500 text-xs mt-1 font-medium">
              {errors.pasajeros[index]?.rutDni?.message}
            </p>
          )}
        </div>

        <div>
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">
            Peso ref. (Kg)
          </label>
          <input
            {...register(`pasajeros.${index}.peso` as const, {
              setValueAs: (v) => (v === '' || v === undefined || v === null || Number.isNaN(Number(v)) ? null : Number(v)),
            })}
            type="number"
            placeholder="75"
            className={`w-full border rounded-xl px-3 py-1.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition ${
              errors.pasajeros?.[index]?.peso
                ? 'border-red-500 focus:ring-red-400'
                : 'border-slate-200 dark:border-slate-700 focus:ring-blue-500'
            }`}
          />
          {errors.pasajeros?.[index]?.peso && (
            <p className="text-red-500 text-xs mt-1 font-medium">
              {errors.pasajeros[index]?.peso?.message}
            </p>
          )}
        </div>

        <div>
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">
            WhatsApp (Opcional)
          </label>
          <input
            {...register(`pasajeros.${index}.telefono` as const)}
            type="tel"
            placeholder="+56 9 1234 5678"
            className={`w-full border rounded-xl px-3 py-1.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition ${
              errors.pasajeros?.[index]?.telefono
                ? 'border-red-500 focus:ring-red-400'
                : 'border-slate-200 dark:border-slate-700 focus:ring-blue-500'
            }`}
          />
          {errors.pasajeros?.[index]?.telefono && (
            <p className="text-red-500 text-xs mt-1 font-medium">
              {errors.pasajeros[index]?.telefono?.message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
