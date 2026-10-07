import { describe, it, expect, afterEach } from 'vitest';
import { uuid } from '../uuid';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const realCrypto = globalThis.crypto;
const randomUUIDDescriptor = Object.getOwnPropertyDescriptor(realCrypto, 'randomUUID');

describe('uuid()', () => {
  afterEach(() => {
    // Restaurar el crypto real (randomUUID incluido).
    Object.defineProperty(globalThis, 'crypto', {
      value: realCrypto,
      configurable: true,
      writable: true,
    });
    if (randomUUIDDescriptor) {
      Object.defineProperty(realCrypto, 'randomUUID', randomUUIDDescriptor);
    }
  });

  it('devuelve un uuid v4 válido cuando crypto.randomUUID existe', () => {
    const value = uuid();
    expect(value).toMatch(UUID_V4);
  });

  it('genera ids distintos en llamadas consecutivas', () => {
    const a = uuid();
    const b = uuid();
    expect(a).not.toBe(b);
  });

  it('NO lanza TypeError cuando crypto.randomUUID no existe (contexto inseguro: IP LAN vía HTTP)', () => {
    // Simula el entorno http://10.x.x.x:3000 donde crypto existe pero
    // randomUUID es undefined (requiere contexto seguro).
    Object.defineProperty(realCrypto, 'randomUUID', {
      value: undefined,
      configurable: true,
    });

    expect(() => uuid()).not.toThrow();
    expect(uuid()).toMatch(UUID_V4);
  });

  it('cae al último recurso sin romperse si no hay Web Crypto en absoluto', () => {
    Object.defineProperty(globalThis, 'crypto', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    expect(() => uuid()).not.toThrow();
    expect(uuid()).toMatch(UUID_V4);
  });
});
