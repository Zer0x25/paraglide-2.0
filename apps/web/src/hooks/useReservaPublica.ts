'use client';

import { useQuery } from '@tanstack/react-query';

interface UseReservaPublicaOptions {
  /** Mensaje que ve el usuario si el backend no envía `message`. */
  mensajeError?: string;
}

/** Extrae `message` del error estilo axios (mismo código que usaba el voucher). */
function mensajeDeError(err: unknown): string | undefined {
  const msg =
    err !== null && typeof err === 'object' && 'response' in err
      ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
      : undefined;
  return typeof msg === 'string' ? msg : undefined;
}

/**
 * Reserva pública de `/public/reservas/:id` (voucher y deslinde comparten la
 * misma fuente de datos). La clave ['reserva-publica', id] es única para que la
 * firma de un pasajero se refleje invalidando esa caché desde el deslinde.
 *
 * Import dinámico de services/api dentro del queryFn: mismo patrón que
 * useEmpresaPublico (hay tests con automock de axios sin factory y un import
 * estático a nivel de módulo rompería su evaluación).
 */
export function useReservaPublica<TReserva>(
  reservaId: string | null | undefined,
  opciones?: UseReservaPublicaOptions
) {
  const query = useQuery<TReserva>({
    queryKey: ['reserva-publica', reservaId],
    queryFn: async () => {
      const { apiRaw } = await import('@/services/api');
      const res = await apiRaw.get(`/public/reservas/${reservaId}`);
      // El interceptor de api unwrappea response.data, pero hay tests que
      // mockean axios sin interceptores y devuelve { data } (patrón useMeteorologia).
      return ((res as { data?: TReserva })?.data ?? res) as TReserva;
    },
    enabled: !!reservaId,
    retry: false,
  });

  return {
    data: query.data ?? null,
    isLoading: query.isPending,
    error: query.error
      ? mensajeDeError(query.error) ??
        opciones?.mensajeError ??
        'No se pudo cargar la información de la reserva.'
      : null,
  };
}
