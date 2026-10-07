import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { CondicionPistaDTO, CreateCondicionPistaPayload } from '@parapente/shared';
import { toast } from 'sonner';

// Cooldown de 5 minutos para el refresco manual del pronóstico Open-Meteo (anti-abuse).
const COOLDOWN_PRONOSTICO_MS = 5 * 60 * 1000;
// Variable module-level: persiste el último refresco entre instancias del hook (misma sesión).
let ultimoRefrescoOpenMeteoTs: number | null = null;

export function useMeteorologia() {
  const queryClient = useQueryClient();

  // Pilar 5.1: datos en caché TanStack — el SSE invalida ['meteorologia', ...]
  // y el poll de 60s se mantiene como fallback (refetchInterval).
  const estadoQuery = useQuery<CondicionPistaDTO | null>({
    queryKey: ['meteorologia', 'estado-actual'],
    queryFn: async () => {
      const res = await api.meteorologia.obtenerActual();
      return (res as CondicionPistaDTO | null) ?? null;
    },
    refetchInterval: 60_000,
  });
  const historialQuery = useQuery<CondicionPistaDTO[]>({
    queryKey: ['meteorologia', 'historial'],
    queryFn: async () => {
      const res = await api.meteorologia.obtenerHistorial(25);
      return Array.isArray(res) ? res : ((res as { data?: CondicionPistaDTO[] })?.data ?? []);
    },
    refetchInterval: 60_000,
  });

  // Pronóstico Open-Meteo en vivo: se refresca cada 15 min (igual que el sampler backend).
  const pronosticoQuery = useQuery<CreateCondicionPistaPayload | null>({
    queryKey: ['meteorologia', 'pronostico-openmeteo'],
    queryFn: async () => {
      const res = await api.meteorologia.pronosticoOpenMeteo();
      return (res as CreateCondicionPistaPayload) ?? null;
    },
    refetchInterval: 15 * 60 * 1000,
    staleTime: 10 * 60 * 1000,
  });

  const estadoActual = estadoQuery.data ?? null;
  const historial = historialQuery.data ?? [];
  const loading = estadoQuery.isPending || historialQuery.isPending;
  const error = (estadoQuery.error ?? historialQuery.error) as Error | null;
  const refetch = () => {
    estadoQuery.refetch();
    historialQuery.refetch();
  };

  // Timestamp del próximo refresco permitido (cooldown). Reactivo vía estado.
  const [proximoRefrescoTs, setProximoRefrescoTs] = useState<number | null>(
    ultimoRefrescoOpenMeteoTs ? ultimoRefrescoOpenMeteoTs + COOLDOWN_PRONOSTICO_MS : null,
  );

  const pronostico = pronosticoQuery.data ?? null;
  const pronosticoLoading = pronosticoQuery.isPending;
  const refrescando = pronosticoQuery.isFetching;

  // Refresco manual del pronóstico Open-Meteo con cooldown de 5 min anti-abuse.
  const refrescarOpenMeteo = async () => {
    const ahora = Date.now();
    if (ultimoRefrescoOpenMeteoTs !== null && ahora - ultimoRefrescoOpenMeteoTs < COOLDOWN_PRONOSTICO_MS) {
      const restanteMin = Math.ceil((COOLDOWN_PRONOSTICO_MS - (ahora - ultimoRefrescoOpenMeteoTs)) / 60_000);
      toast.error(`Debes esperar ${restanteMin} min entre refrescos del pronóstico`);
      return;
    }
    try {
      await api.meteorologia.refrescarOpenMeteo();
      ultimoRefrescoOpenMeteoTs = Date.now();
      setProximoRefrescoTs(ultimoRefrescoOpenMeteoTs + COOLDOWN_PRONOSTICO_MS);
      queryClient.invalidateQueries({ queryKey: ['meteorologia'] });
      toast.success('Pronóstico Open-Meteo actualizado');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Error al actualizar el pronóstico Open-Meteo';
      toast.error(msg);
    }
  };

  const registrarCondicion = async (data: CreateCondicionPistaPayload) => {
    try {
      const res = await api.meteorologia.registrar(data);
      toast.success(`Estado de pista actualizado a: ${data.estadoPista}`);
      queryClient.invalidateQueries({ queryKey: ['meteorologia'] });
      return res;
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Error al actualizar estado de pista';
      toast.error(msg);
      throw err;
    }
  };

  return {
    estadoActual,
    historial,
    loading,
    error,
    refetch,
    registrarCondicion,
    pronostico,
    pronosticoLoading,
    refrescarOpenMeteo,
    refrescando,
    proximoRefrescoTs,
  };
}