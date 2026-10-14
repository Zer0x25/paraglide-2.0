import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import observabilityPlugin from '../../plugins/observability.plugin';
import { iniciarCalendarScheduler } from '../calendarScheduler.service';
import { iniciarCierreContableScheduler } from '../cierreContableScheduler.service';
import { iniciarHigieneBloques } from '../higiene.service';
import { iniciarMeteoScheduler } from '../meteoScheduler.service';
import { iniciarNotificacionesScheduler } from '../notificacionesScheduler.service';
import { googleCalendarService } from '../google-calendar.service';
import { meteorologiaService } from '../meteorologia.service';

vi.mock('../../plugins/prisma', () => ({
  prisma: {
    configuracionBloque: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    condicionPista: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    reserva: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

vi.mock('../google-calendar.service', () => ({
  googleCalendarService: {
    isEnabled: vi.fn().mockReturnValue(true),
    reconcileVuelos: vi
      .fn()
      .mockResolvedValue({ creados: 0, actualizados: 0, eliminados: 0, total: 0 }),
  },
}));

vi.mock('../meteorologia.service', () => ({
  meteorologiaService: {
    obtenerPronosticoOpenMeteo: vi.fn().mockResolvedValue(null),
    registrar: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../notificaciones.service', () => ({
  programarEnvios: vi.fn().mockResolvedValue({ total: 0, enviados: 0, omitidos: 0 }),
}));

describe('Schedulers & Observabilidad — antirregresión A-08', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('todos los schedulers retornan closures de parada que limpian sus timers sin errores', () => {
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

    const st1 = iniciarCalendarScheduler();
    const st2 = iniciarCierreContableScheduler();
    const st3 = iniciarHigieneBloques();
    const st4 = iniciarMeteoScheduler();
    const st5 = iniciarNotificacionesScheduler();

    expect(typeof st1).toBe('function');
    expect(typeof st2).toBe('function');
    expect(typeof st3).toBe('function');
    expect(typeof st4).toBe('function');
    expect(typeof st5).toBe('function');

    // Ejecutar parada ordenada
    st1();
    st2();
    st3();
    st4();
    st5();

    expect(clearIntervalSpy).toHaveBeenCalled();
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('observabilityPlugin inyecta x-request-id y propaga traceparent entrante', async () => {
    const app = Fastify();
    await app.register(observabilityPlugin);

    app.get('/test-trace', async () => ({ ok: true }));
    await app.ready();

    // 1. Petición sin traceparent: genera x-request-id y no añade traceparent
    const resSinTrace = await app.inject({
      method: 'GET',
      url: '/test-trace',
    });
    expect(resSinTrace.statusCode).toBe(200);
    expect(resSinTrace.headers['x-request-id']).toBeDefined();
    expect(resSinTrace.headers['traceparent']).toBeUndefined();

    // 2. Petición con traceparent estándar W3C: propaga el encabezado exacto
    const traceparentW3C = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';
    const resConTrace = await app.inject({
      method: 'GET',
      url: '/test-trace',
      headers: {
        traceparent: traceparentW3C,
      },
    });
    expect(resConTrace.statusCode).toBe(200);
    expect(resConTrace.headers['x-request-id']).toBeDefined();
    expect(resConTrace.headers['traceparent']).toBe(traceparentW3C);

    await app.close();
  });
});
