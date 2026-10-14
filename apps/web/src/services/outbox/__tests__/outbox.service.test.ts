import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// Fake en memoria para idb (jsdom no tiene indexedDB)
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
    clear(name: string) {
      ensure(name).clear();
      return Promise.resolve();
    },
  };
}

const fake = createFakeDB();

vi.mock('idb', () => ({
  openDB: vi.fn(() => Promise.resolve(fake)),
}));

import {
  enqueue,
  listOutbox,
  removeFromOutbox,
  markConflict,
  removeConflicto,
  clearConflictos,
  listConflictos,
  reintentarConflicto,
  replayOutbox,
  subscribeOutboxCount,
  deepReplaceId,
} from '../outbox.service';

beforeEach(() => {
  fake.stores.clear();
});

describe('outbox.service', () => {
  it('enqueue y lista en orden FIFO', async () => {
    const a = await enqueue({ entidad: 'piloto', metodo: 'POST', url: '/pilotos' });
    // Forzar createdAt distinto para probar orden
    await new Promise((r) => setTimeout(r, 2));
    const b = await enqueue({ entidad: 'reserva', metodo: 'PUT', url: '/reservas/1' });
    const list = await listOutbox();
    expect(list.map((e) => e.id)).toEqual([a.id, b.id]);
    expect(a.intentos).toBe(0);
    expect(typeof a.id).toBe('string');
  });

  it('removeFromOutbox elimina la entrada', async () => {
    const e = await enqueue({ entidad: 'piloto', metodo: 'POST', url: '/pilotos' });
    await removeFromOutbox(e.id);
    const list = await listOutbox();
    expect(list.find((x) => x.id === e.id)).toBeUndefined();
  });

  it('markConflict mueve a conflictos y borra de outbox', async () => {
    const e = await enqueue({ entidad: 'piloto', metodo: 'PUT', url: '/pilotos/1' });
    await markConflict(e, 'conflicto de versión');
    const list = await listOutbox();
    expect(list.find((x) => x.id === e.id)).toBeUndefined();
    const conflictos = await listConflictos();
    expect(conflictos).toHaveLength(1);
    expect(conflictos[0].id).toBe(e.id);
    expect(conflictos[0].error).toBe('conflicto de versión');
  });

  it('replayOutbox reenvía y vacía la cola (ok)', async () => {
    await enqueue({ entidad: 'piloto', metodo: 'POST', url: '/pilotos', payload: { nombre: 'x' } });
    const api = {
      request: vi.fn().mockResolvedValue({}),
    } as unknown as import('axios').AxiosInstance;
    const result = await replayOutbox(api);
    expect(result.ok).toBe(1);
    expect(result.remaining).toBe(0);
    expect(api.request).toHaveBeenCalledTimes(1);
    const call = (api.request as Mock).mock.calls[0][0];
    expect(call.method).toBe('POST');
    expect(call.url).toBe('/pilotos');
    expect(call.data).toEqual({ nombre: 'x' });
    expect(call.headers['X-Client-Id']).toBeTruthy();
  });

  it('replayOutbox manda a conflictos en 409', async () => {
    const e = await enqueue({ entidad: 'reserva', metodo: 'PUT', url: '/reservas/1' });
    const api = {
      request: vi.fn().mockRejectedValue({ response: { status: 409 }, message: 'conflicto' }),
    } as unknown as import('axios').AxiosInstance;
    const result = await replayOutbox(api);
    expect(result.conflicts).toBe(1);
    expect(result.remaining).toBe(0);
    const conflictos = await listConflictos();
    expect(conflictos).toHaveLength(1);
    expect(conflictos[0].id).toBe(e.id);
    expect(conflictos[0].error).toBe('conflicto');
  });

  it('subscribeOutboxCount notifica cambios de conteo', async () => {
    const cb = vi.fn();
    const unsub = subscribeOutboxCount(cb);
    await enqueue({ entidad: 'piloto', metodo: 'POST', url: '/pilotos' });
    // esperar microtareas de notificar
    await new Promise((r) => setTimeout(r, 0));
    expect(cb).toHaveBeenCalledWith(1);
    unsub();
  });

  it('removeConflicto y clearConflictos eliminan del store de conflictos', async () => {
    const e1 = await enqueue({ entidad: 'vuelo', metodo: 'PUT', url: '/vuelos/1' });
    const e2 = await enqueue({ entidad: 'vuelo', metodo: 'PUT', url: '/vuelos/2' });
    await markConflict(e1, 'conflicto 1', 409);
    await markConflict(e2, 'conflicto 2', 409);

    let conflictos = await listConflictos();
    expect(conflictos).toHaveLength(2);

    await removeConflicto(e1.id);
    conflictos = await listConflictos();
    expect(conflictos).toHaveLength(1);
    expect(conflictos[0].id).toBe(e2.id);

    await clearConflictos();
    conflictos = await listConflictos();
    expect(conflictos).toHaveLength(0);
  });

  it('deepReplaceId sustituye IDs recursivamente en números, strings y keys de objetos', () => {
    const payload = {
      reservaId: -1257,
      sub: {
        id: -1257,
        texto: 'ref -1257 ok',
      },
      asignaciones: {
        '-1258': 5,
        '10': 3,
      },
    };

    const res1 = deepReplaceId(payload, -1257, 87);
    expect(res1.reservaId).toBe(87);
    expect(res1.sub.id).toBe(87);
    expect(res1.sub.texto).toBe('ref 87 ok');

    const res2 = deepReplaceId(res1, -1258, 205);
    expect((res2.asignaciones as Record<string, number>)['205']).toBe(5);
    expect((res2.asignaciones as Record<string, number>)['10']).toBe(3);
  });

  it('deepReplaceId respeta límites de palabra/número sin corromper fechas, RUTs ni IDs más largos', () => {
    const payload = {
      fecha: '2026-12-25',
      rut: '125799-K',
      urlId: '/reservas/-125799',
      targetId: -1257,
      targetStr: 'prefix -1257 suffix',
    };

    const res = deepReplaceId(payload, -1257, 87);
    expect(res.targetId).toBe(87);
    expect(res.targetStr).toBe('prefix 87 suffix');
    // NO debe haber mutado -125799 ni fechas ni RUTs
    expect(res.urlId).toBe('/reservas/-125799');
    expect(res.fecha).toBe('2026-12-25');
    expect(res.rut).toBe('125799-K');

    // Comprobar que un tempId como -12 no sustituye el mes en una fecha '2026-12-25' porque '6' antecede a '-12'
    const resFecha = deepReplaceId(payload, -12, 99);
    expect(resFecha.fecha).toBe('2026-12-25');
  });

  it('replayOutbox remapea tempId a realId en peticiones dependientes posteriores', async () => {
    const tempId = -1257;
    // 1. Petición de creación de reserva con tempId
    await enqueue({
      entidad: 'reserva',
      metodo: 'POST',
      url: '/reservas',
      payload: { nombreTitular: 'Mayte', pasajeros: [{ id: -1258, nombre: 'Pax' }] },
      tempId,
    });
    // 2. Petición de pago que referencia la URL con tempId
    await enqueue({
      entidad: 'reserva',
      metodo: 'POST',
      url: `/reservas/${tempId}/pagos`,
      payload: { monto: 50000, metodo: 'TRANSFERENCIA' },
    });
    // 3. Petición de agendamiento con payload referenciando reservaId y clave de pasajero
    await enqueue({
      entidad: 'vuelo',
      metodo: 'POST',
      url: '/vuelos/agendamiento-grupo',
      payload: { reservaId: tempId, asignaciones: { '-1258': 2 } },
    });

    const api = {
      request: vi.fn().mockImplementation((req: Record<string, unknown>) => {
        if (req.url === '/reservas' && req.method === 'POST') {
          return Promise.resolve({
            data: { id: 87, pasajeros: [{ id: 205, nombre: 'Pax' }] },
          });
        }
        return Promise.resolve({ data: { success: true } });
      }),
    } as unknown as import('axios').AxiosInstance;

    const result = await replayOutbox(api);
    expect(result.ok).toBe(3);
    expect(result.conflicts).toBe(0);
    expect(result.remaining).toBe(0);

    const calls = (api.request as Mock).mock.calls;
    expect(calls[0][0].url).toBe('/reservas');
    // La segunda llamada debe haber reemplazado el tempId en la URL
    expect(calls[1][0].url).toBe('/reservas/87/pagos');
    // La tercera llamada debe haber reemplazado en el payload reservaId y la asignación
    expect(calls[2][0].url).toBe('/vuelos/agendamiento-grupo');
    expect(calls[2][0].data.reservaId).toBe(87);
    expect(calls[2][0].data.asignaciones['205']).toBe(2);
  });

  it('replayOutbox interrumpe el ciclo si detecta error de red (ERR_NETWORK) para no quemar cola', async () => {
    await enqueue({ entidad: 'reserva', metodo: 'POST', url: '/reservas', payload: { a: 1 } });
    await enqueue({ entidad: 'vuelo', metodo: 'PUT', url: '/vuelos/2', payload: { b: 2 } });

    const api = {
      request: vi.fn().mockRejectedValue({ code: 'ERR_NETWORK', message: 'Network Error' }),
    } as unknown as import('axios').AxiosInstance;

    const result = await replayOutbox(api);
    expect(result.ok).toBe(0);
    expect(result.conflicts).toBe(0);
    expect(result.remaining).toBe(2);
    // Solo intentó la primera y detuvo el bucle (break)
    expect(api.request).toHaveBeenCalledTimes(1);
  });

  it('reintentarConflicto obtiene la versión fresca del servidor ante 409 y sincroniza', async () => {
    const e = await enqueue({
      entidad: 'vuelo',
      metodo: 'PUT',
      url: '/vuelos/2',
      payload: { pilotoId: 1, version: 1 },
    });
    await markConflict(e, 'Los datos cambiaron en otro dispositivo', 409);

    const api = {
      get: vi.fn().mockResolvedValue({ data: { id: 2, version: 3 } }),
      request: vi.fn().mockResolvedValue({ data: { id: 2, version: 4 } }),
    } as unknown as import('axios').AxiosInstance;

    const res = await reintentarConflicto(e.id, api);
    expect(res.success).toBe(true);
    expect(api.get).toHaveBeenCalledWith('/vuelos/2');
    expect(api.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'PUT',
        url: '/vuelos/2',
        data: expect.objectContaining({ version: 3 }),
      }),
    );

    const conflictos = await listConflictos();
    expect(conflictos).toHaveLength(0);
  });

  it('reintentarConflicto (A-04) resuelve la URL del padre para sub-recursos /reservas/:id/pagos', async () => {
    const e = await enqueue({
      entidad: 'reserva',
      metodo: 'POST',
      url: '/reservas/42/pagos',
      payload: { monto: 50000, version: 1 },
    });
    await markConflict(e, 'Conflicto de versión', 409);

    const api = {
      get: vi.fn().mockResolvedValue({ data: { id: 42, version: 5 } }),
      request: vi.fn().mockResolvedValue({ data: { success: true } }),
    } as unknown as import('axios').AxiosInstance;

    const res = await reintentarConflicto(e.id, api);
    expect(res.success).toBe(true);
    // Debe consultar /reservas/42 (la entidad raíz), no /reservas/42/pagos
    expect(api.get).toHaveBeenCalledWith('/reservas/42');
    expect(api.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: '/reservas/42/pagos',
        data: expect.objectContaining({ version: 5 }),
      }),
    );
  });

  it('reintentarConflicto (A-04) resuelve la versión de la reserva para /vuelos/agendamiento-grupo', async () => {
    const e = await enqueue({
      entidad: 'vuelo',
      metodo: 'POST',
      url: '/vuelos/agendamiento-grupo',
      payload: { reservaId: 99, version: 2, asignaciones: {} },
    });
    await markConflict(e, 'Conflicto de versión', 409);

    const api = {
      get: vi.fn().mockResolvedValue({ data: { id: 99, version: 4 } }),
      request: vi.fn().mockResolvedValue({ data: { success: true } }),
    } as unknown as import('axios').AxiosInstance;

    const res = await reintentarConflicto(e.id, api);
    expect(res.success).toBe(true);
    expect(api.get).toHaveBeenCalledWith('/reservas/99');
    expect(api.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: '/vuelos/agendamiento-grupo',
        data: expect.objectContaining({ reservaId: 99, version: 4 }),
      }),
    );
  });
});
