interface FirmaCamposPasajeroProps {
  rutDni: string;
  setRutDni: (val: string) => void;
  pesoVerificado: number | '';
  setPesoVerificado: (val: number | '') => void;
  contactoEmergencia: string;
  setContactoEmergencia: (val: string) => void;
  telefonoEmergencia: string;
  setTelefonoEmergencia: (val: string) => void;
}

export function FirmaCamposPasajero({
  rutDni,
  setRutDni,
  pesoVerificado,
  setPesoVerificado,
  contactoEmergencia,
  setContactoEmergencia,
  telefonoEmergencia,
  setTelefonoEmergencia,
}: FirmaCamposPasajeroProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
          RUT / DNI / Pasaporte
        </label>
        <input
          type="text"
          value={rutDni}
          onChange={(e) => setRutDni(e.target.value)}
          placeholder="12.345.678-9"
          className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
          Peso Verificado (kg)
        </label>
        <input
          type="number"
          step="1"
          min="0"
          value={pesoVerificado}
          onChange={(e) => setPesoVerificado(e.target.value ? parseFloat(e.target.value) : '')}
          placeholder="Ej: 75"
          className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
          Contacto de Emergencia
        </label>
        <input
          type="text"
          value={contactoEmergencia}
          onChange={(e) => setContactoEmergencia(e.target.value)}
          placeholder="Nombre del familiar"
          className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
          Teléfono Emergencia
        </label>
        <input
          type="text"
          value={telefonoEmergencia}
          onChange={(e) => setTelefonoEmergencia(e.target.value)}
          placeholder="+56 9 1234 5678"
          className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  );
}
