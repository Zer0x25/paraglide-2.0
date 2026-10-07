/**
 * Contrato de listados (ADR 005): los endpoints de colección responden
 * { data, pagination }. Acepta también arreglo (compatibilidad con mocks/tests).
 */
export function unwrapList<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[];
  const envelope = res as { data?: T[] } | null;
  return envelope?.data ?? [];
}
