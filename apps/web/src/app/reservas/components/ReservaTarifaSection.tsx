import { formatCLP } from '../../../utils/format';
import type { UseFormRegister, FieldErrors } from 'react-hook-form';
import type { CreateReservaPayload, TarifaDTO, PromocionDTO } from '@parapente/shared';

export interface ReservaTarifaSectionProps {
  register: UseFormRegister<CreateReservaPayload>;
  errors: FieldErrors<CreateReservaPayload>;
  tarifaSeleccionada: number | '';
  setTarifaSeleccionada: (val: number | '') => void;
  promoSeleccionada: number | '';
  setPromoSeleccionada: (val: number | '') => void;
  tarifasActivas: TarifaDTO[];
  promosVigentes: PromocionDTO[];
  detalleCalculo: string | null;
  calcularValor: (tarifaId: number | '', promoId: number | '', cantidadOverride?: number) => void;
}

export function ReservaTarifaSection({
  register,
  errors,
  tarifaSeleccionada,
  setTarifaSeleccionada,
  promoSeleccionada,
  setPromoSeleccionada,
  tarifasActivas,
  promosVigentes,
  detalleCalculo,
  calcularValor,
}: ReservaTarifaSectionProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
      <div>
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
          Tarifa (opcional)
        </label>
        <select
          value={tarifaSeleccionada}
          onChange={(e) => {
            const v = e.target.value === '' ? '' : Number(e.target.value);
            setTarifaSeleccionada(v);
            calcularValor(v, promoSeleccionada);
          }}
          className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
        >
          <option value="">Sin tarifa (valor manual)</option>
          {tarifasActivas.map((t: TarifaDTO) => (
            <option key={t.id} value={t.id}>
              {t.nombre} — {formatCLP(t.precio)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
          Promoción (opcional)
        </label>
        <select
          value={promoSeleccionada}
          onChange={(e) => {
            const v = e.target.value === '' ? '' : Number(e.target.value);
            setPromoSeleccionada(v);
            calcularValor(tarifaSeleccionada, v);
          }}
          disabled={!tarifaSeleccionada}
          className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white disabled:opacity-50"
        >
          <option value="">Sin promoción</option>
          {promosVigentes.map((p: PromocionDTO) => (
            <option key={p.id} value={p.id}>
              {p.nombre} ({p.tipoDescuento === 'PORCENTAJE' ? `${p.valor}%` : `${formatCLP(p.valor)}/vuelo`})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
          Valor Total ($ CLP)
        </label>
        <input
          {...register('valorTotal', {
            setValueAs: (v) => (v === '' || v === undefined || v === null || Number.isNaN(Number(v)) ? 0 : Number(v)),
          })}
          type="number"
          className={`w-full border rounded-xl px-3.5 py-2 text-sm focus:ring-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition ${
            errors.valorTotal
              ? 'border-red-500 focus:ring-red-400'
              : 'border-slate-200 dark:border-slate-700 focus:ring-blue-500'
          }`}
        />
        {errors.valorTotal && (
          <p className="text-red-500 text-xs mt-1 font-medium">{errors.valorTotal.message}</p>
        )}
        {detalleCalculo && (
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">{detalleCalculo}</p>
        )}
      </div>
    </div>
  );
}
