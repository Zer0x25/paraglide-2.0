import { openDB, type IDBPDatabase } from 'idb';
import type { OutboxConflicto, OutboxEntry, OutboxMetodo } from './types';
import { uuid } from '@/utils/uuid';

const DB_NAME = 'parapente-outbox';
const DB_VERSION = 1;
const STORE_OUTBOX = 'outbox';
const STORE_CONFLICTOS = 'conflictos';

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_OUTBOX)) {
          db.createObjectStore(STORE_OUTBOX, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_CONFLICTOS)) {
          db.createObjectStore(STORE_CONFLICTOS, { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

// --- Suscripción de conteo (módulo) ---
type CountCb = (n: number) => void;
const countSubscribers = new Set<CountCb>();

async function notificar(): Promise<void> {
  const n = await listOutbox().then((l) => l.length).catch(() => 0);
  countSubscribers.forEach((cb) => cb(n));
}

/**
 * Encola una mutación offline (ADR 009).
 *
 * `opciones.id` permite reutilizar el X-Client-Id generado en el primer intento
 * (interceptor de request). Así, si el servidor aplicó la operación pero la
 * respuesta se perdió, el replay lleva el MISMO clientId y el dedupe server-side
 * lo reconoce como duplicado en vez de aplicarla dos veces.
 */
export async function enqueue(
  entry: Omit<OutboxEntry, 'id' | 'createdAt' | 'intentos'>,
  opciones?: { /** Id preexistente (X-Client-Id del primer intento) para idempotencia end-to-end (ADR 009). */ id?: string }
): Promise<OutboxEntry> {
  const db = await getDB();
  const full: OutboxEntry = {
    id: opciones?.id ?? uuid(),
    createdAt: Date.now(),
    intentos: 0,
    ...entry,
  };
  await db.put(STORE_OUTBOX, full);
  await notificar();
  return full;
}

export async function listOutbox(): Promise<OutboxEntry[]> {
  const db = await getDB();
  const all = (await db.getAll(STORE_OUTBOX)) as OutboxEntry[];
  return all.sort((a, b) => a.createdAt - b.createdAt); // FIFO
}

export async function removeFromOutbox(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_OUTBOX, id);
  await notificar();
}

export async function markConflict(entry: OutboxEntry, error: unknown, status?: number): Promise<void> {
  const db = await getDB();
  const conflicto: OutboxConflicto = {
    id: entry.id,
    entidad: entry.entidad,
    metodo: entry.metodo,
    url: entry.url,
    payload: entry.payload,
    createdAt: entry.createdAt,
    error: error instanceof Error ? error.message : String(error),
    status,
  };
  await db.put(STORE_CONFLICTOS, conflicto);
  await db.delete(STORE_OUTBOX, entry.id);
  await notificar();
}

export async function removeConflicto(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_CONFLICTOS, id);
  await notificar();
}

export async function clearConflictos(): Promise<void> {
  const db = await getDB();
  const dbWithClear = db as unknown as { clear: (storeName: string) => Promise<void> };
  if (typeof dbWithClear.clear === 'function') {
    await dbWithClear.clear(STORE_CONFLICTOS);
  } else {
    const all = (await db.getAll(STORE_CONFLICTOS)) as OutboxConflicto[];
    for (const c of all) {
      await db.delete(STORE_CONFLICTOS, c.id);
    }
  }
  await notificar();
}

export async function listConflictos(): Promise<OutboxConflicto[]> {
  const db = await getDB();
  return (await db.getAll(STORE_CONFLICTOS)) as OutboxConflicto[];
}

export function deepReplaceId<T>(target: T, oldId: number | string, newId: number): T {
  if (target === null || target === undefined) return target;
  if (typeof target === 'number') {
    return (target === Number(oldId) ? newId : target) as unknown as T;
  }
  if (typeof target === 'string') {
    if (target === String(oldId)) return String(newId) as unknown as T;
    if ((target as string).includes(String(oldId))) {
      return (target as string).split(String(oldId)).join(String(newId)) as unknown as T;
    }
    return target;
  }
  if (Array.isArray(target)) {
    return (target as unknown[]).map((item) => deepReplaceId(item, oldId, newId)) as unknown as T;
  }
  if (typeof target === 'object') {
    const next: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(target as Record<string, unknown>)) {
      const nextKey = k === String(oldId) ? String(newId) : k;
      next[nextKey] = deepReplaceId(v, oldId, newId);
    }
    return next as unknown as T;
  }
  return target;
}

function isNetworkError(err: unknown): boolean {
  if (err !== null && typeof err === 'object') {
    const e = err as { code?: unknown; message?: unknown; response?: unknown; request?: unknown };
    if (e.code === 'ERR_NETWORK') return true;
    if (typeof e.message === 'string' && (e.message === 'Network Error' || e.message.includes('NetworkError') || e.message.includes('Failed to fetch'))) return true;
    if (!e.response && Boolean(e.request)) return true;
  }
  return false;
}

const MAX_INTENTOS = 5;

export async function replayOutbox(
  api: import('axios').AxiosInstance
): Promise<{ ok: number; conflicts: number; remaining: number }> {
  const entries = await listOutbox();
  let ok = 0;
  let conflicts = 0;
  const idMapping = new Map<number | string, number>();

  for (const entry of entries) {
    // 1. Aplicar remapeo de IDs temporales a URL y payload
    let effectiveUrl = entry.url;
    let effectivePayload = entry.payload;

    for (const [tempId, realId] of idMapping.entries()) {
      if (effectiveUrl.includes(String(tempId))) {
        effectiveUrl = effectiveUrl.split(String(tempId)).join(String(realId));
      }
      if (effectivePayload) {
        effectivePayload = deepReplaceId(effectivePayload, tempId, realId);
      }
    }

    try {
      const res = await api.request({
        method: entry.metodo as OutboxMetodo,
        url: effectiveUrl,
        data: effectivePayload,
        headers: { 'X-Client-Id': entry.id },
      });

      // Si la petición creó una entidad, registrar el id real generado
      const rawData = (res as unknown as { data?: unknown })?.data ?? res;
      const respObj = rawData as Record<string, unknown> | null;
      const nested = respObj?.['data'] as Record<string, unknown> | undefined;
      const createdIdRaw = respObj?.['id'] ?? nested?.['id'];
      const createdId = typeof createdIdRaw === 'number' ? createdIdRaw : undefined;
      if (createdId !== undefined) {
        if (entry.tempId) {
          idMapping.set(entry.tempId, createdId);
          idMapping.set(Number(entry.tempId), createdId);
          idMapping.set(String(entry.tempId), createdId);
        }
        // Si el payload tenía pasajeros y la respuesta también, remapear IDs de pasajeros
        const responsePasajeros = (respObj?.['pasajeros'] ?? nested?.['pasajeros']) as unknown;
        const payloadObj = effectivePayload as Record<string, unknown> | null | undefined;
        const payloadPasajeros = payloadObj?.['pasajeros'] as unknown;
        if (Array.isArray(responsePasajeros) && Array.isArray(payloadPasajeros)) {
          responsePasajeros.forEach((realPax: unknown, idx: number) => {
            const tempPax = payloadPasajeros[idx] as Record<string, unknown> | undefined;
            const realObj = realPax as Record<string, unknown>;
            if (tempPax?.['id'] != null && realObj?.['id'] != null) {
              const tId = tempPax['id'] as number | string;
              const rId = realObj['id'] as number;
              if (typeof rId === 'number') {
                idMapping.set(tId, rId);
                idMapping.set(String(tId), rId);
              }
            }
          });
        }
      }

      await removeFromOutbox(entry.id);
      ok++;
    } catch (err: unknown) {
      // Si es error de red durante el replay, abortar el ciclo de inmediato
      // para no quemar intentos innecesariamente mientras la conexión móvil se estabiliza.
      if (isNetworkError(err)) {
        console.warn('[outbox] Conexión inestable durante replay, pausando cola:', (err as Error)?.message);
        break;
      }

      const resObj = (err as { response?: { status?: number; data?: Record<string, unknown> } })?.response;
      const status = resObj?.status;
      const dataObj = resObj?.data;
      const errMsg = (err as { message?: unknown })?.message;
      const errorMsg =
        (typeof dataObj?.['error'] === 'string' ? (dataObj['error'] as string) : undefined) ||
        (typeof dataObj?.['message'] === 'string' ? (dataObj['message'] as string) : undefined) ||
        (typeof errMsg === 'string' ? errMsg : undefined) ||
        'Error en sincronización';

      if (status === 409) {
        await markConflict(entry, errorMsg, 409);
        conflicts++;
      } else if (status === 400 && (errorMsg.includes('no encontrada') || errorMsg.includes('Límite de peso') || entry.intentos >= 2)) {
        // Errores 400 estructurales de validación de negocio no deben seguir bloqueando la cola
        await markConflict(entry, `Error 400: ${errorMsg}`, 400);
        conflicts++;
      } else {
        entry.intentos += 1;
        if (entry.intentos >= MAX_INTENTOS) {
          await markConflict(entry, errorMsg || 'Límite de intentos alcanzado', status);
          conflicts++;
        } else {
          const db = await getDB();
          await db.put(STORE_OUTBOX, entry);
        }
      }
    }
  }

  const remaining = (await listOutbox()).length;
  return { ok, conflicts, remaining };
}

/**
 * Reintenta un conflicto almacenado en el store local.
 * Si es un 409 de concurrencia (PUT/PATCH), consulta la versión actual del
 * servidor para enviar la mutación con la versión fresca.
 */
export async function reintentarConflicto(
  id: string,
  api: import('axios').AxiosInstance
): Promise<{ success: boolean; error?: string }> {
  const db = await getDB();
  const conflicto = (await db.get(STORE_CONFLICTOS, id)) as OutboxConflicto | undefined;
  if (!conflicto) return { success: false, error: 'Conflicto no encontrado' };

  let dataToSend: unknown = conflicto.payload;

  // Si fue un 409 en una entidad modificable (PUT/PATCH), consultar la versión actual en el servidor
  if (conflicto.metodo === 'PUT' || conflicto.metodo === 'PATCH') {
    try {
      const getRes = await api.get(conflicto.url);
      const rawServer = (getRes as unknown as { data?: unknown })?.data ?? getRes;
      const serverObj = rawServer as Record<string, unknown> | null;
      const serverNested = serverObj?.['data'] as Record<string, unknown> | undefined;
      const freshVersionRaw = serverObj?.['version'] ?? serverNested?.['version'];
      const freshVersion = typeof freshVersionRaw === 'number' ? freshVersionRaw : undefined;
      if (typeof freshVersion === 'number' && dataToSend !== null && typeof dataToSend === 'object' && !Array.isArray(dataToSend)) {
        dataToSend = { ...(dataToSend as Record<string, unknown>), version: freshVersion };
      }
    } catch {
      // Si el GET falla, intentar reenvío con el payload original
    }
  }

  try {
    await api.request({
      method: conflicto.metodo,
      url: conflicto.url,
      data: dataToSend,
      headers: { 'X-Client-Id': uuid() }, // nuevo id para forzar ejecución
    });
    await db.delete(STORE_CONFLICTOS, id);
    await notificar();
    return { success: true };
  } catch (err: unknown) {
    const e = err as { response?: { data?: Record<string, unknown> }; message?: string };
    const eData = e.response?.data;
    const errorMsg =
      (typeof eData?.['error'] === 'string' ? (eData['error'] as string) : undefined) ||
      (typeof eData?.['message'] === 'string' ? (eData['message'] as string) : undefined) ||
      (typeof e.message === 'string' ? e.message : 'Fallo al reintentar conflicto');
    conflicto.error = errorMsg;
    await db.put(STORE_CONFLICTOS, conflicto);
    await notificar();
    return { success: false, error: errorMsg };
  }
}

export function subscribeOutboxCount(cb: CountCb): () => void {
  countSubscribers.add(cb);
  // Emitir valor actual de inmediato
  listOutbox()
    .then((l) => cb(l.length))
    .catch(() => cb(0));
  return () => {
    countSubscribers.delete(cb);
  };
}

// --- Lock anti-replay-concurrente (ADR 009) ---
// Centraliza el anti-double-fire para todos los disparadores del replay
// (transición offline→online, apertura/reconexión SSE, botón manual):
// si ya hay un replay en curso, los disparadores concurrentes se ignoran
// en lugar de duplicar el reenvío de las mismas entradas.
let replayEnCurso = false;

/**
 * Ejecuta el replay del outbox solo si no hay otro en curso.
 * Si ya existe un replay en marcha devuelve `null` inmediatamente (sin lanzar)
 * sin ejecutar nada; en caso contrario toma el lock, reenvía el outbox y lo
 * libera siempre (incluso si `replayOutbox` lanza).
 * Centraliza el anti-double-fire para múltiples disparadores (evento online,
 * apertura/reconexión SSE, botón manual). Ver ADR 009.
 */
export async function replayIfIdle(
  api: import('axios').AxiosInstance
): Promise<{ ok: number; conflicts: number; remaining: number } | null> {
  if (replayEnCurso) return null;
  replayEnCurso = true;
  try {
    return await replayOutbox(api);
  } finally {
    replayEnCurso = false;
  }
}
