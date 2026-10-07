import { PlusCircle } from 'lucide-react';
import type { UseFormRegister, FieldErrors, FieldArrayWithId } from 'react-hook-form';
import type { CreateReservaPayload, CreatePasajeroPayload } from '@parapente/shared';
import { ReservaPasajeroCard } from './ReservaPasajeroCard';

export interface ReservaPasajerosSectionProps {
  register: UseFormRegister<CreateReservaPayload>;
  errors: FieldErrors<CreateReservaPayload>;
  pasajerosFields: FieldArrayWithId<CreateReservaPayload, 'pasajeros', 'id'>[];
  append: (val: CreatePasajeroPayload) => void;
  remove: (index: number) => void;
  tarifaSeleccionada: number | '';
  promoSeleccionada: number | '';
  calcularValor: (tarifaId: number | '', promoId: number | '', cantidadOverride?: number) => void;
  copiarDatosTitular: () => void;
}

export function ReservaPasajerosSection({
  register,
  errors,
  pasajerosFields,
  append,
  remove,
  tarifaSeleccionada,
  promoSeleccionada,
  calcularValor,
  copiarDatosTitular,
}: ReservaPasajerosSectionProps) {
  const handleAddPasajero = () => {
    append({
      nombre: '',
      rutDni: '',
      peso: null,
      telefono: '',
      contactoEmergencia: '',
      telefonoEmergencia: '',
      condicionFisica: '',
      firmaDeslinde: false,
      estado: 'POR_VOLAR',
    });
    if (tarifaSeleccionada) {
      calcularValor(tarifaSeleccionada, promoSeleccionada, pasajerosFields.length + 1);
    }
  };

  const handleRemovePasajero = (index: number) => {
    remove(index);
    if (tarifaSeleccionada) {
      calcularValor(
        tarifaSeleccionada,
        promoSeleccionada,
        Math.max(1, pasajerosFields.length - 1)
      );
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center border-b pb-2 dark:border-slate-800">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
          2. Pasajeros a Volar
        </h3>
        <button
          type="button"
          onClick={handleAddPasajero}
          className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center cursor-pointer"
        >
          <PlusCircle size={15} className="mr-1" />
          Añadir Pasajero
        </button>
      </div>

      {pasajerosFields.map((field, index) => (
        <ReservaPasajeroCard
          key={field.id}
          field={field}
          index={index}
          totalPasajeros={pasajerosFields.length}
          register={register}
          errors={errors}
          onRemove={handleRemovePasajero}
          copiarDatosTitular={copiarDatosTitular}
        />
      ))}
    </div>
  );
}
