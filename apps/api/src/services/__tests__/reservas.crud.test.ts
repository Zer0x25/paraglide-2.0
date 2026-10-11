import { describe, it, expect } from 'vitest';
import { esMismaPersona } from '../reservas/reservas.crud';

describe('reservas.crud', () => {
  describe('esMismaPersona', () => {
    it('debería retornar false si el nombre está vacío en cualquiera de los inputs', () => {
      expect(esMismaPersona({ nombre: '' }, { nombre: 'Juan Perez' })).toBe(false);
      expect(esMismaPersona({ nombre: 'Juan Perez' }, { nombre: '' })).toBe(false);
      expect(esMismaPersona({ nombre: '' }, { nombre: '' })).toBe(false);
    });

    it('debería retornar true si tienen el mismo nombre y ninguno tiene RUT', () => {
      expect(esMismaPersona({ nombre: 'Juan Perez' }, { nombre: 'Juan Perez' })).toBe(true);
      expect(esMismaPersona({ nombre: 'Juan Perez', rutDni: null }, { nombre: 'Juan Perez', rutDni: undefined })).toBe(true);
    });

    it('debería retornar false si tienen distinto nombre y ninguno tiene RUT', () => {
      expect(esMismaPersona({ nombre: 'Juan Perez' }, { nombre: 'Pedro Gomez' })).toBe(false);
    });

    it('debería retornar true si tienen el mismo nombre y uno no tiene RUT', () => {
      expect(esMismaPersona({ nombre: 'Juan Perez', rutDni: '12345678-9' }, { nombre: 'Juan Perez', rutDni: null })).toBe(true);
      expect(esMismaPersona({ nombre: 'Juan Perez', rutDni: null }, { nombre: 'Juan Perez', rutDni: '12345678-9' })).toBe(true);
    });

    it('debería retornar false si tienen distinto nombre y uno no tiene RUT', () => {
      expect(esMismaPersona({ nombre: 'Juan Perez', rutDni: '12345678-9' }, { nombre: 'Pedro Gomez', rutDni: null })).toBe(false);
    });

    it('debería retornar true si tienen el mismo nombre y el mismo RUT', () => {
      expect(esMismaPersona({ nombre: 'Juan Perez', rutDni: '12345678-9' }, { nombre: 'Juan Perez', rutDni: '12345678-9' })).toBe(true);
    });

    it('debería retornar false si tienen el mismo RUT pero distinto nombre', () => {
      // Though legally they might be the same person, the function is currently checking both.
      // `if (normRutA && normRutB) { if (normRutA !== normRutB) return false; return normNombreA === normNombreB; }`
      // So if RUT is same, but name is different, it returns false.
      expect(esMismaPersona({ nombre: 'Juan Perez', rutDni: '12345678-9' }, { nombre: 'Pedro Gomez', rutDni: '12345678-9' })).toBe(false);
    });

    it('debería retornar false si tienen distinto RUT, sin importar el nombre', () => {
      expect(esMismaPersona({ nombre: 'Juan Perez', rutDni: '12345678-9' }, { nombre: 'Juan Perez', rutDni: '98765432-1' })).toBe(false);
      expect(esMismaPersona({ nombre: 'Juan Perez', rutDni: '12345678-9' }, { nombre: 'Pedro Gomez', rutDni: '98765432-1' })).toBe(false);
    });

    it('debería normalizar nombres manejando mayúsculas, minúsculas, espacios y tildes', () => {
      const a = { nombre: '  Júân Péréz  ', rutDni: null };
      const b = { nombre: 'juan perez', rutDni: null };
      expect(esMismaPersona(a, b)).toBe(true);

      const c = { nombre: 'MARIA   JOSE', rutDni: null };
      const d = { nombre: 'maría josé', rutDni: null };
      expect(esMismaPersona(c, d)).toBe(true);
    });

    it('debería normalizar RUTs manejando guiones, puntos y mayúsculas/minúsculas', () => {
      const a = { nombre: 'Juan', rutDni: '12.345.678-k' };
      const b = { nombre: 'juan', rutDni: '12345678K' };
      expect(esMismaPersona(a, b)).toBe(true);
    });
  });
});
