'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X, AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import {
  subscribeOutboxCount,
  listOutbox,
  listConflictos,
  replayIfIdle,
  removeConflicto,
  clearConflictos,
  reintentarConflicto,
} from '@/services/outbox/outbox.service';
import { apiRaw } from '@/services/api';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import type { OutboxEntry, OutboxConflicto } from '@/services/outbox/types';
import { Spinner } from '@/components/ui';

/**
 * Badge de estado del outbox offline (ADR 009).
 * - Muestra conflictos (rojo) con prioridad sobre cambios pendientes (ámbar).
 * - Al reconectar (online) o al abrirse/reconectarse el SSE dispara el replay
 *   automáticamente a través del lock centralizado `replayIfIdle` con estabilización (ADR 009).
 * - Resolución explícita de conflictos: descartar (aceptar servidor) o reintentar con versión fresca.
 */
export function OutboxBadge() {
  const queryClient = useQueryClient();
  const [entries, setEntries] = useState<OutboxEntry[]>([]);
  const [conflictosList, setConflictosList] = useState<OutboxConflicto[]>([]);
  const [open, setOpen] = useState(false);
  const [resolviendoId, setResolviendoId] = useState<string | null>(null);

  const count = entries.length;
  const conflictos = conflictosList.length;

  const refresh = useCallback(() => {
    listOutbox()
      .then(setEntries)
      .catch(() => setEntries([]));
    listConflictos()
      .then(setConflictosList)
      .catch(() => setConflictosList([]));
  }, []);

  // Suscripción a cambios en el outbox + carga inicial.
  useEffect(() => {
    const unsub = subscribeOutboxCount(() => refresh());
    refresh();
    return unsub;
  }, [refresh]);

  // Replay automático al reconectar con pequeña espera de estabilización móvil
  const online = useOnlineStatus();
  const replayedRef = useRef(false);
  const countRef = useRef(count);
  useEffect(() => {
    countRef.current = count;
  }, [count]);

  const doReplay = useCallback(() => {
    if (replayedRef.current) return;
    if (countRef.current <= 0) return;
    replayedRef.current = true;
    // Lock centralizado (ADR 009): evita solaparse con el replay disparado por SSE u otros triggers.
    replayIfIdle(apiRaw)
      .then(() => refresh())
      .catch(() => {
        replayedRef.current = false;
      });
  }, [refresh]);

  useEffect(() => {
    if (!online) {
      replayedRef.current = false; // permitir re-disparo en la próxima conexión
      return;
    }
    if (count > 0) {
      // Pequeña pausa de estabilización de red celular / Wi-Fi en móviles
      const timer = setTimeout(() => {
        doReplay();
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [online, count, doReplay]);

  // Respaldo: evento window 'online'.
  useEffect(() => {
    const on = () => {
      setTimeout(() => doReplay(), 600);
    };
    window.addEventListener('online', on);
    return () => window.removeEventListener('online', on);
  }, [doReplay]);

  // Cierre del panel con Escape y click fuera.
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open]);

  // Acciones de resolución de conflictos
  const handleDescartar = async (id: string) => {
    setResolviendoId(id);
    try {
      await removeConflicto(id);
      queryClient.invalidateQueries();
      refresh();
      toast.info('Cambio local descartado. Se muestran los datos del servidor.');
    } finally {
      setResolviendoId(null);
    }
  };

  const handleReintentar = async (id: string) => {
    setResolviendoId(id);
    try {
      const res = await reintentarConflicto(id, apiRaw);
      if (res.success) {
        queryClient.invalidateQueries();
        refresh();
        toast.success('Cambio sincronizado exitosamente con el servidor.');
      } else {
        toast.error(`No se pudo sincronizar: ${res.error || 'Conflicto persistente'}`);
        refresh();
      }
    } finally {
      setResolviendoId(null);
    }
  };

  const handleDescartarTodos = async () => {
    await clearConflictos();
    queryClient.invalidateQueries();
    refresh();
    setOpen(false);
    toast.info('Todos los conflictos locales fueron descartados.');
  };

  if (count === 0 && conflictos === 0) return null;

  const hasConflictos = conflictos > 0;

  const badgeClasses = hasConflictos
    ? 'bg-red-600 text-white border-red-500 hover:bg-red-700'
    : 'bg-amber-500 text-white border-amber-400 hover:bg-amber-600';

  const label = hasConflictos
    ? `${conflictos} conflicto${conflictos === 1 ? '' : 's'}`
    : `${count} cambio${count === 1 ? '' : 's'} pendiente${count === 1 ? '' : 's'}`;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={hasConflictos ? `Hay ${conflictos} conflicto${conflictos === 1 ? '' : 's'} de sincronización` : `Hay ${count} cambio${count === 1 ? '' : 's'} pendiente${count === 1 ? '' : 's'} de sincronización`}
        title={hasConflictos ? `${conflictos} conflicto${conflictos === 1 ? '' : 's'} de sincronización` : `${count} cambio${count === 1 ? '' : 's'} pendiente${count === 1 ? '' : 's'} de sincronización`}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors min-h-[36px] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 ${badgeClasses}`}
      >
        {hasConflictos ? (
          <AlertTriangle size={14} aria-hidden />
        ) : (
          <Spinner size="sm" color="border-white border-t-transparent" aria-hidden />
        )}
        <span>{label}</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Estado del outbox offline"
          className="absolute bottom-full left-0 mb-2 z-[60] w-72 sm:w-80 max-h-96 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xl dark:border-slate-700 dark:bg-slate-800 animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="mb-2.5 flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-700">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              {hasConflictos ? (
                <>
                  <AlertTriangle size={14} className="text-red-600" />
                  <span>Conflictos de sincronización</span>
                </>
              ) : (
                <>
                  <RefreshCw size={14} className="text-amber-500" />
                  <span>Cambios pendientes offline</span>
                </>
              )}
            </h3>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar"
              className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
            >
              <X size={16} />
            </button>
          </div>

          {hasConflictos ? (
            <div className="space-y-3">
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Los siguientes cambios no pudieron aplicarse automáticamente debido a cambios concurrentes o datos actualizados en el servidor:
              </p>
              <ul className="space-y-2">
                {conflictosList.map((c) => {
                  const isConflict409 = c.status === 409 || c.error.toLowerCase().includes('conflicto') || c.error.toLowerCase().includes('cambiaron');
                  return (
                    <li
                      key={c.id}
                      className="rounded-xl border border-red-200 bg-red-50/70 p-2.5 text-xs dark:border-red-900/60 dark:bg-red-950/40 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-red-800 dark:text-red-300 uppercase text-[10px] tracking-wider px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/80">
                          {c.entidad}
                        </span>
                        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                          {c.metodo} {c.url}
                        </span>
                      </div>
                      <p className="text-red-700 dark:text-red-300 text-[11px] font-medium leading-tight">
                        {c.error}
                      </p>
                      {isConflict409 && (
                        <p className="text-slate-500 dark:text-slate-400 text-[10px]">
                          Los datos cambiaron en el servidor mientras estabas desconectado.
                        </p>
                      )}
                      <div className="flex items-center gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => handleDescartar(c.id)}
                          disabled={resolviendoId === c.id}
                          className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition"
                        >
                          <Trash2 size={12} />
                          <span>Descartar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReintentar(c.id)}
                          disabled={resolviendoId === c.id}
                          className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-red-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-red-700 transition"
                        >
                          {resolviendoId === c.id ? (
                            <Spinner size="sm" color="border-white border-t-transparent" />
                          ) : (
                            <RefreshCw size={12} />
                          )}
                          <span>Reintentar</span>
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleDescartarTodos}
                  className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 text-center"
                >
                  Descartar todos los conflictos
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <ul className="space-y-2">
                {entries.map((e) => (
                  <li
                    key={e.id}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs dark:border-slate-700 dark:bg-slate-900/40"
                  >
                    <p className="font-medium text-slate-800 dark:text-slate-100">{e.entidad}</p>
                    <p className="text-slate-500 dark:text-slate-400">
                      {e.metodo} {e.url}
                    </p>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => {
                  replayIfIdle(apiRaw).then(() => refresh());
                }}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-amber-600"
              >
                <RefreshCw size={14} aria-hidden />
                Reintentar ahora
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

