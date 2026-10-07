// Almacenamiento asíncrono clave-valor para la web de parapente.
//
// Este módulo es el espejo local del estado del servidor y la base de la
// estrategia offline-first (ver ADR 009 — Estrategia outbox offline-first).
// Usamos IndexedDB como almacén persistente en el navegador real, con un
// fallback en memoria (Map) para entornos sin IndexedDB (p. ej. jsdom en tests).

import { openDB, type IDBPDatabase } from 'idb';

/** Contrato mínimo de un almacén clave-valor asíncrono. */
export interface AsyncKVStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

const DB_NAME = 'parapente-cache';
const STORE_NAME = 'kv';

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Almacén sobre IndexedDB. El store object `kv` usa `key` como keyPath, por lo
 * que cada registro es `{ key, value }`. Si `indexedDB` no existe (jsdom),
 * `resolveStorage` no debería devolver esta instancia; de todos modos
 * `getDB` lanzaría, así que el llamador debe usar el fallback.
 */
export const idbCacheStorage: AsyncKVStorage = {
  async getItem(key: string): Promise<string | null> {
    const db = await getDB();
    const row = (await db.get(STORE_NAME, key)) as { key: string; value: string } | undefined;
    return row ? row.value : null;
  },
  async setItem(key: string, value: string): Promise<void> {
    const db = await getDB();
    await db.put(STORE_NAME, { key, value });
  },
  async removeItem(key: string): Promise<void> {
    const db = await getDB();
    await db.delete(STORE_NAME, key);
  },
};

// Mapa en módulo: compartido entre todas las llamadas a resolveStorage en el
// mismo proceso (suficiente para tests jsdom y como fallback seguro).
const memoryMap = new Map<string, string>();

/**
 * Fallback en memoria basado en un `Map<string,string>` del módulo. No persiste
 * entre recargas, pero es determinista y estable dentro de una corrida.
 */
export const memoryFallbackStorage: AsyncKVStorage = {
  async getItem(key: string): Promise<string | null> {
    return memoryMap.has(key) ? memoryMap.get(key)! : null;
  },
  async setItem(key: string, value: string): Promise<void> {
    memoryMap.set(key, value);
  },
  async removeItem(key: string): Promise<void> {
    memoryMap.delete(key);
  },
};

/**
 * Resuelve el almacén adecuado: IndexedDB en navegadores reales, fallback en
 * memoria cuando no hay `indexedDB` disponible (jsdom, SSR, entornos sin
 * soporte). El fallback es estable porque reusa el mismo `Map` de módulo.
 */
export function resolveStorage(): AsyncKVStorage {
  if (
    typeof window !== 'undefined' &&
    'indexedDB' in window &&
    window.indexedDB != null
  ) {
    return idbCacheStorage;
  }
  return memoryFallbackStorage;
}
