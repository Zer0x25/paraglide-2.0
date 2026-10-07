import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiRaw as api } from '../../services/api';
import { copyTextToClipboard } from '../../utils/clipboard';
import type { SyncInfo } from './types';

export function useSyncCalendar(isOpen: boolean) {
  const [selectedTarget, setSelectedTarget] = useState<'universal' | number>('universal');
  const [copied, setCopied] = useState(false);
  const [customBaseUrl, setCustomBaseUrl] = useState('');
  const [isReconciling, setIsReconciling] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // TanStack Query (ADR 010): la info de sincronización se consulta al abrir el
  // modal y se mantiene fresca por refetch en cada apertura.
  const syncQuery = useQuery<SyncInfo | null>({
    queryKey: ['calendar', 'sync-info'],
    enabled: isOpen,
    staleTime: 0,
    retry: false,
    queryFn: async () => {
      const res = (await api.get('/calendar/sync-info')) as unknown as Record<string, unknown>;
      return res && typeof res === 'object' && 'universal' in res
        ? (res as unknown as SyncInfo)
        : ((res as { data?: SyncInfo })?.data ?? null);
    },
  });
  const syncInfo = syncQuery.data ?? null;
  const loading = syncQuery.isFetching && isOpen;

  // Nunca fabricar un token de ejemplo ante el error: un feed falso enmascara el
  // fallo real (401/500/red) y el usuario cree que la suscripción funciona.
  useEffect(() => {
    if (syncQuery.isError) {
      console.error('Error cargando información de sincronización:', syncQuery.error);
      toast.error('No se pudo cargar la información de sincronización. Revisa tu conexión e inténtalo de nuevo.');
    }
  }, [syncQuery.isError, syncQuery.error]);

  /* eslint-disable react-hooks/set-state-in-effect -- lectura de window.location al abrir el modal */
  useEffect(() => {
    if (isOpen && typeof window !== 'undefined') {
      setCustomBaseUrl(window.location.origin);
    }
  }, [isOpen]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Determinar token y path según el target seleccionado
  let activeToken = syncInfo?.universal.token || '';
  let activeExpiraEn = syncInfo?.universal.expiraEn || '';
  let currentTargetName = 'Toda la Operación (Admin)';

  if (selectedTarget !== 'universal' && syncInfo?.pilotos) {
    const selectedPiloto = syncInfo.pilotos.find((p) => p.id === selectedTarget);
    if (selectedPiloto) {
      activeToken = selectedPiloto.token;
      activeExpiraEn = selectedPiloto.expiraEn || '';
      currentTargetName = `Piloto: ${selectedPiloto.nombre}`;
    }
  }

  // Construir las URLs finales dinámicas
  const effectiveBase = customBaseUrl.trim().replace(/\/+$/, '');
  const finalHttpUrl = `${effectiveBase}/api/public/calendar/feed.ics?token=${activeToken}`;
  const finalWebcalUrl = finalHttpUrl.replace(/^https?:\/\//i, 'webcal://');

  const handleCopyUrl = async () => {
    const ok = await copyTextToClipboard(finalHttpUrl);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      toast.success('¡Enlace de calendario copiado al portapapeles! 📋');
    } else {
      toast.error('No se pudo copiar automáticamente.');
    }
  };

  // 2a: regenerar el enlace rota el token del ámbito seleccionado; los
  // enlaces anteriores (incluidas suscripciones activas) dejan de funcionar.
  const handleRegenerateToken = async () => {
    try {
      setIsRegenerating(true);
      const scope = selectedTarget === 'universal' ? 'all' : 'piloto';
      const pilotoId = selectedTarget === 'universal' ? undefined : selectedTarget;
      await api.post('/calendar/feed-token/regenerate', { scope, pilotoId });
      toast.success('Enlace regenerado. Los enlaces anteriores dejaron de funcionar.');
      await syncQuery.refetch();
    } catch (err: unknown) {
      console.error('Error regenerando el enlace de suscripción:', err);
      toast.error('No se pudo regenerar el enlace. Inténtalo de nuevo.');
    } finally {
      setIsRegenerating(false);
    }
  };

  const isOneClickGoogle =
    selectedTarget === 'universal' &&
    Boolean(syncInfo?.googleCalendar?.enabled && syncInfo?.googleCalendar?.oneClickSubscribeUrl);

  const handleGoogleCalendarFlow = async () => {
    if (isOneClickGoogle && syncInfo?.googleCalendar?.oneClickSubscribeUrl) {
      toast.success('Abriendo Google Calendar para añadir el calendario oficial 🚀');
      window.open(syncInfo.googleCalendar.oneClickSubscribeUrl, '_blank');
      return;
    }

    await copyTextToClipboard(finalHttpUrl);
    toast.success('Enlace copiado al portapapeles. Abriendo Google Calendar...');
    window.open('https://calendar.google.com/calendar/u/0/r/settings/addbyurl', '_blank');
  };

  const handleReconcileGoogleCalendar = async () => {
    try {
      setIsReconciling(true);
      const res = (await api.post('/calendar/reconcile', {})) as {
        success?: boolean;
        message?: string;
        data?: { creados: number; actualizados: number; eliminados: number; total: number; fallidos: number };
      };
      const stats = res?.data;
      if (stats) {
        toast.success(
          `Sincronización completada: ${stats.creados} creados, ${stats.actualizados} actualizados, ${stats.eliminados} eliminados (${stats.total} evaluados).`
        );
      } else {
        toast.success(res?.message || 'Sincronización con Google Calendar completada exitosamente.');
      }
    } catch (err: unknown) {
      console.error('Error forzando sincronización:', err);
      toast.error('Ocurrió un error al forzar la sincronización con Google Calendar.');
    } finally {
      setIsReconciling(false);
    }
  };

  const handleDownloadIcs = () => {
    if (!finalHttpUrl) return;
    window.open(finalHttpUrl, '_blank');
    toast.success('Descargando archivo .ics de calendario');
  };

  return {
    syncInfo,
    loading,
    selectedTarget,
    setSelectedTarget,
    copied,
    currentTargetName,
    finalHttpUrl,
    finalWebcalUrl,
    activeExpiraEn,
    isOneClickGoogle,
    isReconciling,
    isRegenerating,
    handleCopyUrl,
    handleRegenerateToken,
    handleGoogleCalendarFlow,
    handleReconcileGoogleCalendar,
    handleDownloadIcs,
  };
}
