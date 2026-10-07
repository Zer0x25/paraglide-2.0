import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Cookies from 'js-cookie';
import { QUERY_KEY_POR_ENTIDAD, type SSEDatosCambiosEvent, type Entidad } from '@parapente/shared';
import { applyModulesChange } from '@/modules/runtime';
import { reportNetworkSuccess, reportNetworkError } from '@/hooks/useOnlineStatus';
import { replayIfIdle } from '@/services/outbox/outbox.service';
import { apiRaw } from '@/services/api';
import { useAuthStore } from '@/store/authStore';

// Pilar 6: revalidación quirúrgica tipada — usa los tipos de @parapente/shared
// en vez de un Record<string,string> local. El mapa entidad→queryKey es la
// fuente de verdad compartida con el API.

const CASCADA_INVALIDACION: Partial<Record<Entidad, string[]>> = {
  vuelo: ['vuelos', 'reservas', 'pilotos', 'dashboard'],
  reserva: ['reservas', 'vuelos', 'dashboard'],
  piloto: ['pilotos', 'vuelos'],
  pasajero: ['pasajeros', 'reservas', 'vuelos'],
  'configuracion-bloques': ['configuracion-bloques', 'configuracion-resolucion', 'vuelos', 'pilotos'],
  tarifa: ['tarifas', 'reservas'],
  promocion: ['promociones', 'reservas'],
  'regla-operativa': ['reglas-operativas', 'reservas'],
};

// Reconexión con backoff exponencial (3s → 30s). Cada reconexión canjea un
// ticket SSE nuevo porque los tickets son de un solo uso (hallazgo 2b).
const REINTENTO_BASE_MS = 3_000;
const REINTENTO_MAX_MS = 30_000;

interface SseTicketRespuesta {
  ticket?: string;
  data?: { ticket?: string };
}

export function useDatosStream(onEvent?: (entidad: string) => void) {
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.token) || (typeof window !== 'undefined' ? Cookies.get('token') : null);
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!token || typeof window === 'undefined' || !('EventSource' in window)) return;

    let cancelado = false;
    let es: EventSource | null = null;
    let temporizador: ReturnType<typeof setTimeout> | null = null;
    let intentos = 0;

    const programarReconexion = () => {
      if (cancelado || temporizador) return;
      intentos += 1;
      const espera = Math.min(REINTENTO_BASE_MS * 2 ** (intentos - 1), REINTENTO_MAX_MS);
      temporizador = setTimeout(() => {
        temporizador = null;
        void conectar();
      }, espera);
    };

    const conectar = async () => {
      if (cancelado) return;

      let ticket: string | undefined;
      try {
        // El JWT viaja solo en el header Authorization de este canje; la URL
        // del EventSource lleva únicamente el ticket de un solo uso (2b).
        const res = (await apiRaw.post('/eventos/ticket')) as SseTicketRespuesta | null | undefined;
        ticket = res?.ticket ?? res?.data?.ticket;
      } catch {
        programarReconexion();
        return;
      }
      if (cancelado) return;

      // Respuesta sin ticket (p. ej. mocks de E2E): el stream no está
      // disponible en este entorno; no reintentar en bucle.
      if (!ticket) return;

      es = new EventSource(`/api/eventos?ticket=${encodeURIComponent(ticket)}`);

      es.onopen = () => {
        intentos = 0;
        reportNetworkSuccess();
        replayIfIdle(apiRaw).catch(() => {});
      };

      es.onerror = () => {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          reportNetworkError();
        }
        // El ticket ya fue consumido: cerrar y reconectar con uno nuevo.
        es?.close();
        es = null;
        programarReconexion();
      };

      const handler = (ev: MessageEvent) => {
        let parsed: SSEDatosCambiosEvent | null = null;
        try {
          parsed = JSON.parse(ev.data) as SSEDatosCambiosEvent;
        } catch {
          // Malformed payload — invalidate everything as safety net
          queryClient.invalidateQueries();
          return;
        }

        const entidad = parsed?.entidad ?? '';
        const prefix = QUERY_KEY_POR_ENTIDAD[entidad as Entidad];
        const claves = CASCADA_INVALIDACION[entidad as Entidad] || (prefix ? [prefix] : []);

        if (claves.length > 0) {
          for (const k of claves) {
            queryClient.invalidateQueries({ queryKey: [k] });
          }
        } else {
          // Unknown entity — invalidate everything
          queryClient.invalidateQueries();
        }
        onEventRef.current?.(entidad);
      };
      es.addEventListener('datos-cambios', handler);

      // Handle modulos-cambios
      const modulosHandler = (ev: MessageEvent) => {
        try {
          const data = JSON.parse(ev.data);
          if (data?.enabled) {
            applyModulesChange(data.enabled);
            queryClient.invalidateQueries({ queryKey: ['modules'] });
          }
        } catch {
          // ignore
        }
      };
      es.addEventListener('modulos-cambios', modulosHandler);
    };

    void conectar();

    return () => {
      cancelado = true;
      if (temporizador) clearTimeout(temporizador);
      es?.close();
      es = null;
    };
  }, [queryClient, token]);
}
