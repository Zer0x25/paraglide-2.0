import { describe, it, expect } from 'vitest';
import { normalizarRut, normalizarNombre, esMismaPersona } from '../reservas/reservas.crud';

describe('reservas.crud utils', () => {
  describe('normalizarRut', () => {
    it('returns empty string for null, undefined, or empty string', () => {
      expect(normalizarRut(null)).toBe('');
      expect(normalizarRut(undefined)).toBe('');
      expect(normalizarRut('')).toBe('');
    });

    it('removes spaces, dots, and dashes', () => {
      expect(normalizarRut('12.345.678-K')).toBe('12345678k');
      expect(normalizarRut(' 12 345 678 - k ')).toBe('12345678k');
      expect(normalizarRut('1.2.3.4-5-6-7.8')).toBe('12345678');
    });

    it('converts to lowercase', () => {
      expect(normalizarRut('12345678K')).toBe('12345678k');
      expect(normalizarRut('ABCDEF')).toBe('abcdef');
    });

    it('keeps only alphanumeric characters', () => {
      expect(normalizarRut('12.345!@#$%^&*()_+={}|[]\\:";\'<>?,./678-K')).toBe('12345678k');
    });
  });

  describe('normalizarNombre', () => {
    it('returns empty string for null, undefined, or empty string', () => {
      expect(normalizarNombre(null)).toBe('');
      expect(normalizarNombre(undefined)).toBe('');
      expect(normalizarNombre('')).toBe('');
    });

    it('removes diacritics and tildes', () => {
      expect(normalizarNombre('Sebastián Pérez')).toBe('sebastian perez');
      expect(normalizarNombre('María José')).toBe('maria jose');
      expect(normalizarNombre('Üäöñ')).toBe('uaon');
    });

    it('normalizes spaces (trims and removes multiple spaces)', () => {
      expect(normalizarNombre('  Juan   Perez  ')).toBe('juan perez');
      expect(normalizarNombre('\tPedro\n\nGonzález\r')).toBe('pedro gonzalez');
    });

    it('converts to lowercase', () => {
      expect(normalizarNombre('JUAN PEREZ')).toBe('juan perez');
      expect(normalizarNombre('JuAn PeReZ')).toBe('juan perez');
    });
  });

  describe('esMismaPersona', () => {
    it('returns false if either name is missing or resolves to empty', () => {
      expect(esMismaPersona({ nombre: '' }, { nombre: 'Juan' })).toBe(false);
      expect(esMismaPersona({ nombre: 'Juan' }, { nombre: '' })).toBe(false);
      expect(esMismaPersona({ nombre: '   ' }, { nombre: 'Juan' })).toBe(false);
    });

    it('returns true if both names and RUTs match (after normalization)', () => {
      expect(
        esMismaPersona(
          { nombre: 'Sebastián Pérez', rutDni: '12.345.678-K' },
          { nombre: 'sebastian perez', rutDni: '12345678k' },
        ),
      ).toBe(true);
    });

    it('returns false if RUTs differ', () => {
      expect(
        esMismaPersona(
          { nombre: 'Juan Perez', rutDni: '11111111-1' },
          { nombre: 'Juan Perez', rutDni: '22222222-2' },
        ),
      ).toBe(false);
    });

    it('returns false if RUTs match but names differ', () => {
      expect(
        esMismaPersona(
          { nombre: 'Juan Perez', rutDni: '11111111-1' },
          { nombre: 'Pedro Gonzalez', rutDni: '11111111-1' },
        ),
      ).toBe(false);
    });

    it('returns true if one or both lack RUTs and names match', () => {
      expect(
        esMismaPersona({ nombre: 'María José' }, { nombre: 'maria jose', rutDni: '11111111-1' }),
      ).toBe(true);

      expect(
        esMismaPersona({ nombre: 'María José', rutDni: '11111111-1' }, { nombre: 'maria jose' }),
      ).toBe(true);

      expect(esMismaPersona({ nombre: 'María José' }, { nombre: 'maria jose' })).toBe(true);
    });

    it('returns false if one or both lack RUTs and names differ', () => {
      expect(
        esMismaPersona({ nombre: 'María José' }, { nombre: 'Juan Perez', rutDni: '11111111-1' }),
      ).toBe(false);
      expect(esMismaPersona({ nombre: 'María José' }, { nombre: 'Juan Perez' })).toBe(false);
    });
  });
});
