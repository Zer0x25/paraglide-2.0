import {
  Smartphone,
  Globe,
  ExternalLink,
  Download,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { Button } from '../ui';

interface SyncPlatformOptionsProps {
  finalWebcalUrl: string;
  isOneClickGoogle: boolean;
  isReconciling: boolean;
  googleCalendarEnabled?: boolean;
  onGoogleCalendarFlow: () => void;
  onReconcileGoogleCalendar: () => void;
  onDownloadIcs: () => void;
}

export function SyncPlatformOptions({
  finalWebcalUrl,
  isOneClickGoogle,
  isReconciling,
  googleCalendarEnabled,
  onGoogleCalendarFlow,
  onReconcileGoogleCalendar,
  onDownloadIcs,
}: SyncPlatformOptionsProps) {
  return (
    <div className="space-y-2.5">
      <p className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider pl-1">
        Elige tu opción de sincronización:
      </p>

      {/* 1. Opción iPhone / Mac (Apple Calendar) */}
      <div className="p-3.5 bg-linear-to-r from-blue-50/80 to-blue-50/30 dark:from-blue-950/40 dark:to-slate-900 border border-blue-100 dark:border-blue-900/60 rounded-xl flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center space-x-1.5 font-bold text-xs text-blue-950 dark:text-blue-200">
            <Smartphone size={15} className="text-blue-600 dark:text-blue-400" />
            <span>iPhone / iPad / Mac (Apple Calendar)</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Suscripción nativa en segundo plano en la app Calendario de Apple.
          </p>
        </div>
        <Button
          variant="primary"
          className="shrink-0 font-bold text-xs py-2 px-3.5 rounded-lg shadow-sm"
          onClick={() => window.open(finalWebcalUrl, '_blank')}
        >
          <span>1-Clic Apple</span>
          <ArrowRight size={13} />
        </Button>
      </div>

      {/* 2. Opción Google Calendar */}
      <div className="p-3.5 bg-linear-to-r from-emerald-50/80 to-emerald-50/30 dark:from-emerald-950/40 dark:to-slate-900 border border-emerald-100 dark:border-emerald-900/60 rounded-xl flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center space-x-1.5 font-bold text-xs text-emerald-950 dark:text-emerald-200">
            <Globe size={15} className="text-emerald-600 dark:text-emerald-400" />
            <span>Google Calendar (Gmail / Android)</span>
            {isOneClickGoogle && (
              <span className="text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                ⚡ 1-Clic en Vivo
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {isOneClickGoogle
              ? 'Añade el calendario oficial de vuelos directamente a tu Google Calendar con 1 clic (tiempo real 0s).'
              : 'Copia la URL del feed y abre la pantalla oficial de Google para sincronizar.'}
          </p>
        </div>
        <Button
          variant="primary"
          className="shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-sm"
          onClick={onGoogleCalendarFlow}
        >
          <span>{isOneClickGoogle ? '1-Clic Google' : 'Abrir Google'}</span>
          <ExternalLink size={13} />
        </Button>
      </div>

      {/* Reconciliación Manual & Automática (Google Calendar Activo) */}
      {googleCalendarEnabled && (
        <div className="p-3.5 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 rounded-xl flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center space-x-1.5 font-bold text-xs text-blue-950 dark:text-blue-200">
              <RefreshCw
                size={14}
                className={`text-blue-600 dark:text-blue-400 ${isReconciling ? 'animate-spin' : ''}`}
              />
              <span>Sincronización Total Desatendida</span>
              <span className="text-[10px] bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-semibold px-2 py-0.5 rounded-full">
                Cada 60 min
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              El servidor auto-reconcilia los vuelos periódicamente. Puedes forzar una sincronización inmediata ahora.
            </p>
          </div>
          <button
            type="button"
            disabled={isReconciling}
            onClick={onReconcileGoogleCalendar}
            className="shrink-0 inline-flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2 px-3.5 rounded-lg shadow-sm transition disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw size={13} className={isReconciling ? 'animate-spin' : ''} />
            <span>{isReconciling ? 'Sincronizando...' : 'Sincronizar Todo'}</span>
          </button>
        </div>
      )}

      {/* 3. Opción Descargar Archivo .ICS */}
      <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center space-x-1.5 font-bold text-xs text-slate-800 dark:text-slate-200">
            <Download size={15} className="text-slate-600 dark:text-slate-400" />
            <span>Descargar Archivo .ics (Universal)</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Para abrir o importar directamente en cualquier calendario del teléfono o PC.
          </p>
        </div>
        <button
          type="button"
          onClick={onDownloadIcs}
          className="shrink-0 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-bold text-xs py-2 px-3.5 rounded-lg transition flex items-center space-x-1 cursor-pointer"
        >
          <Download size={13} />
          <span>Descargar</span>
        </button>
      </div>
    </div>
  );
}
