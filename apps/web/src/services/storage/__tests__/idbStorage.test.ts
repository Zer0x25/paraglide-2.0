import { describe, it, expect } from 'vitest';
import {
  resolveStorage,
  memoryFallbackStorage,
  idbCacheStorage,
  type AsyncKVStorage,
} from '../idbStorage';

describe('resolveStorage / fallback en jsdom', () => {
  it('devuelve el fallback en jsdom (sin indexedDB) y hace round-trip', async () => {
    const storage = resolveStorage();
    // En jsdom no hay indexedDB, así que debe ser el fallback en memoria.
    expect(storage).toBe(memoryFallbackStorage);

    await storage.setItem('foo', 'bar');
    expect(await storage.getItem('foo')).toBe('bar');

    await storage.setItem('num', '42');
    expect(await storage.getItem('num')).toBe('42');

    await storage.removeItem('foo');
    expect(await storage.getItem('foo')).toBeNull();

    // Clave inexistente devuelve null.
    expect(await storage.getItem('nope')).toBeNull();
  });

  it('el fallback es estable entre llamadas (mismo Map)', async () => {
    const a = resolveStorage();
    const b = resolveStorage();
    expect(a).toBe(b);

    await a.setItem('shared', 'value');
    expect(await b.getItem('shared')).toBe('value');
  });

  it('AsyncKVStorage type se cumple (solo tipos, no runtime)', () => {
    // Verificación estática: una implementación válida asigna sin error de tipos.
    const impl: AsyncKVStorage = {
      getItem: async (k: string) => (k ? 'x' : null),
      setItem: async () => undefined,
      removeItem: async () => undefined,
    };
    expect(typeof impl.getItem).toBe('function');
    expect(typeof impl.setItem).toBe('function');
    expect(typeof impl.removeItem).toBe('function');
  });

  it('idbCacheStorage satisface el contrato AsyncKVStorage (tipos)', () => {
    // Comprobación de forma: idbCacheStorage es AsyncKVStorage válido.
    const _check: AsyncKVStorage = idbCacheStorage;
    expect(_check).toBeDefined();
  });
});
