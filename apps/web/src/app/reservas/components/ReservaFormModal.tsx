import { X } from 'lucide-react';
import type {
  UseFormRegister,
  UseFormHandleSubmit,
  FieldErrors,
  FieldArrayWithId,
} from 'react-hook-form';
import type {
  CreateReservaPayload,
  CreatePasajeroPayload,
  TarifaDTO,
  PromocionDTO,
} from '@parapente/shared';
import { ReservaTitularSection } from './ReservaTitularSection';
import { ReservaTarifaSection } from './ReservaTarifaSection';
import { ReservaPasajerosSection } from './ReservaPasajerosSection';

export interface ReservaFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingId: number | null;
  register: UseFormRegister<CreateReservaPayload>;
  handleSubmit: UseFormHandleSubmit<CreateReservaPayload>;
  onSubmit: (data: CreateReservaPayload) => Promise<void>;
  onInvalid: (errors: FieldErrors<CreateReservaPayload>) => void;
  errors: FieldErrors<CreateReservaPayload>;
  isDirty: boolean;
  pasajerosFields: FieldArrayWithId<CreateReservaPayload, 'pasajeros', 'id'>[];
  append: (val: CreatePasajeroPayload) => void;
  remove: (index: number) => void;
  tarifaSeleccionada: number | '';
  setTarifaSeleccionada: (val: number | '') => void;
  promoSeleccionada: number | '';
  setPromoSeleccionada: (val: number | '') => void;
  tarifasActivas: TarifaDTO[];
  promosVigentes: PromocionDTO[];
  detalleCalculo: string | null;
  copiarDatosTitular: () => void;
  calcularValor: (tarifaId: number | '', promoId: number | '', cantidadOverride?: number) => void;
}

export function ReservaFormModal({
  isOpen,
  onClose,
  editingId,
  register,
  handleSubmit,
  onSubmit,
  onInvalid,
  errors,
  isDirty,
  pasajerosFields,
  append,
  remove,
  tarifaSeleccionada,
  setTarifaSeleccionada,
  promoSeleccionada,
  setPromoSeleccionada,
  tarifasActivas,
  promosVigentes,
  detalleCalculo,
  copiarDatosTitular,
  calcularValor,
}: ReservaFormModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 overflow-y-auto p-3 sm:p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl p-5 sm:p-6 relative my-auto max-h-[90vh] overflow-y-auto border border-slate-100 dark:border-slate-800">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
        >
          <X size={22} />
        </button>
        <h2 className="text-xl font-bold mb-6 text-slate-900 dark:text-white">
          {editingId ? 'Editar Reserva' : 'Crear Nueva Reserva'}
        </h2>

        <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-6">
          {/* Sección 1: Datos del Titular */}
          <ReservaTitularSection register={register} errors={errors} />

          {/* Sección 2: Tarifas y Valor */}
          <div className="border-t pt-4 dark:border-slate-800">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 border-b pb-2 dark:border-slate-800 mb-3">
              Tarifa y Resumen
            </h3>
            <ReservaTarifaSection
              register={register}
              errors={errors}
              tarifaSeleccionada={tarifaSeleccionada}
              setTarifaSeleccionada={setTarifaSeleccionada}
              promoSeleccionada={promoSeleccionada}
              setPromoSeleccionada={setPromoSeleccionada}
              tarifasActivas={tarifasActivas}
              promosVigentes={promosVigentes}
              detalleCalculo={detalleCalculo}
              calcularValor={calcularValor}
            />
          </div>

          {/* Sección 3: Pasajeros a Volar */}
          <ReservaPasajerosSection
            register={register}
            errors={errors}
            pasajerosFields={pasajerosFields}
            append={append}
            remove={remove}
            tarifaSeleccionada={tarifaSeleccionada}
            promoSeleccionada={promoSeleccionada}
            calcularValor={calcularValor}
            copiarDatosTitular={copiarDatosTitular}
          />

          {/* Botones de Acción */}
          <div className="flex justify-end space-x-3 pt-4 border-t dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium text-sm transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!isDirty}
              title={!isDirty ? 'No hay cambios por guardar' : undefined}
              className={`px-6 py-2.5 rounded-xl font-bold text-sm shadow-md transition ${
                !isDirty
                  ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed opacity-60'
                  : 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
              }`}
            >
              {editingId ? 'Guardar Cambios' : 'Crear Reserva'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
