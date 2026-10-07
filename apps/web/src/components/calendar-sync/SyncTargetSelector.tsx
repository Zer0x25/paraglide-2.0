import { Globe } from 'lucide-react';
import type { SyncInfo } from './types';

interface SyncTargetSelectorProps {
  syncInfo: SyncInfo | null;
  selectedTarget: 'universal' | number;
  onSelectTarget: (target: 'universal' | number) => void;
}

export function SyncTargetSelector({
  syncInfo,
  selectedTarget,
  onSelectTarget,
}: SyncTargetSelectorProps) {
  return (
    <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2">
        🎯 Vuelos a Sincronizar:
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onSelectTarget('universal')}
          className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-semibold border transition cursor-pointer ${
            selectedTarget === 'universal'
              ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300'
          }`}
        >
          <Globe size={15} />
          <span>Todos los Vuelos (Admin)</span>
        </button>

        {syncInfo && syncInfo.pilotos.length > 0 && (
          <div className="relative">
            <select
              value={typeof selectedTarget === 'number' ? selectedTarget : ''}
              onChange={(e) => {
                const val = e.target.value;
                if (val) onSelectTarget(Number(val));
              }}
              className={`w-full px-3 py-2 rounded-lg text-xs font-semibold border transition bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 ${
                typeof selectedTarget === 'number'
                  ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                  : ''
              }`}
            >
              <option value="">🧑‍✈️ Filtrar por Piloto...</option>
              {syncInfo.pilotos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} ({p.categoria})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
