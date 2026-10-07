// ========================
// SSE EVENT TYPES (ADR 007 / Pilar 6)
// ========================

/** Entidades que el bus SSE puede notificar como cambiadas. */
export const SSE_ENTIDADES = [
  'vuelo',
  'reserva',
  'piloto',
  'pasajero',
  'equipo',
  'gasto',
  'meteorologia',
  'configuracion-bloques',
  'plantilla',
  'tarifa',
  'promocion',
  'faq',
  'deslinde',
  'regla-operativa',
  'empresa',
  'notificacion-config',
  'usuario',
] as const;
export type Entidad = (typeof SSE_ENTIDADES)[number];

/** Acciones de mutación inferidas por el plugin de broadcast. */
export type AccionMutacion = 'crear' | 'actualizar' | 'eliminar';

/** Evento SSE `datos-cambios`: una entidad fue mutada. */
export interface SSEDatosCambiosEvent {
  type: 'datos-cambios';
  entidad: Entidad;
  accion: AccionMutacion;
}

/** Evento SSE `modulos-cambios`: módulos premium activados/desactivados. */
export interface SSEModulosCambiosEvent {
  type: 'modulos-cambios';
  enabled: string[];
}

/** Union de todos los eventos SSE posibles. */
export type SSEEvent = SSEDatosCambiosEvent | SSEModulosCambiosEvent;

/** Mapa de entidad SSE → prefijo de queryKey de TanStack Query (web). */
export const QUERY_KEY_POR_ENTIDAD: Record<Entidad, string> = {
  vuelo: 'vuelos',
  reserva: 'reservas',
  piloto: 'pilotos',
  pasajero: 'pasajeros',
  equipo: 'equipos',
  gasto: 'gastos',
  meteorologia: 'meteorologia',
  'configuracion-bloques': 'configuracion-bloques',
  plantilla: 'plantillas',
  tarifa: 'tarifas',
  promocion: 'promociones',
  faq: 'faqs',
  deslinde: 'deslindes',
  'regla-operativa': 'reglas-operativas',
  'notificacion-config': 'notificaciones-config',
  empresa: 'empresa',
  usuario: 'users',
};
