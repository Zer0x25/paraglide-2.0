import { describe, it, expect, vi, beforeEach } from 'vitest';
import { subscribe, broadcast, broadcastDatos, broadcastModulos } from '../eventos.service';

describe('Eventos Service', () => {
  beforeEach(() => {
    // We can't easily clear the Set of listeners without exposing it,
    // but we can ensure our tests are clean by unsubscribing.
    // If needed, we'll track listeners to clean them up.
  });

  it('subscribe returns an unsubscribe function that removes the listener', () => {
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);

    // Broadcast should reach the listener
    broadcast({ type: 'modulos-cambios', enabled: ['test'] });
    expect(listener).toHaveBeenCalledTimes(1);

    // Unsubscribe and broadcast again
    unsubscribe();
    broadcast({ type: 'modulos-cambios', enabled: ['test'] });

    // Should still only have been called once
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('broadcast sends events to all subscribed listeners', () => {
    const listener1 = vi.fn();
    const listener2 = vi.fn();

    const unsub1 = subscribe(listener1);
    const unsub2 = subscribe(listener2);

    const event = { type: 'modulos-cambios', enabled: ['module1'] } as const;
    broadcast(event);

    expect(listener1).toHaveBeenCalledWith(event);
    expect(listener2).toHaveBeenCalledWith(event);

    unsub1();
    unsub2();
  });

  it('broadcast handles errors in listeners gracefully', () => {
    const errorListener = vi.fn().mockImplementation(() => {
      throw new Error('Test error');
    });
    const goodListener = vi.fn();

    const unsub1 = subscribe(errorListener);
    const unsub2 = subscribe(goodListener);

    // Suppress console.warn for this test since it's expected
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const event = { type: 'modulos-cambios', enabled: ['test'] } as const;

    // Should not throw despite errorListener throwing
    expect(() => broadcast(event)).not.toThrow();

    // goodListener should still receive the event
    expect(goodListener).toHaveBeenCalledWith(event);
    expect(consoleWarnSpy).toHaveBeenCalled();

    consoleWarnSpy.mockRestore();
    unsub1();
    unsub2();
  });

  it('broadcastDatos emits datos-cambios event', () => {
    const listener = vi.fn();
    const unsub = subscribe(listener);

    broadcastDatos('reservas', 'crear');

    expect(listener).toHaveBeenCalledWith({
      type: 'datos-cambios',
      entidad: 'reservas',
      accion: 'crear'
    });

    unsub();
  });

  it('broadcastModulos emits modulos-cambios event with enabled array', () => {
    const listener = vi.fn();
    const unsub = subscribe(listener);

    const enabledModules = ['moduleA', 'moduleB'];
    broadcastModulos(enabledModules);

    expect(listener).toHaveBeenCalledWith({
      type: 'modulos-cambios',
      enabled: enabledModules
    });

    unsub();
  });
});
