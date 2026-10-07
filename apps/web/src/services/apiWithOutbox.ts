/**
 * Helper de headers para mutaciones outbox (ADR 009).
 *
 * `services/api.ts` ya encola automáticamente en el outbox cualquier
 * request que lleve el header `X-Outbox: '1'` cuando se produce un
 * `ERR_NETWORK`. Este módulo expone un constructor de headers para que
 * los `mutationFn` de los hooks de dominio puedan activarlo sin acoplarse
 * a la forma del cliente axios.
 *
 * Uso típico desde un `useDomainMutation`:
 *
 *   useDomainMutation({
 *     invalidateKeys: [['reservas']],
 *     mutationFn: (payload) =>
 *       typedApi.reservas.crear(payload, { headers: withOutboxHeaders() }),
 *     outbox: true,
 *   });
 *
 * El flag `outbox: true` en `useDomainMutation` es por ahora declarativo
 * (no envuelve nada en runtime); este helper es lo que el `mutationFn`
 * debe usar para que la request sea encolada si la red falla.
 */

/** Nombre del header que el interceptor de `services/api.ts` reconoce. */
export const HEADER_X_OUTBOX = 'X-Outbox' as const;

/** Valor del header `X-Outbox` que activa el encolado en el outbox. */
export const HEADER_X_OUTBOX_VALUE = '1' as const;

/**
 * Devuelve los headers que una mutación debe pasar a su llamada axios
 * para que el outbox la enqueue si la red falla. Acepta headers extra
 * que se fusionan (los extras tienen prioridad si colisionan).
 */
export function withOutboxHeaders(
  extra?: Record<string, string>,
): Record<string, string> {
  return { [HEADER_X_OUTBOX]: HEADER_X_OUTBOX_VALUE, ...extra };
}
