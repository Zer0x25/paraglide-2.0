import { describe, it, expect } from 'vitest';
import {
  getMonthDates,
  calculateOriginalAvailable,
  calculateDayState,
  buildInitialBlockOverrides,
  type PilotoDisponibilidad,
} from '../pilotoDisponibilidad.util';

describe('pilotoDisponibilidad.util', () => {
  describe('getMonthDates', () => {
    it('genera todas las fechas en formato YYYY-MM-DD para septiembre (30 días)', () => {
      const fecha = new Date(2026, 8, 1); // mes 8 es septiembre
      const fechas = getMonthDates(fecha);
      expect(fechas).toHaveLength(30);
      expect(fechas[0]).toBe('2026-09-01');
      expect(fechas[29]).toBe('2026-09-30');
    });

    it('genera 28 días para febrero en año no bisiesto', () => {
      const fecha = new Date(2025, 1, 1);
      const fechas = getMonthDates(fecha);
      expect(fechas).toHaveLength(28);
    });
  });

  describe('calculateOriginalAvailable', () => {
    const dispTotal: PilotoDisponibilidad = {
      id: 1,
      disponibilidadTotal: true,
      version: 1,
      excepciones: [{ fecha: '2026-09-15' }],
      disponibilidadBloques: [],
    };

    it('retorna true si disponibilidadTotal es true y no hay excepción para la fecha', () => {
      expect(calculateOriginalAvailable('2026-09-10', dispTotal)).toBe(true);
    });

    it('retorna false si disponibilidadTotal es true pero hay excepción para la fecha', () => {
      expect(calculateOriginalAvailable('2026-09-15', dispTotal)).toBe(false);
    });

    it('retorna true por defecto si no hay objeto de disponibilidad cargado', () => {
      expect(calculateOriginalAvailable('2026-09-15', null)).toBe(true);
    });

    it('invierte la lógica si disponibilidadTotal es false', () => {
      const dispParcial: PilotoDisponibilidad = {
        id: 2,
        disponibilidadTotal: false,
        version: 1,
        excepciones: [{ fecha: '2026-09-20' }],
        disponibilidadBloques: [],
      };
      expect(calculateOriginalAvailable('2026-09-20', dispParcial)).toBe(true);
      expect(calculateOriginalAvailable('2026-09-21', dispParcial)).toBe(false);
    });
  });

  describe('calculateDayState', () => {
    it('retorna "full" si todos los bloques están seleccionados', () => {
      const blockOverrides = {
        '2026-09-10': { '10:00': true, '11:00': true },
      };
      const state = calculateDayState('2026-09-10', 2, blockOverrides, false);
      expect(state).toBe('full');
    });

    it('retorna "partial" si solo algunos bloques están seleccionados', () => {
      const blockOverrides = {
        '2026-09-10': { '10:00': true },
      };
      const state = calculateDayState('2026-09-10', 2, blockOverrides, false);
      expect(state).toBe('partial');
    });

    it('retorna "none" si hay override sin selecciones', () => {
      const blockOverrides = {
        '2026-09-10': {},
      };
      const state = calculateDayState('2026-09-10', 2, blockOverrides, true);
      expect(state).toBe('none');
    });

    it('usa desiredAvailable si no hay block overrides', () => {
      expect(calculateDayState('2026-09-10', 2, {}, true)).toBe('full');
      expect(calculateDayState('2026-09-10', 2, {}, false)).toBe('none');
    });
  });

  describe('buildInitialBlockOverrides', () => {
    it('ignora fechas que tengan todos los bloques seleccionados para no saturar overrides', () => {
      const disp: PilotoDisponibilidad = {
        id: 1,
        disponibilidadTotal: true,
        version: 1,
        excepciones: [],
        disponibilidadBloques: [
          { fecha: '2026-09-10', horaInicio: '10:00', horaFin: '11:00' },
          { fecha: '2026-09-10', horaInicio: '11:00', horaFin: '12:00' },
        ],
      };
      // total = 2, selected = 2 -> no es override parcial
      const overrides = buildInitialBlockOverrides(disp, () => 2);
      expect(overrides['2026-09-10']).toBeUndefined();
    });

    it('construye mapa de override cuando la selección es estrictamente parcial', () => {
      const disp: PilotoDisponibilidad = {
        id: 1,
        disponibilidadTotal: true,
        version: 1,
        excepciones: [],
        disponibilidadBloques: [
          { fecha: '2026-09-10', horaInicio: '10:00', horaFin: '11:00' },
        ],
      };
      // total = 2, selected = 1 -> override parcial
      const overrides = buildInitialBlockOverrides(disp, () => 2);
      expect(overrides['2026-09-10']).toBeDefined();
      expect(overrides['2026-09-10']['10:00']).toBe(true);
    });
  });
});
