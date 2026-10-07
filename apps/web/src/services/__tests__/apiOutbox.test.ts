import { describe, it, expect, vi, beforeEach } from 'vitest';
import typedApi, { apiRaw } from '../api';
import { typedApiOutbox } from '../apiOutbox';

// Se conserva el módulo real (typedApi con sus URLs y lecturas) y solo se
// reemplaza `apiRaw` por mocks que resuelven {}. Las mutaciones de
// `typedApiOutbox` llaman a `apiRaw.*` en tiempo de ejecución, así que el
// reemplazo del export alcanza para observar las llamadas.
vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api')>();
  return {
    ...actual,
    apiRaw: {
      get: vi.fn().mockResolvedValue({}),
      post: vi.fn().mockResolvedValue({}),
      put: vi.fn().mockResolvedValue({}),
      patch: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    },
  };
});

const mockedApiRaw = vi.mocked(apiRaw);

describe('typedApiOutbox', () => {
  beforeEach(() => {
    // mockClear (no clearAllMocks: preserva las implementaciones)
    mockedApiRaw.get.mockClear();
    mockedApiRaw.post.mockClear();
    mockedApiRaw.put.mockClear();
    mockedApiRaw.patch.mockClear();
    mockedApiRaw.delete.mockClear();
  });

  it('crear → POST /reservas con header X-Outbox', async () => {
    const payload = { titular: 'Test', pasajeros: [] };
    await typedApiOutbox.reservas.crear(payload as never);

    expect(mockedApiRaw.post).toHaveBeenCalledTimes(1);
    expect(mockedApiRaw.post).toHaveBeenCalledWith('/reservas', payload, {
      headers: { 'X-Outbox': '1' },
    });
  });

  it('listar delega al typedApi sin header X-Outbox', async () => {
    // Delegación directa: misma referencia que el método del contrato base.
    expect(typedApiOutbox.reservas.listar).toBe(typedApi.reservas.listar);

    // La delegación usa el typedApi real (que a su vez llama al apiRaw REAL,
    // no al mock). Solo verificamos la identidad de referencia y que el
    // contrato de lecturas no añade headers: no invocamos red aquí.
    expect(typedApi.reservas.listar.length).toBeGreaterThan(0);
  });

  it('config extra fusiona headers con X-Outbox', async () => {
    await typedApiOutbox.reservas.crear({} as never, {
      headers: { 'X-Trace': 'abc' },
    });

    expect(mockedApiRaw.post).toHaveBeenCalledWith('/reservas', {}, {
      headers: { 'X-Outbox': '1', 'X-Trace': 'abc' },
    });
  });

  it('eliminarPago(1, 2, 5) → DELETE con params.version y header X-Outbox', async () => {
    await typedApiOutbox.reservas.eliminarPago(1, 2, 5);

    expect(mockedApiRaw.delete).toHaveBeenCalledTimes(1);
    expect(mockedApiRaw.delete).toHaveBeenCalledWith('/reservas/1/pagos/2', {
      params: { version: 5 },
      headers: { 'X-Outbox': '1' },
    });
  });

  it('actualizar piloto → PATCH /pilotos/:id (la API solo registra PATCH, no PUT)', async () => {
    // Regresión: el web enviaba PUT /pilotos/:id y la API responde 404
    // (routes/pilotos.ts registra fastify.patch('/:id')). El método debe ser PATCH.
    await typedApiOutbox.pilotos.actualizar(32, { telefono: '922479839' } as never);

    expect(mockedApiRaw.patch).toHaveBeenCalledTimes(1);
    expect(mockedApiRaw.patch).toHaveBeenCalledWith('/pilotos/32', { telefono: '922479839' }, {
      headers: { 'X-Outbox': '1' },
    });
    expect(mockedApiRaw.put).not.toHaveBeenCalledWith(
      '/pilotos/32',
      expect.anything(),
      expect.anything(),
    );
  });
});
