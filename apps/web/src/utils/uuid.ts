/**
 * Genera un UUID v4 compatible con el formato que espera el servidor
 * (X-Client-Id del outbox, traceparent, ids de operaciones).
 *
 * Por qué no usar `crypto.randomUUID()` directamente: ese método solo existe
 * en contextos seguros (https o localhost). La web se usa también por IP LAN
 * vía HTTP (ver `ALLOWED_DEV_ORIGINS` en .env), donde `crypto.randomUUID` es
 * `undefined` y llamarlo lanza `TypeError: crypto.randomUUID is not a
 * function` — rompía toda mutación con header `X-Outbox` (editar piloto,
 * reserva, etc.). `crypto.getRandomValues` SÍ está disponible en contextos
 * inseguros, así que es la base del fallback.
 */
export function uuid(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  if (c?.getRandomValues) {
    const bytes = new Uint8Array(16);
    c.getRandomValues(bytes);
    // RFC 4122 v4: versión 0100 (nibble alto del byte 6) y variante 10 (bits 6-7 del byte 8).
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  // Último recurso (entornos sin Web Crypto): suficiente para idempotencia,
  // no para criptografía.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
