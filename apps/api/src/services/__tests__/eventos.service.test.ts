import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  subscribe,
  broadcast,
  broadcastDatos,
  broadcastModulos,
} from '../eventos.service';

describe('eventos.service', () => {
  beforeEach(() => {
    // Clear out console.warn before tests just in case, and restore after.
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('permite suscribirse y recibir eventos via broadcast', () => {
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);

    const testEvent = { type: 'test-event' } as any;
    broadcast(testEvent);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(testEvent);

    unsubscribe();
  });

  it('permite desuscribirse y dejar de recibir eventos', () => {
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);

    unsubscribe();

    broadcast({ type: 'another-test-event' } as any);
    expect(listener).not.toHaveBeenCalled();
  });

  it('continúa el broadcast incluso si un listener lanza error', () => {
    const listenerA = vi.fn().mockImplementation(() => {
      throw new Error('Test error in listener A');
    });
    const listenerB = vi.fn();

    const unsubA = subscribe(listenerA);
    const unsubB = subscribe(listenerB);

    const event = { type: 'error-test' } as any;
    broadcast(event);

    // Ambos listeners deben haber sido llamados
    expect(listenerA).toHaveBeenCalledTimes(1);
    expect(listenerB).toHaveBeenCalledTimes(1);

    // Se debe haber logueado el warning
    expect(console.warn).toHaveBeenCalledWith('Error broadcasting event:', expect.any(Error));

    unsubA();
    unsubB();
  });

  it('broadcastDatos emite evento de tipo datos-cambios', () => {
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);

    broadcastDatos('reservas', 'creacion');

    expect(listener).toHaveBeenCalledWith({
      type: 'datos-cambios',
      entidad: 'reservas',
      accion: 'creacion'
    });

    unsubscribe();
  });

  it('broadcastModulos emite evento de tipo modulos-cambios', () => {
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);

    broadcastModulos(['modulo1', 'modulo2']);

    expect(listener).toHaveBeenCalledWith({
      type: 'modulos-cambios',
      enabled: ['modulo1', 'modulo2']
    });

    unsubscribe();
  });
});
