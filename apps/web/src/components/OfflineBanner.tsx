'use client';

import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

/**
 * Banner global de estado offline (ADR 009).
 * Se muestra en la parte superior del contenido cuando se pierde la conexión a internet.
 */
export function OfflineBanner() {
  const online = useOnlineStatus();

  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-amber-500/15 dark:bg-amber-500/20 border-b border-amber-500/30 text-amber-900 dark:text-amber-200 px-4 py-2.5 text-xs md:text-sm font-medium backdrop-blur-md flex items-center justify-between gap-3 shadow-xs shrink-0 z-20"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="p-1 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
          <WifiOff size={16} aria-hidden />
        </span>
        <div className="truncate">
          <strong className="font-bold mr-1.5">Modo sin conexión:</strong>
          <span className="text-amber-800 dark:text-amber-300">
            Operando con datos guardados localmente. Los cambios se sincronizarán al recuperar la red.
          </span>
        </div>
      </div>
      <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 shrink-0">
        Offline
      </span>
    </div>
  );
}
