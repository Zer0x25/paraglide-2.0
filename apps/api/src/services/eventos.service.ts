import type { SSEDatosCambiosEvent, SSEModulosCambiosEvent, SSEEvent } from '@parapente/shared';

type Listener = (event: SSEEvent) => void;

const listeners = new Set<Listener>();

export function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Emite un evento SSE tipado a todos los clientes conectados.
 * Usa una de las funciones helper tipadas (`broadcastDatos` /
 * `broadcastModulos`) en vez de llamar esta directamente.
 */
export function broadcast(event: SSEEvent) {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch (err) {
      console.warn('Error broadcasting event:', err);
    }
  }
}

/** Broadcast de datos-cambios (mutación de entidad). */
export function broadcastDatos(
  entidad: SSEDatosCambiosEvent['entidad'],
  accion: SSEDatosCambiosEvent['accion'],
) {
  broadcast({ type: 'datos-cambios', entidad, accion });
}

/** Broadcast de modulos-cambios (activación/desactivación de módulos premium). */
export function broadcastModulos(enabled: string[]) {
  broadcast({ type: 'modulos-cambios', enabled });
}