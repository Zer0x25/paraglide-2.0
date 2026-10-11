import { describe, it, expect, vi, beforeEach } from 'vitest';
import { subscribe, broadcast, broadcastDatos, broadcastModulos } from '../eventos.service';

describe('Eventos Service', () => {
  beforeEach(() => {
    // There isn't an exposed way to clear listeners, so we rely on removing them cleanly
    vi.restoreAllMocks();
  });

  describe('subscribe', () => {
    it('should add a listener and return an unsubscribe function', () => {
      const listener = vi.fn();
      const unsubscribe = subscribe(listener);

      broadcast({ type: 'modulos-cambios', enabled: [] });
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();
      broadcast({ type: 'modulos-cambios', enabled: [] });
      expect(listener).toHaveBeenCalledTimes(1); // Should not increase
    });
  });

  describe('broadcast', () => {
    it('should call all subscribed listeners with the given event', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      const unsubscribe1 = subscribe(listener1);
      const unsubscribe2 = subscribe(listener2);

      const event = { type: 'modulos-cambios' as const, enabled: ['module1'] };
      broadcast(event);

      expect(listener1).toHaveBeenCalledWith(event);
      expect(listener2).toHaveBeenCalledWith(event);

      unsubscribe1();
      unsubscribe2();
    });

    it('should catch errors from faulty listeners and call console.warn without breaking other listeners', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const faultyListener = vi.fn(() => {
        throw new Error('Listener error');
      });
      const goodListener = vi.fn();

      const unsubscribe1 = subscribe(faultyListener);
      const unsubscribe2 = subscribe(goodListener);

      const event = { type: 'modulos-cambios' as const, enabled: [] };
      broadcast(event);

      expect(faultyListener).toHaveBeenCalledWith(event);
      expect(warnSpy).toHaveBeenCalledWith('Error broadcasting event:', expect.any(Error));
      expect(goodListener).toHaveBeenCalledWith(event);

      unsubscribe1();
      unsubscribe2();
    });
  });

  describe('broadcastDatos', () => {
    it('should emit a datos-cambios event with the correct properties', () => {
      const listener = vi.fn();
      const unsubscribe = subscribe(listener);

      const entidad = 'reserva';
      const accion = 'crear';

      broadcastDatos(entidad, accion);

      expect(listener).toHaveBeenCalledWith({
        type: 'datos-cambios',
        entidad,
        accion,
      });

      unsubscribe();
    });
  });

  describe('broadcastModulos', () => {
    it('should emit a modulos-cambios event with the enabled modules', () => {
      const listener = vi.fn();
      const unsubscribe = subscribe(listener);

      const enabled = ['moduleA', 'moduleB'];

      broadcastModulos(enabled);

      expect(listener).toHaveBeenCalledWith({
        type: 'modulos-cambios',
        enabled,
      });

      unsubscribe();
    });
  });
});
