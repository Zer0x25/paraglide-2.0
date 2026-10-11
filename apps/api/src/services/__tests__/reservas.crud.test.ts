import { describe, it, expect } from 'vitest';
import { normalizarRut, normalizarNombre, esMismaPersona } from '../reservas/reservas.crud';

describe('reservas.crud', () => {
  describe('normalizarRut', () => {
    it('debe retornar string vacio si el rut es nulo o indefinido', () => {
      expect(normalizarRut(null)).toBe('');
      expect(normalizarRut(undefined)).toBe('');
      expect(normalizarRut('')).toBe('');
    });

    it('debe eliminar puntos, guiones y espacios', () => {
      expect(normalizarRut('12.345.678-9')).toBe('123456789');
      expect(normalizarRut('12 345 678 - 9')).toBe('123456789');
    });

    it('debe convertir todo a minusculas (ej. manejar la letra K)', () => {
      expect(normalizarRut('12.345.678-K')).toBe('12345678k');
      expect(normalizarRut('12345678K')).toBe('12345678k');
    });

    it('debe eliminar caracteres no alfanumericos', () => {
      expect(normalizarRut('12.345.678-9!')).toBe('123456789');
    });
  });

  describe('normalizarNombre', () => {
    it('debe retornar string vacio si el nombre es nulo o indefinido', () => {
      expect(normalizarNombre(null)).toBe('');
      expect(normalizarNombre(undefined)).toBe('');
      expect(normalizarNombre('')).toBe('');
    });

    it('debe eliminar tildes y diacriticos', () => {
      expect(normalizarNombre('Sebastián')).toBe('sebastian');
      expect(normalizarNombre('María José')).toBe('maria jose');
      expect(normalizarNombre('Pérez')).toBe('perez');
      expect(normalizarNombre('Aéreo')).toBe('aereo');
      expect(normalizarNombre('Niña')).toBe('nina');
    });

    it('debe convertir todo a minusculas', () => {
      expect(normalizarNombre('JUAN PEREZ')).toBe('juan perez');
    });

    it('debe eliminar espacios redundantes', () => {
      expect(normalizarNombre('  Sebastián  Pérez  ')).toBe('sebastian perez');
    });
  });

  describe('esMismaPersona', () => {
    it('debe retornar falso si alguno de los nombres esta vacio', () => {
      expect(esMismaPersona({ nombre: '' }, { nombre: 'Juan' })).toBe(false);
      expect(esMismaPersona({ nombre: 'Juan' }, { nombre: '' })).toBe(false);
      expect(esMismaPersona({ nombre: '' }, { nombre: '' })).toBe(false);
    });

    describe('cuando ambos tienen RUT', () => {
      it('debe retornar falso si los RUTs son diferentes', () => {
        const a = { nombre: 'Juan Perez', rutDni: '11.111.111-1' };
        const b = { nombre: 'Juan Perez', rutDni: '22.222.222-2' };
        expect(esMismaPersona(a, b)).toBe(false);
      });

      it('debe retornar falso si tienen el mismo RUT pero nombres diferentes', () => {
        const a = { nombre: 'Juan Perez', rutDni: '11.111.111-1' };
        const b = { nombre: 'Pedro Gomez', rutDni: '11.111.111-1' };
        expect(esMismaPersona(a, b)).toBe(false);
      });

      it('debe retornar verdadero si tienen el mismo RUT y el mismo nombre normalizado', () => {
        const a = { nombre: '  Juan  Pérez ', rutDni: '11.111.111-1' };
        const b = { nombre: 'juan perez', rutDni: '11111111-1' };
        expect(esMismaPersona(a, b)).toBe(true);
      });
    });

    describe('cuando uno o ambos NO tienen RUT', () => {
      it('debe validar solo por nombre normalizado (ambos sin RUT)', () => {
        const a = { nombre: 'María José' };
        const b = { nombre: 'maria jose' };
        expect(esMismaPersona(a, b)).toBe(true);

        const c = { nombre: 'María José' };
        const d = { nombre: 'María Teresa' };
        expect(esMismaPersona(c, d)).toBe(false);
      });

      it('debe validar solo por nombre normalizado (uno sin RUT)', () => {
        const a = { nombre: 'María José', rutDni: '12.345.678-9' };
        const b = { nombre: 'maria jose' };
        expect(esMismaPersona(a, b)).toBe(true);

        const c = { nombre: 'María José', rutDni: '12.345.678-9' };
        const d = { nombre: 'María Teresa' };
        expect(esMismaPersona(c, d)).toBe(false);
      });
    });
  });
});
