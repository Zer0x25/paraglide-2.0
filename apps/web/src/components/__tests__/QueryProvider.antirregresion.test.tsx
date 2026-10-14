import { describe, it, expect } from 'vitest';
import { shouldPersistQuery } from '../QueryProvider';

describe('QueryProvider — shouldPersistQuery (Anti-regresión M-02)', () => {
  it('persiste queries de vuelos del calendario para soporte offline', () => {
    expect(shouldPersistQuery(['vuelos', 'calendario', '2026-08-01', '2026-08-31'])).toBe(true);
    expect(shouldPersistQuery(['vuelos', 'calendario'])).toBe(true);
  });

  it('excluye del persister otras queries de vuelos para evitar persistir colecciones volátiles', () => {
    expect(shouldPersistQuery(['vuelos'])).toBe(false);
    expect(shouldPersistQuery(['vuelos', 'activos'])).toBe(false);
    expect(shouldPersistQuery(['vuelos', 'detalle', 123])).toBe(false);
  });

  it('excluye queries de autenticación sensibles', () => {
    expect(shouldPersistQuery(['auth'])).toBe(false);
    expect(shouldPersistQuery(['auth', 'user'])).toBe(false);
  });

  it('permite persistir datos operativos clave (pilotos, reservas, tarifas)', () => {
    expect(shouldPersistQuery(['pilotos'])).toBe(true);
    expect(shouldPersistQuery(['reservas'])).toBe(true);
    expect(shouldPersistQuery(['tarifas'])).toBe(true);
  });
});
