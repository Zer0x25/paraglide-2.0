import { useState } from 'react';
import { Copy, Check, ShieldCheck, RefreshCw, AlertTriangle, CalendarClock } from 'lucide-react';

interface SyncDirectLinkSectionProps {
  finalHttpUrl: string;
  copied: boolean;
  currentTargetName: string;
  expiraEn?: string;
  isRegenerating: boolean;
  onCopyUrl: () => void;
  onRegenerate: () => void;
}

export function SyncDirectLinkSection({
  finalHttpUrl,
  copied,
  currentTargetName,
  expiraEn,
  isRegenerating,
  onCopyUrl,
  onRegenerate,
}: SyncDirectLinkSectionProps) {
  // Confirmación en dos pasos: regenerar invalida los enlaces anteriores.
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
        <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          Enlace directo firmado de suscripción:
        </label>
        <div className="flex items-center space-x-2">
          <input
            readOnly
            type="text"
            value={finalHttpUrl}
            onClick={(e) => (e.target as HTMLInputElement).select()}
            className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-700 dark:text-slate-300 select-all"
          />
          <button
            type="button"
            onClick={onCopyUrl}
            className="inline-flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-sm transition cursor-pointer"
          >
            {copied ? <Check size={14} className="text-emerald-300" /> : <Copy size={14} />}
            <span>{copied ? '¡Copiado!' : 'Copiar'}</span>
          </button>
        </div>

        {confirming ? (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 dark:border-amber-700/60 dark:bg-amber-900/20 px-3 py-2">
            <AlertTriangle size={14} className="text-amber-500 shrink-0" />
            <span className="text-[11px] text-amber-700 dark:text-amber-300 flex-1 min-w-[180px]">
              Los enlaces anteriores dejarán de funcionar. ¿Regenerar?
            </span>
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                onRegenerate();
              }}
              disabled={isRegenerating}
              className="inline-flex items-center space-x-1 bg-amber-600 hover:bg-amber-700 text-white px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer disabled:opacity-60"
            >
              <RefreshCw size={12} className={isRegenerating ? 'animate-spin' : ''} />
              <span>{isRegenerating ? 'Regenerando…' : 'Sí, regenerar'}</span>
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={isRegenerating}
              className="px-3 py-1 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            {expiraEn ? (
              <span className="inline-flex items-center space-x-1.5 text-[11px] text-slate-400 dark:text-slate-500">
                <CalendarClock size={13} className="text-slate-400" />
                <span>
                  Válido hasta:{' '}
                  {new Date(expiraEn).toLocaleDateString('es-CL', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })}
                </span>
              </span>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={isRegenerating}
              className="inline-flex items-center space-x-1.5 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer disabled:opacity-60"
            >
              <RefreshCw size={13} className={isRegenerating ? 'animate-spin' : ''} />
              <span>Regenerar enlace</span>
            </button>
          </div>
        )}
      </div>

      <div className="pt-1 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
        <span className="flex items-center space-x-1.5">
          <ShieldCheck size={13} className="text-emerald-500" />
          <span>Token criptográfico seguro HMAC</span>
        </span>
        <span>{currentTargetName}</span>
      </div>
    </>
  );
}
