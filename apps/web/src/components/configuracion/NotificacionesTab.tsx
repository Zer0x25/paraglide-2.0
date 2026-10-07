'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Bell, Smartphone, Clock, AlertTriangle, Save } from 'lucide-react';
import type { NotificacionConfigDTO } from '@parapente/shared';
import typedApi from '@/services/api';
import { Button, Spinner } from '@/components/ui';
import { isConflictError } from '@/hooks/useDomainMutation';

/**
 * Tab Notificaciones (/configuracion): switches on/off por tipo de aviso automático.
 * Singleton NotificacionConfig (id=1): dos flags + version (ADR 004, 409 → recarga).
 * QueryKey ['notificaciones-config'] == QUERY_KEY_POR_ENTIDAD['notificacion-config'].
 */

function SwitchRow({
  label,
  descripcion,
  icono,
  checked,
  onToggle,
  disabled,
}: {
  label: string;
  descripcion: string;
  icono: React.ReactNode;
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      <div className="flex gap-3 min-w-0">
        <div className={`mt-0.5 shrink-0 w-9 h-9 rounded-xl grid place-items-center ${checked ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
          {icono}
        </div>
        <div className="min-w-0">
          <p className="font-bold text-sm text-slate-900 dark:text-white">{label}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-snug mt-0.5">{descripcion}</p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={onToggle}
        disabled={disabled}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-40 ${
          checked ? 'bg-emerald-600 dark:bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${
            checked ? 'translate-x-5' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

export default function NotificacionesTab() {
  const queryClient = useQueryClient();

  const { data, isPending, isError, error } = useQuery({
    queryKey: ['notificaciones-config'],
    queryFn: () => typedApi.notificaciones.obtenerConfig() as Promise<NotificacionConfigDTO>,
  });

  const [draft24, setDraft24] = useState<boolean | null>(null);
  const [draftClima, setDraftClima] = useState<boolean | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- hidrata draft controlado desde query; no derivable en render */
  useEffect(() => {
    if (data) {
      setDraft24(data.recordatorio24hActivo);
      setDraftClima(data.avisoClimaActivo);
    }
  }, [data]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const mutate = useMutation({
    mutationFn: (payload: { recordatorio24hActivo?: boolean; avisoClimaActivo?: boolean; version: number }) =>
      typedApi.notificaciones.actualizarConfig(payload) as Promise<NotificacionConfigDTO>,
    onSuccess: (actualizada) => {
      toast.success('Configuración de notificaciones guardada.');
      queryClient.setQueryData(['notificaciones-config'], actualizada);
      queryClient.invalidateQueries({ queryKey: ['notificaciones-config'] });
      setDraft24(actualizada.recordatorio24hActivo);
      setDraftClima(actualizada.avisoClimaActivo);
    },
    onError: (err: unknown) => {
      if (isConflictError(err)) {
        toast.info('La configuración cambió en otro dispositivo. Recargando…');
        queryClient.invalidateQueries({ queryKey: ['notificaciones-config'] });
      } else {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'No se pudo guardar la configuración.';
        toast.error(String(msg).slice(0, 160));
      }
    },
  });

  if (isPending) {
    return (
      <div className="flex items-center gap-2 py-10 justify-center text-slate-500">
        <Spinner /> Cargando configuración de notificaciones…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm text-amber-800 dark:text-amber-200">
        No se pudo cargar la configuración. {(error as Error)?.message ?? ''} Reintenta refrescando la página.
      </div>
    );
  }

  const cfg = data as NotificacionConfigDTO;
  const v24 = draft24 ?? cfg.recordatorio24hActivo;
  const vClima = draftClima ?? cfg.avisoClimaActivo;
  const hasChanges = v24 !== cfg.recordatorio24hActivo || vClima !== cfg.avisoClimaActivo;

  const handleGuardar = () => {
    const payload: Record<string, unknown> = { version: cfg.version };
    if (v24 !== cfg.recordatorio24hActivo) payload.recordatorio24hActivo = v24;
    if (vClima !== cfg.avisoClimaActivo) payload.avisoClimaActivo = vClima;
    if (Object.keys(payload).length === 1) return; // solo version
    mutate.mutate(payload as never);
  };

  const handleDescartar = () => {
    setDraft24(cfg.recordatorio24hActivo);
    setDraftClima(cfg.avisoClimaActivo);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950 grid place-items-center shrink-0">
          <Bell size={18} className="text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="min-w-0">
          <h3 className="font-black text-sm text-slate-900 dark:text-white">Notificaciones automáticas</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
            Activa o pausa los envíos automáticos por vuelo (principalmente WhatsApp). Cuando un tipo está desactivado, el scheduler lo omite
            por completo; los envíos manuales desde /plantillas siguen funcionando.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <SwitchRow
          label="Recordatorio 24 h antes del vuelo"
          descripcion="Se envía ~24 h antes de cada vuelo agendado (ventana ±30 min). Usa la plantilla RECORDATORIO_24H. Desactívalo si no quieres mensajes previos por WhatsApp."
          icono={<Clock size={16} />}
          checked={v24}
          onToggle={() => setDraft24((v) => !v)}
          disabled={mutate.isPending}
        />
        <SwitchRow
          label="Aviso de clima / cancelación (ventana 2 h)"
          descripcion="Aviso operativo ~2 h antes del vuelo (ventana ±15 min). Plantilla AVISO_CLIMA_CANCELACION. Desactívalo si no quieres mensajes automáticos de clima/confirmación."
          icono={<AlertTriangle size={16} />}
          checked={vClima}
          onToggle={() => setDraftClima((v) => !v)}
          disabled={mutate.isPending}
        />
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-3 flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300">
        <Smartphone size={16} className="shrink-0 text-slate-400 mt-0.5" />
        <span>
          Estos controles pausan solo los <strong>envíos automáticos</strong> del scheduler (cada 60 min). Los mensajes que el equipo dispare manualmente
          no se ven afectados. El estado se sincroniza en tiempo real a todos los navegadores abiertos vía SSE.
        </span>
      </div>

      {hasChanges && (
        <div className="sticky bottom-2 z-10 flex flex-wrap gap-2 justify-end p-3 rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-white/90 dark:bg-slate-900/90 backdrop-blur shadow-lg">
          <Button variant="ghost" onClick={handleDescartar} disabled={mutate.isPending}>
            Descartar
          </Button>
          <Button onClick={handleGuardar} disabled={mutate.isPending}>
            {mutate.isPending ? (
              <>
                <Spinner size="sm" /> Guardando…
              </>
            ) : (
              <>
                <Save size={16} /> Guardar cambios
              </>
            )}
          </Button>
        </div>
      )}

      <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center">
        Versión actual: <span className="font-mono">v{cfg.version}</span> · Cambios auditados (CONFIGURACION).
      </p>
    </div>
  );
}
