import axios from 'axios';
import Cookies from 'js-cookie';
import { enqueue } from '@/services/outbox/outbox.service';
import type { OutboxMetodo } from '@/services/outbox/types';
import { uuid } from '@/utils/uuid';
import { isPublicPath } from '@/utils/publicPaths';
import { reportNetworkError, reportNetworkSuccess } from '@/hooks/useOnlineStatus';

function safeParse(data: unknown): unknown {
  if (typeof data !== 'string') return data;
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add the auth token
// Generate session trace id (16 bytes hex = 32 chars).
// uuid() no depende de contexto seguro (crypto.randomUUID falta por IP LAN http).
const sessionTraceId = uuid().replace(/-/g, '');

// Incrementing span id generator
let spanCounter = 1;
function generateSpanId() {
  return spanCounter.toString(16).padStart(16, '0');
}

api.interceptors.request.use(
  (config) => {
    const token = Cookies.get('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Inject OTel traceparent header (W3C Trace Context)
    // Format: 00-{trace-id}-{span-id}-{trace-flags}
    const spanId = generateSpanId();
    spanCounter++;
    config.headers.traceparent = `00-${sessionTraceId}-${spanId}-01`;
    // Outbox (ADR 009): marcar idempotencia por clientId una sola vez por request
    if (config.headers['X-Outbox'] === '1' && !config.headers['X-Client-Id']) {
      config.headers['X-Client-Id'] = uuid();
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => {
    reportNetworkSuccess();
    return response.data;
  },
  async (error) => {
    if (error.response && error.response.status === 401) {
      const reqUrl = (error.config?.url ?? '') as string;
      const isPublicEndpoint = reqUrl.includes('/public/') || reqUrl.startsWith('/public');

      // Un 401 en un endpoint público corresponde a un enlace o token público expirado o inválido (ej. /public/pantalla).
      // NO revoca la sesión del usuario ni destruye las credenciales de autenticación existentes.
      if (!isPublicEndpoint) {
        // ADR 013: sesión revocada por nuevo login en otro dispositivo.
        // Aviso específico antes del redirect a /login.
        const code = (error.response?.data as { code?: string } | undefined)?.code;
        if (code === 'SESSION_REVOKED' && typeof window !== 'undefined') {
          // sonner ya está cargado en el layout (Toaster); import dinámico para
          // no acoplar el interceptor al ciclo de React.
          import('sonner').then(({ toast }) => {
            toast.error('Tu sesión se cerró porque iniciaste sesión en otro dispositivo.');
          }).catch(() => {});
        }
        Cookies.remove('token');
        if (typeof window !== 'undefined') {
          localStorage.removeItem('user');
          const currentPath = window.location.pathname || '';
          // No forzar redirección si el usuario ya está navegando en una ruta pública
          // Interceptor no-React: redirect imperativo necesario (no hay router disponible).
          if (!isPublicPath(currentPath)) {
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination
            window.location.href = '/login';
          }
        }
      }
    }
    const errorMsg = error.response?.data?.message || error.response?.data || error.message;
    const isNetworkErr =
      error.code === 'ERR_NETWORK' ||
      error.message === 'Network Error' ||
      error.message?.includes('NetworkError') ||
      error.message?.includes('Failed to fetch') ||
      (!error.response && Boolean(error.request));

    if (isNetworkErr) {
      reportNetworkError();
      if (process.env.NODE_ENV !== 'test' && (typeof navigator === 'undefined' || navigator.onLine)) {
        console.error('API Error: No se pudo conectar con el servidor backend (Network Error). Asegúrate de que el servidor de la API (Fastify) esté corriendo en el puerto 3001.');
      }
      // Outbox (ADR 009): encolar mutaciones marcadas para offline
      const outboxHeader = error.config?.headers?.['X-Outbox'];
      if (outboxHeader === '1') {
        const url = (error.config?.url ?? '') as string;
        const entidad = url.replace(/^\//, '').split('/')[0] || 'desconocida';
        const clientIdPrimerIntento = error.config?.headers?.['X-Client-Id'];
        const tempIdHeader = error.config?.headers?.['X-Temp-Id'];
        await enqueue(
          {
            entidad,
            metodo: (error.config?.method ?? 'POST') as OutboxMetodo,
            url,
            payload: error.config?.data ? safeParse(error.config.data) : undefined,
            versionEsperada: error.config?.headers?.['X-Version'],
            tempId: tempIdHeader ? (Number(tempIdHeader) || tempIdHeader) : undefined,
          },
          // ADR 009: reutilizar el X-Client-Id del primer intento para que el
          // servidor reconozca el replay como la misma operación (dedupe).
          // Guard estricto: solo uuid no vacío (una clave '' rompería IndexedDB).
          {
            id:
              typeof clientIdPrimerIntento === 'string' && clientIdPrimerIntento.length >= 8
                ? clientIdPrimerIntento
                : undefined,
          },
        );
        (error as { queued?: boolean }).queued = true;
      }
    } else {
      if (process.env.NODE_ENV !== 'test') {
        console.error('API Error:', errorMsg);
      }
    }
    return Promise.reject(error);
  }
);

export const apiRaw = api;

import type { AppApiContract } from '@parapente/shared';

/**
 * Contrato de listados (ADR 005): los endpoints de colección responden
 * { data, pagination }. Acepta también arreglo (compat con mocks/tests).
 * @deprecated Usa `typedApi` en lugar de `apiRaw.get` y ya no necesitarás este utilitario.
 */
export function unwrapList<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[];
  const envelope = res as { data?: T[] } | null;
  return envelope?.data ?? [];
}

const typedApi: AppApiContract = {
  vuelos: {
    listar: (query) => apiRaw.get('/vuelos', { params: query }),
    crear: (payload) => apiRaw.post('/vuelos', payload),
    actualizar: (id, payload) => apiRaw.put(`/vuelos/${id}`, payload),
    eliminar: (id) => apiRaw.delete(`/vuelos/${id}`),
    actualizarEstado: (id, payload) => apiRaw.patch(`/vuelos/${id}/estado`, payload),
    agendarGrupo: (payload) => apiRaw.post('/vuelos/agendamiento-grupo', payload),
    asignacionAutomatica: (payload) => apiRaw.post('/vuelos/asignacion-automatica', payload),
  },
  reservas: {
    listar: (query) => apiRaw.get('/reservas', { params: query }),
    obtener: (id) => apiRaw.get(`/reservas/${id}`),
    crear: (payload) => apiRaw.post('/reservas', payload),
    actualizar: (id, payload) => apiRaw.patch(`/reservas/${id}`, payload),
    eliminar: (id) => apiRaw.delete(`/reservas/${id}`),
    agregarPago: (id, payload) => apiRaw.post(`/reservas/${id}/pagos`, payload),
    eliminarPago: (id, pagoId, version) => apiRaw.delete(`/reservas/${id}/pagos/${pagoId}`, { params: { version } }),
    // Fase 2: devoluciones (solo reservas CANCELADA/INCOMPLETA; no se puede
    // devolver más de lo pagado). Ambas devuelven ReservaDTO con version fresca.
    crearDevolucion: (id, payload) => apiRaw.post(`/reservas/${id}/devoluciones`, payload),
    eliminarDevolucion: (id, devolucionId, version) => apiRaw.delete(`/reservas/${id}/devoluciones/${devolucionId}`, { params: { version } }),
    actualizarEstadoPasajeros: (id, payload) => apiRaw.put(`/reservas/${id}/estado-pasajeros`, payload),
    cancelar: (id, payload) => apiRaw.post(`/reservas/${id}/cancelar`, payload),
    desagendar: (id, payload) => apiRaw.post(`/reservas/${id}/desagendar`, payload),
    // Fase 2: cálculo server-side de valor con tarifa/promoción
    calcularValor: (payload) => apiRaw.post('/reservas/calcular-valor', payload),
    cerrar: (id, payload) => apiRaw.post(`/reservas/${id}/cerrar`, payload),
    reabrir: (id, payload) => apiRaw.post(`/reservas/${id}/reabrir`, payload),
  },
  pilotos: {
    listar: (query) => apiRaw.get('/pilotos', { params: query }),
    crear: (payload) => apiRaw.post('/pilotos', payload),
    actualizar: (id, payload) => apiRaw.patch(`/pilotos/${id}`, payload),
    eliminar: (id) => apiRaw.delete(`/pilotos/${id}`),
    obtenerDisponibilidad: (id) => apiRaw.get(`/pilotos/${id}/disponibilidad`),
    guardarDisponibilidad: (id, payload) => apiRaw.put(`/pilotos/${id}/disponibilidad`, payload),
    resetDisponibilidad: (id, q) => apiRaw.delete(`/pilotos/${id}/disponibilidad/reset`, { params: q }),
    sugerir: (payload) => apiRaw.post('/pilotos/sugerir', payload),
  },
  equipos: {
    listar: (query) => apiRaw.get('/equipos', { params: query }),
    obtener: (id) => apiRaw.get(`/equipos/${id}`),
    crear: (payload) => apiRaw.post('/equipos', payload),
    actualizar: (id, payload) => apiRaw.put(`/equipos/${id}`, payload),
    eliminar: (id) => apiRaw.delete(`/equipos/${id}`),
    agregarMantenimiento: (id, payload) => apiRaw.post(`/equipos/${id}/mantenimientos`, payload),
    eliminarMantenimiento: (id, mantenimientoId) => apiRaw.delete(`/equipos/${id}/mantenimientos/${mantenimientoId}`),
  },
  gastos: {
    listar: (query) => apiRaw.get('/gastos', { params: query }),
    crear: (payload) => apiRaw.post('/gastos', payload),
    eliminar: (id, version) => apiRaw.delete(`/gastos/${id}`, { params: { version } }),
  },
  meteorologia: {
    obtenerActual: () => apiRaw.get('/meteorologia/estado-actual'),
    obtenerHistorial: (limit) => apiRaw.get('/meteorologia/historial', { params: { limit } }),
    registrar: (payload) => apiRaw.post('/meteorologia/registro', payload),
    pronosticoOpenMeteo: () => apiRaw.get('/meteorologia/pronostico-openmeteo'),
    refrescarOpenMeteo: () => apiRaw.post('/meteorologia/refrescar-openmeteo'),
  },
  configuracion: {
    listar: () => apiRaw.get('/configuracion-bloques'),
    crear: (payload) => apiRaw.post('/configuracion-bloques', payload),
    actualizar: (id, payload) => apiRaw.patch(`/configuracion-bloques/${id}`, payload),
    eliminar: (id) => apiRaw.delete(`/configuracion-bloques/${id}`),
    // Fase 2: resolución server-side de días y archivado de reglas expiradas
    resolver: (q) => apiRaw.get('/configuracion-bloques/resolver', { params: q }),
    limpiarExpiradas: () => apiRaw.post('/configuracion-bloques/limpiar-expiradas'),
  },
  pasajeros: {
    listar: (query) => apiRaw.get('/pasajeros', { params: query }),
  },
  plantillas: {
    listar: (query) => apiRaw.get('/plantillas', { params: query }),
    crear: (payload) => apiRaw.post('/plantillas', payload),
    actualizar: (id, payload) => apiRaw.put(`/plantillas/${id}`, payload),
    eliminar: (id) => apiRaw.delete(`/plantillas/${id}`),
    renderizar: (payload) => apiRaw.post('/plantillas/render', payload),
  },
  auditoria: {
    listar: (query) => apiRaw.get('/auditoria', { params: query }),
  },
  tarifas: {
    listar: (query) => apiRaw.get('/tarifas', { params: query }),
    crear: (payload) => apiRaw.post('/tarifas', payload),
    actualizar: (id, payload) => apiRaw.put(`/tarifas/${id}`, payload),
    eliminar: (id) => apiRaw.delete(`/tarifas/${id}`),
  },
  promociones: {
    listar: (query) => apiRaw.get('/promociones', { params: query }),
    crear: (payload) => apiRaw.post('/promociones', payload),
    actualizar: (id, payload) => apiRaw.put(`/promociones/${id}`, payload),
    eliminar: (id) => apiRaw.delete(`/promociones/${id}`),
  },
  faqs: {
    listar: (query) => apiRaw.get('/faqs', { params: query }),
    crear: (payload) => apiRaw.post('/faqs', payload),
    actualizar: (id, payload) => apiRaw.put(`/faqs/${id}`, payload),
    eliminar: (id) => apiRaw.delete(`/faqs/${id}`),
  },
  deslindes: {
    listar: () => apiRaw.get('/deslindes'),
    crear: (payload) => apiRaw.post('/deslindes', payload),
    actualizar: (id, payload) => apiRaw.put(`/deslindes/${id}`, payload),
    eliminar: (id) => apiRaw.delete(`/deslindes/${id}`),
    activar: (id, payload) => apiRaw.post(`/deslindes/${id}/activar`, payload),
  },
  reglasOperativas: {
    listar: () => apiRaw.get('/reglas-operativas'),
    upsert: (clave, payload) => apiRaw.put(`/reglas-operativas/${encodeURIComponent(clave)}`, payload),
    eliminar: (clave) => apiRaw.delete(`/reglas-operativas/${encodeURIComponent(clave)}`),
  },
  public: {
    deslindeActivo: () => apiRaw.get('/public/deslinde-activo'),
    faqsPublicas: () => apiRaw.get('/public/faqs'),
    reglasOperativas: () => apiRaw.get('/public/reglas-operativas'),
  },
  notificaciones: {
    obtenerConfig: () => apiRaw.get('/notificaciones/config'),
    actualizarConfig: (payload: Record<string, unknown>) => apiRaw.put('/notificaciones/config', payload),
    pendientes: (query?: Record<string, unknown>) => apiRaw.get('/notificaciones/pendientes', { params: query }),
  },
  empresa: {
    obtenerPublico: () => apiRaw.get('/public/empresa'),
    obtener: () => apiRaw.get('/empresa'),
    actualizar: (payload, version) => apiRaw.put('/empresa', { ...payload, version }),
  },
  dashboard: {
    stats: () => apiRaw.get('/dashboard/stats'),
  },
  users: {
    listar: (query?: Record<string, unknown>) => apiRaw.get('/users', { params: query }),
    obtener: (id: number) => apiRaw.get(`/users/${id}`),
    crear: (payload: Record<string, unknown>) => apiRaw.post('/users', payload),
    actualizar: (id: number, payload: Record<string, unknown>) => apiRaw.put(`/users/${id}`, payload),
    eliminar: (id: number) => apiRaw.delete(`/users/${id}`),
    cambiarPassword: (id: number, payload: Record<string, unknown>) => apiRaw.post(`/users/${id}/cambiar-password`, payload),
  }
};

export default typedApi;
