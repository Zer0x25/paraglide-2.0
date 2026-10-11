import { describe, it, expect } from 'vitest';
import { normalizarNombre } from '../reservas/reservas.crud';

describe('reservas.crud', () => {
  describe('normalizarNombre', () => {
    it('handles null, undefined, and empty string', () => {
      expect(normalizarNombre(null)).toBe('');
      expect(normalizarNombre(undefined)).toBe('');
      expect(normalizarNombre('')).toBe('');
    });

    it('returns lowercase name for standard names', () => {
      expect(normalizarNombre('Juan Perez')).toBe('juan perez');
    });

    it('removes accents and diacritics', () => {
      expect(normalizarNombre('Sebastián Pérez')).toBe('sebastian perez');
      expect(normalizarNombre('María José')).toBe('maria jose');
      expect(normalizarNombre('René')).toBe('rene');
      expect(normalizarNombre('Héctor')).toBe('hector');
      expect(normalizarNombre('Raúl')).toBe('raul');
      expect(normalizarNombre('Iñaki')).toBe('inaki');
    });

    it('removes extra spaces', () => {
      expect(normalizarNombre('  Juan   Perez  ')).toBe('juan perez');
      expect(normalizarNombre('Maria    Jose')).toBe('maria jose');
    });

    it('handles complex combinations of uppercase, accents, and spaces', () => {
      expect(normalizarNombre('  SEBASTIÁN   PÉREZ  ')).toBe('sebastian perez');
      expect(normalizarNombre('  María    JOSÉ  ')).toBe('maria jose');
    });
  });
});
