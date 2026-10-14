import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { subscribe, broadcast, broadcastDatos, broadcastModulos } from '../eventos.service';
import type { SSEEvent } from '@parapente/shared';

describe('Eventos Service', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  // Since 'listeners' is a module-level set, we want to clear it between tests.
  // The easiest way is to mock it out or just rely on the unsubscribe functionality.
  // Better approach: we'll track all subscriptions and unsubscribe them.
  let unsubscribers: Array<() => void> = [];

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    unsubscribers = [];
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    // Clean up all listeners to avoid cross-test pollution
    unsubscribers.forEach((unsub) => unsub());
  });

  describe('subscribe and broadcast', () => {
    it('should add a listener and notify it on broadcast', () => {
      const listener = vi.fn();
      const unsubscribe = subscribe(listener);
      unsubscribers.push(unsubscribe);

      const event: SSEEvent = { type: 'ping' };
      broadcast(event);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(event);
    });

    it('should not notify listener after unsubscribe', () => {
      const listener = vi.fn();
      const unsubscribe = subscribe(listener);

      unsubscribe(); // un-subscribe immediately

      const event: SSEEvent = { type: 'ping' };
      broadcast(event);

      expect(listener).not.toHaveBeenCalled();
    });

    it('should continue broadcasting to other listeners if one throws an error', () => {
      const failingListener = vi.fn().mockImplementation(() => {
        throw new Error('Listener error');
      });
      const successfulListener = vi.fn();

      const unsub1 = subscribe(failingListener);
      const unsub2 = subscribe(successfulListener);
      unsubscribers.push(unsub1, unsub2);

      const event: SSEEvent = { type: 'ping' };

      // Should not throw Error 'Listener error' outwards
      expect(() => broadcast(event)).not.toThrow();

      expect(failingListener).toHaveBeenCalledTimes(1);
      expect(successfulListener).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledWith('Error broadcasting event:', expect.any(Error));
    });
  });

  describe('helper broadcasters', () => {
    it('should broadcast datos-cambios correctly', () => {
      const listener = vi.fn();
      const unsubscribe = subscribe(listener);
      unsubscribers.push(unsubscribe);

      broadcastDatos('reserva', 'update');

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith({
        type: 'datos-cambios',
        entidad: 'reserva',
        accion: 'update',
      });
    });

    it('should broadcast modulos-cambios correctly', () => {
      const listener = vi.fn();
      const unsubscribe = subscribe(listener);
      unsubscribers.push(unsubscribe);

      broadcastModulos(['modulo1', 'modulo2']);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith({
        type: 'modulos-cambios',
        enabled: ['modulo1', 'modulo2'],
      });
    });
  });
});
