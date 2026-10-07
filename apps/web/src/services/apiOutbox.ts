/**
 * Cliente tipado con soporte outbox (ADR 009).
 *
 * Clon de `typedApi` donde los métodos de MUTACIÓN aceptan un último
 * argumento opcional `config?: { headers?: Record<string,string> }` y
 * fusionan esos headers con `withOutboxHeaders()` (header `X-Outbox: '1'`).
 * El interceptor de `services/api.ts` detecta ese header, genera el
 * `X-Client-Id` idempotente y, ante `ERR_NETWORK`, encola la operación en
 * el outbox para reenvío posterior.
 *
 * Los métodos de LECTURA se delegan tal cual a `typedApi` (nunca se
 * encolan lecturas).
 *
 * Uso típico desde un `mutationFn`:
 *
 *   mutationFn: (payload) => typedApiOutbox.reservas.crear(payload)
 *   // o con headers extra:
 *   typedApiOutbox.reservas.crear(payload, { headers: { 'Idempotency-Key': k } })
 */
import type { AppApiContract } from '@parapente/shared';
import typedApi, { apiRaw } from './api';
import { withOutboxHeaders } from './apiWithOutbox';

/** Config opcional que aceptan los métodos de mutación como último argumento. */
export interface OutboxRequestConfig {
  headers?: Record<string, string>;
}

/**
 * Añade un último parámetro opcional `config` a la firma de un método de
 * mutación preservando argumentos y tipo de retorno.
 */
type WithConfig<T> = T extends (...args: infer A) => Promise<infer R>
  ? (...args: [...A, config?: OutboxRequestConfig]) => Promise<R>
  : T;

/** Métodos de solo lectura: se delegan sin config (nunca van al outbox). */
type MetodoLectura =
  | 'listar'
  | 'obtener'
  | 'obtenerDisponibilidad'
  | 'obtenerActual'
  | 'obtenerHistorial'
  | 'pronosticoOpenMeteo'
  | 'resolver'
  | 'deslindeActivo'
  | 'faqsPublicas'
  | 'reglasOperativas'
  | 'obtenerPublico'
  | 'obtenerConfig'
  | 'pendientes';

export type AppApiContractOutbox = {
  [K in keyof AppApiContract]: {
    [M in keyof AppApiContract[K]]: M extends MetodoLectura
      ? AppApiContract[K][M]
      : WithConfig<AppApiContract[K][M]>;
  };
};

export const typedApiOutbox: AppApiContractOutbox = {
  vuelos: {
    listar: typedApi.vuelos.listar,
    crear: (payload, config) =>
      apiRaw.post('/vuelos', payload, { headers: withOutboxHeaders(config?.headers) }),
    actualizar: (id, payload, config) =>
      apiRaw.put(`/vuelos/${id}`, payload, { headers: withOutboxHeaders(config?.headers) }),
    eliminar: (id, config) =>
      apiRaw.delete(`/vuelos/${id}`, { headers: withOutboxHeaders(config?.headers) }),
    actualizarEstado: (id, payload, config) =>
      apiRaw.patch(`/vuelos/${id}/estado`, payload, { headers: withOutboxHeaders(config?.headers) }),
    agendarGrupo: (payload, config) =>
      apiRaw.post('/vuelos/agendamiento-grupo', payload, { headers: withOutboxHeaders(config?.headers) }),
    asignacionAutomatica: (payload, config) =>
      apiRaw.post('/vuelos/asignacion-automatica', payload, { headers: withOutboxHeaders(config?.headers) }),
  },
  reservas: {
    listar: typedApi.reservas.listar,
    obtener: typedApi.reservas.obtener,
    crear: (payload, config) =>
      apiRaw.post('/reservas', payload, { headers: withOutboxHeaders(config?.headers) }),
    actualizar: (id, payload, config) =>
      apiRaw.patch(`/reservas/${id}`, payload, { headers: withOutboxHeaders(config?.headers) }),
    eliminar: (id, config) =>
      apiRaw.delete(`/reservas/${id}`, { headers: withOutboxHeaders(config?.headers) }),
    agregarPago: (id, payload, config) =>
      apiRaw.post(`/reservas/${id}/pagos`, payload, { headers: withOutboxHeaders(config?.headers) }),
    eliminarPago: (id, pagoId, version, config) =>
      apiRaw.delete(`/reservas/${id}/pagos/${pagoId}`, {
        params: { version },
        headers: withOutboxHeaders(config?.headers),
      }),
    crearDevolucion: (id, payload, config) =>
      apiRaw.post(`/reservas/${id}/devoluciones`, payload, { headers: withOutboxHeaders(config?.headers) }),
    eliminarDevolucion: (id, devolucionId, version, config) =>
      apiRaw.delete(`/reservas/${id}/devoluciones/${devolucionId}`, {
        params: { version },
        headers: withOutboxHeaders(config?.headers),
      }),
    actualizarEstadoPasajeros: (id, payload, config) =>
      apiRaw.put(`/reservas/${id}/estado-pasajeros`, payload, { headers: withOutboxHeaders(config?.headers) }),
    cancelar: (id, payload, config) =>
      apiRaw.post(`/reservas/${id}/cancelar`, payload, { headers: withOutboxHeaders(config?.headers) }),
    desagendar: (id, payload, config) =>
      apiRaw.post(`/reservas/${id}/desagendar`, payload, { headers: withOutboxHeaders(config?.headers) }),
    calcularValor: (payload, config) =>
      apiRaw.post('/reservas/calcular-valor', payload, { headers: withOutboxHeaders(config?.headers) }),
    cerrar: (id, payload, config) =>
      apiRaw.post(`/reservas/${id}/cerrar`, payload, { headers: withOutboxHeaders(config?.headers) }),
    reabrir: (id, payload, config) =>
      apiRaw.post(`/reservas/${id}/reabrir`, payload, { headers: withOutboxHeaders(config?.headers) }),
  },
  pilotos: {
    listar: typedApi.pilotos.listar,
    crear: (payload, config) =>
      apiRaw.post('/pilotos', payload, { headers: withOutboxHeaders(config?.headers) }),
    actualizar: (id, payload, config) =>
      apiRaw.patch(`/pilotos/${id}`, payload, { headers: withOutboxHeaders(config?.headers) }),
    eliminar: (id, config) =>
      apiRaw.delete(`/pilotos/${id}`, { headers: withOutboxHeaders(config?.headers) }),
    obtenerDisponibilidad: typedApi.pilotos.obtenerDisponibilidad,
    guardarDisponibilidad: (id, payload, config) =>
      apiRaw.put(`/pilotos/${id}/disponibilidad`, payload, { headers: withOutboxHeaders(config?.headers) }),
    resetDisponibilidad: (id, q?: { desde?: string; hasta?: string }, config?: OutboxRequestConfig) =>
      apiRaw.delete(`/pilotos/${id}/disponibilidad/reset`, { params: q, headers: withOutboxHeaders(config?.headers) }),
    sugerir: (payload, config) =>
      apiRaw.post('/pilotos/sugerir', payload, { headers: withOutboxHeaders(config?.headers) }),
  },
  equipos: {
    listar: typedApi.equipos.listar,
    obtener: typedApi.equipos.obtener,
    crear: (payload, config) =>
      apiRaw.post('/equipos', payload, { headers: withOutboxHeaders(config?.headers) }),
    actualizar: (id, payload, config) =>
      apiRaw.put(`/equipos/${id}`, payload, { headers: withOutboxHeaders(config?.headers) }),
    eliminar: (id, config) =>
      apiRaw.delete(`/equipos/${id}`, { headers: withOutboxHeaders(config?.headers) }),
    agregarMantenimiento: (id, payload, config) =>
      apiRaw.post(`/equipos/${id}/mantenimientos`, payload, { headers: withOutboxHeaders(config?.headers) }),
    eliminarMantenimiento: (id, mantenimientoId, config) =>
      apiRaw.delete(`/equipos/${id}/mantenimientos/${mantenimientoId}`, {
        headers: withOutboxHeaders(config?.headers),
      }),
  },
  gastos: {
    listar: typedApi.gastos.listar,
    crear: (payload, config) =>
      apiRaw.post('/gastos', payload, { headers: withOutboxHeaders(config?.headers) }),
    eliminar: (id, version, config) =>
      apiRaw.delete(`/gastos/${id}`, {
        params: { version },
        headers: withOutboxHeaders(config?.headers),
      }),
  },
  meteorologia: {
    obtenerActual: typedApi.meteorologia.obtenerActual,
    obtenerHistorial: typedApi.meteorologia.obtenerHistorial,
    registrar: (payload, config) =>
      apiRaw.post('/meteorologia/registro', payload, { headers: withOutboxHeaders(config?.headers) }),
    pronosticoOpenMeteo: typedApi.meteorologia.pronosticoOpenMeteo,
    refrescarOpenMeteo: (config?) =>
      apiRaw.post('/meteorologia/refrescar-openmeteo', undefined, {
        headers: withOutboxHeaders(config?.headers),
      }),
  },
  configuracion: {
    listar: typedApi.configuracion.listar,
    crear: (payload, config) =>
      apiRaw.post('/configuracion-bloques', payload, { headers: withOutboxHeaders(config?.headers) }),
    actualizar: (id, payload, config) =>
      apiRaw.patch(`/configuracion-bloques/${id}`, payload, { headers: withOutboxHeaders(config?.headers) }),
    eliminar: (id, config) =>
      apiRaw.delete(`/configuracion-bloques/${id}`, { headers: withOutboxHeaders(config?.headers) }),
    resolver: typedApi.configuracion.resolver,
    limpiarExpiradas: (config?) =>
      apiRaw.post('/configuracion-bloques/limpiar-expiradas', undefined, {
        headers: withOutboxHeaders(config?.headers),
      }),
  },
  pasajeros: {
    listar: typedApi.pasajeros.listar,
  },
  plantillas: {
    listar: typedApi.plantillas.listar,
    crear: (payload, config) =>
      apiRaw.post('/plantillas', payload, { headers: withOutboxHeaders(config?.headers) }),
    actualizar: (id, payload, config) =>
      apiRaw.put(`/plantillas/${id}`, payload, { headers: withOutboxHeaders(config?.headers) }),
    eliminar: (id, config) =>
      apiRaw.delete(`/plantillas/${id}`, { headers: withOutboxHeaders(config?.headers) }),
    renderizar: (payload, config) =>
      apiRaw.post('/plantillas/render', payload, { headers: withOutboxHeaders(config?.headers) }),
  },
  auditoria: {
    listar: typedApi.auditoria.listar,
  },
  tarifas: {
    listar: typedApi.tarifas.listar,
    crear: (payload, config) =>
      apiRaw.post('/tarifas', payload, { headers: withOutboxHeaders(config?.headers) }),
    actualizar: (id, payload, config) =>
      apiRaw.put(`/tarifas/${id}`, payload, { headers: withOutboxHeaders(config?.headers) }),
    eliminar: (id, config) =>
      apiRaw.delete(`/tarifas/${id}`, { headers: withOutboxHeaders(config?.headers) }),
  },
  promociones: {
    listar: typedApi.promociones.listar,
    crear: (payload, config) =>
      apiRaw.post('/promociones', payload, { headers: withOutboxHeaders(config?.headers) }),
    actualizar: (id, payload, config) =>
      apiRaw.put(`/promociones/${id}`, payload, { headers: withOutboxHeaders(config?.headers) }),
    eliminar: (id, config) =>
      apiRaw.delete(`/promociones/${id}`, { headers: withOutboxHeaders(config?.headers) }),
  },
  faqs: {
    listar: typedApi.faqs.listar,
    crear: (payload, config) =>
      apiRaw.post('/faqs', payload, { headers: withOutboxHeaders(config?.headers) }),
    actualizar: (id, payload, config) =>
      apiRaw.put(`/faqs/${id}`, payload, { headers: withOutboxHeaders(config?.headers) }),
    eliminar: (id, config) =>
      apiRaw.delete(`/faqs/${id}`, { headers: withOutboxHeaders(config?.headers) }),
  },
  deslindes: {
    listar: typedApi.deslindes.listar,
    crear: (payload, config) =>
      apiRaw.post('/deslindes', payload, { headers: withOutboxHeaders(config?.headers) }),
    actualizar: (id, payload, config) =>
      apiRaw.put(`/deslindes/${id}`, payload, { headers: withOutboxHeaders(config?.headers) }),
    eliminar: (id, config) =>
      apiRaw.delete(`/deslindes/${id}`, { headers: withOutboxHeaders(config?.headers) }),
    activar: (id, payload, config) =>
      apiRaw.post(`/deslindes/${id}/activar`, payload, { headers: withOutboxHeaders(config?.headers) }),
  },
  reglasOperativas: {
    listar: typedApi.reglasOperativas.listar,
    upsert: (clave, payload, config) =>
      apiRaw.put(`/reglas-operativas/${encodeURIComponent(clave)}`, payload, {
        headers: withOutboxHeaders(config?.headers),
      }),
    eliminar: (clave, config) =>
      apiRaw.delete(`/reglas-operativas/${encodeURIComponent(clave)}`, {
        headers: withOutboxHeaders(config?.headers),
      }),
  },
  public: {
    deslindeActivo: typedApi.public.deslindeActivo,
    faqsPublicas: typedApi.public.faqsPublicas,
    reglasOperativas: typedApi.public.reglasOperativas,
  },
  empresa: {
    obtenerPublico: typedApi.empresa.obtenerPublico,
    obtener: typedApi.empresa.obtener,
    actualizar: (payload, version, config) =>
      apiRaw.put('/empresa', { ...payload, version }, { headers: withOutboxHeaders(config?.headers) }),
  },
  notificaciones: {
    obtenerConfig: (typedApi.notificaciones?.obtenerConfig ??
      (() => apiRaw.get('/notificaciones/config'))) as AppApiContract['notificaciones']['obtenerConfig'],
    actualizarConfig: (payload, config) =>
      apiRaw.put('/notificaciones/config', payload, { headers: withOutboxHeaders(config?.headers) }),
    pendientes: (typedApi.notificaciones?.pendientes ??
      ((query?: { horas?: string }) =>
        apiRaw.get('/notificaciones/pendientes', { params: query }))) as AppApiContract['notificaciones']['pendientes'],
  },
  dashboard: {
    stats: typedApi.dashboard?.stats ?? (() => apiRaw.get('/dashboard/stats')),
  },
  users: {
    listar: typedApi.users?.listar ?? (() => apiRaw.get('/users')),
    obtener: typedApi.users?.obtener ?? ((id: number) => apiRaw.get(`/users/${id}`)),
    crear: (payload, config) => apiRaw.post('/users', payload, { headers: withOutboxHeaders(config?.headers) }),
    actualizar: (id, payload, config) => apiRaw.put(`/users/${id}`, payload, { headers: withOutboxHeaders(config?.headers) }),
    eliminar: (id, config) => apiRaw.delete(`/users/${id}`, { headers: withOutboxHeaders(config?.headers) }),
    cambiarPassword: (id, payload, config) => apiRaw.post(`/users/${id}/cambiar-password`, payload, { headers: withOutboxHeaders(config?.headers) }),
  },
};
