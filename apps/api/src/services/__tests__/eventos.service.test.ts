import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  subscribe,
  broadcast,
  broadcastDatos,
  broadcastModulos,
} from '../eventos.service';
import type { SSEEvent } from '@parapente/shared';

describe('eventos.service', () => {
  beforeEach(() => {
    // Clear out the listeners before each test. Since it's a module level state,
    // we need to make sure we unsubscribe anything we added in previous tests.
    // However, since `listeners` is not exposed, we need to create a new listener,
    // clear everything by relying on a spy or some other mechanism if we can't clear it.
    // In our case we will just make sure to unsubscribe all listeners we add.
  });

  describe('subscribe', () => {
    it('should add a listener and return an unsubscribe function', () => {
      const listener = vi.fn();
      const unsubscribe = subscribe(listener);

      expect(typeof unsubscribe).toBe('function');

      const event: SSEEvent = { type: 'datos-cambios', entidad: 'reserva', accion: 'crear' };
      broadcast(event);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(event);

      unsubscribe();
    });

    it('unsubscribe function should remove the listener', () => {
      const listener = vi.fn();
      const unsubscribe = subscribe(listener);

      unsubscribe();

      const event: SSEEvent = { type: 'datos-cambios', entidad: 'reserva', accion: 'crear' };
      broadcast(event);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('broadcast', () => {
    it('should emit events to all subscribed listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      const unsub1 = subscribe(listener1);
      const unsub2 = subscribe(listener2);

      const event: SSEEvent = { type: 'datos-cambios', entidad: 'piloto', accion: 'actualizar' };
      broadcast(event);

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener1).toHaveBeenCalledWith(event);

      expect(listener2).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledWith(event);

      unsub1();
      unsub2();
    });

    it('should ignore errors thrown by listeners and continue broadcasting to others', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const badListener = vi.fn().mockImplementation(() => {
        throw new Error('Listener error');
      });
      const goodListener = vi.fn();

      const unsub1 = subscribe(badListener);
      const unsub2 = subscribe(goodListener);

      const event: SSEEvent = { type: 'datos-cambios', entidad: 'vuelo', accion: 'crear' };

      // Should not throw
      expect(() => broadcast(event)).not.toThrow();

      expect(badListener).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledWith('Error broadcasting event:', expect.any(Error));
      expect(goodListener).toHaveBeenCalledTimes(1);

      consoleWarnSpy.mockRestore();
      unsub1();
      unsub2();
    });
  });

  describe('broadcastDatos', () => {
    it('should call broadcast with a datos-cambios event', () => {
      const listener = vi.fn();
      const unsubscribe = subscribe(listener);

      broadcastDatos('reserva', 'crear');

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith({
        type: 'datos-cambios',
        entidad: 'reserva',
        accion: 'crear',
      });

      unsubscribe();
    });
  });

  describe('broadcastModulos', () => {
    it('should call broadcast with a modulos-cambios event', () => {
      const listener = vi.fn();
      const unsubscribe = subscribe(listener);

      broadcastModulos(['modulo1', 'modulo2']);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith({
        type: 'modulos-cambios',
        enabled: ['modulo1', 'modulo2'],
      });

      unsubscribe();
    });
  });
});
