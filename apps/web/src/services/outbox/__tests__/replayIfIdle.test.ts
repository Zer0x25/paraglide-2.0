/**
 * Tests de regresión para `replayIfIdle` (ADR 009 — outbox offline-first).
 *
 * Contrato esperado (cambio en curso, firmas garantizadas):
 *   export async function replayIfIdle(api: AxiosInstance):
 *     Promise<{ ok: number; conflicts: number; remaining: number } | null>
 *
 * - Devuelve `null` si ya hay un replay en curso (lock a nivel de módulo).
 * - Si no, ejecuta `replayOutbox(api)` y libera el lock en `finally`
 *   (también cuando replayOutbox rechaza).
 *
 * Estrategia: NO mockeamos `../outbox.service` (en ESM un spy sobre el propio
 * módulo no intercepta las referencias internas entre funciones del mismo
 * archivo). Usamos el servicio REAL con el fake de `idb` en memoria — jsdom no
 * tiene indexedDB, misma técnica exacta que `outbox.service.test.ts` — y
 * controlamos la duración del replay mediante la promesa devuelta por
 * `api.request`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AxiosInstance } from 'axios';

// --- Fake en memoria para idb (copia exacta del patrón de outbox.service.test.ts) ---
function createFakeDB() {
  const stores = new Map<string, Map<string, unknown>>();
  const ensure = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    return stores.get(name)!;
  };
  return {
    stores,
    get(name: string, key: string) {
      return Promise.resolve(ensure(name).get(key));
    },
    getAll(name: string) {
      return Promise.resolve(Array.from(ensure(name).values()));
    },
    put(name: string, value: { id?: string; key?: string }) {
      const map = ensure(name);
      const k = (value as { id?: string }).id ?? (value as { key: string }).key;
      map.set(k, value);
      return Promise.resolve();
    },
    delete(name: string, key: string) {
      ensure(name).delete(key);
      return Promise.resolve();
    },
  };
}

const fake = createFakeDB();

vi.mock('idb', () => ({
  openDB: vi.fn(() => Promise.resolve(fake)),
}));

// Import del namespace (sin destructuring estático de replayIfIdle): si la
// función todavía no existe (cambio en curso), cada test falla individualmente
// con un mensaje claro en lugar de romper todo el archivo con un error de
// importación.
import * as outboxService from '../outbox.service';
import { enqueue } from '../outbox.service';

type ResultadoReplay = { ok: number; conflicts: number; remaining: number };
type ReplayIfIdle = (api: AxiosInstance) => Promise<ResultadoReplay | null>;

function obtenerReplayIfIdle(): ReplayIfIdle {
  const fn = (outboxService as unknown as Record<string, unknown>).replayIfIdle;
  if (typeof fn !== 'function') {
    throw new Error(
      'replayIfIdle aún no existe en services/outbox/outbox.service.ts (cambio en curso)',
    );
  }
  return fn as ReplayIfIdle;
}

/** Promesa controlada con catch preventivo (evita unhandled rejection si nadie la consume). */
function crearPromesaControlada() {
  let resolver!: (v: unknown) => void;
  let rechazar!: (e: unknown) => void;
  const promesa = new Promise((res, rej) => {
    resolver = res;
    rechazar = rej;
  });
  promesa.catch(() => {});
  return { promesa, resolver, rechazar };
}

function crearApi(requestImpl: (...args: unknown[]) => Promise<unknown>): AxiosInstance {
  return { request: vi.fn(requestImpl) } as unknown as AxiosInstance;
}

/** Cede un tick de macrotarea: garantiza que los awaits internos (microtasks) avanzaron. */
const tick = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  fake.stores.clear();
});

describe('replayIfIdle — lock de replay único (ADR 009)', () => {
  it('(a) delega en replayOutbox cuando está libre y devuelve su resultado', async () => {
    const replayIfIdle = obtenerReplayIfIdle();

    await enqueue({ entidad: 'piloto', metodo: 'POST', url: '/pilotos', payload: { nombre: 'x' } });
    await enqueue({ entidad: 'reserva', metodo: 'PUT', url: '/reservas/1' });

    const api = {
      request: vi
        .fn()
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(
          Object.assign(new Error('conflicto'), { response: { status: 409 } }),
        ),
    } as unknown as AxiosInstance;

    const resultado = await replayIfIdle(api);

    // Es exactamente el resultado que produce replayOutbox para esa cola
    // (1 ok + 1 conflicto 409, cola vacía): prueba de delegación sin mockear
    // el propio módulo.
    expect(resultado).toEqual({ ok: 1, conflicts: 1, remaining: 0 });
    expect(api.request).toHaveBeenCalledTimes(2);
  });

  it('(b) una segunda llamada concurrente devuelve null y NO vuelve a ejecutar el replay', async () => {
    const replayIfIdle = obtenerReplayIfIdle();

    await enqueue({ entidad: 'piloto', metodo: 'POST', url: '/pilotos' });

    // Promesa controlada: simula un replay lento (petición en vuelo).
    const puerta = crearPromesaControlada();
    const api = crearApi(() => puerta.promesa);

    const primera = replayIfIdle(api);
    await tick(); // la primera llamada queda efectivamente en vuelo
    expect(api.request).toHaveBeenCalledTimes(1);

    const segunda = await replayIfIdle(api);
    expect(segunda).toBeNull();
    expect(api.request).toHaveBeenCalledTimes(1); // no re-ejecutó replayOutbox

    puerta.resolver({});
    expect(await primera).toEqual({ ok: 1, conflicts: 0, remaining: 0 });
  });

  it('(c) tras completarse la primera ejecución el lock se libera y una nueva llamada vuelve a ejecutar', async () => {
    const replayIfIdle = obtenerReplayIfIdle();

    await enqueue({ entidad: 'piloto', metodo: 'POST', url: '/pilotos' });
    const api = crearApi(() => Promise.resolve({}));

    const primera = await replayIfIdle(api);
    expect(primera).toEqual({ ok: 1, conflicts: 0, remaining: 0 });

    // Nueva entrada en cola y segunda ejecución: debe volver a correr (lock liberado).
    await enqueue({ entidad: 'gasto', metodo: 'POST', url: '/gastos' });
    const segunda = await replayIfIdle(api);
    expect(segunda).toEqual({ ok: 1, conflicts: 0, remaining: 0 });
    expect(api.request).toHaveBeenCalledTimes(2);
  });

  it('(d) si replayOutbox rechaza, el lock se libera igualmente (la siguiente llamada ejecuta)', async () => {
    const replayIfIdle = obtenerReplayIfIdle();

    // Provocamos el rechazo de replayOutbox: la lectura de la cola falla.
    const getAllOriginal = fake.getAll;
    fake.getAll = () => Promise.reject(new Error('idb caida'));
    await expect(
      replayIfIdle(crearApi(() => Promise.resolve({}))),
    ).rejects.toThrow('idb caida');

    // Restauramos idb: la siguiente llamada debe ejecutar normalmente
    // (lock liberado en finally aunque la primera haya rechazado).
    fake.getAll = getAllOriginal;
    await enqueue({ entidad: 'piloto', metodo: 'POST', url: '/pilotos' });
    const api = crearApi(() => Promise.resolve({}));
    const segunda = await replayIfIdle(api);
    expect(segunda).toEqual({ ok: 1, conflicts: 0, remaining: 0 });
  });
});
