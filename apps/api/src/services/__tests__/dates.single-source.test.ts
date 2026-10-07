import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TIMEZONE,
  dateKeyLocal,
  horaLocalHHMM,
  esMismoDia,
  fechaHoraLocalToIso,
  formatFechaEspanol,
  buildGoogleCalendarUrl,
} from '@parapente/shared';

describe('Single Source of Truth: Date & Time Canonical Tests', () => {
  it('DEFAULT_TIMEZONE es canónicamente America/Santiago', () => {
    expect(DEFAULT_TIMEZONE).toBe('America/Santiago');
  });

  describe('dateKeyLocal - Inmunidad ante saltos de día (-1 día / día 14 -> día 13)', () => {
    it('un string YYYY-MM-DD directo ("2026-09-14") NUNCA salta al día 13', () => {
      expect(dateKeyLocal('2026-09-14')).toBe('2026-09-14');
      expect(dateKeyLocal('2026-01-01')).toBe('2026-01-01');
      expect(dateKeyLocal('2026-12-31')).toBe('2026-12-31');
    });

    it('un ISO de medianoche UTC ("2026-09-14T00:00:00.000Z") preserva el día 14 original del usuario', () => {
      // Este era el bug donde un DatePicker convertía el string a medianoche UTC
      // y al anochecer en Chile saltaba a las 21:00 del día 13.
      expect(dateKeyLocal('2026-09-14T00:00:00.000Z')).toBe('2026-09-14');
      expect(dateKeyLocal('2026-09-14T00:00:00Z')).toBe('2026-09-14');
    });

    it('un vuelo agendado a las 14:00 (guardado como 17:00 UTC) pertenece al día 14 en America/Santiago', () => {
      const isoUtc = fechaHoraLocalToIso('2026-09-14', '14:00');
      expect(dateKeyLocal(isoUtc)).toBe('2026-09-14');
    });

    it('con Date object evalúa al día civil correspondiente', () => {
      const d = new Date(2026, 8, 14, 12, 0); // mediodía local
      expect(dateKeyLocal(d)).toBe('2026-09-14');
    });

    it('con null o undefined retorna el día de hoy', () => {
      const hoy = dateKeyLocal();
      expect(hoy).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(dateKeyLocal(null)).toBe(hoy);
      expect(dateKeyLocal(undefined)).toBe(hoy);
    });
  });

  describe('horaLocalHHMM - Paridad absoluta entre entornos y zonas horarias', () => {
    it('normaliza horas directas con 2 dígitos (ej: "14:00", "9:05")', () => {
      expect(horaLocalHHMM('14:00')).toBe('14:00');
      expect(horaLocalHHMM('9:05')).toBe('09:05');
      expect(horaLocalHHMM('09:30')).toBe('09:30');
    });

    it('un vuelo agendado a las 14:00 local siempre se extrae como "14:00" desde su ISO UTC', () => {
      const iso = fechaHoraLocalToIso('2026-09-14', '14:00');
      expect(horaLocalHHMM(iso)).toBe('14:00');
    });

    it('soporta bloques de mañana, tarde y noche sin ambigüedad', () => {
      const isoManana = fechaHoraLocalToIso('2026-09-14', '09:30');
      expect(horaLocalHHMM(isoManana)).toBe('09:30');

      const isoTarde = fechaHoraLocalToIso('2026-09-14', '16:45');
      expect(horaLocalHHMM(isoTarde)).toBe('16:45');
    });
  });

  describe('esMismoDia - Validación canónica', () => {
    it('detecta correctamente vuelos del mismo día local', () => {
      const iso = fechaHoraLocalToIso('2026-09-14', '14:00');
      expect(esMismoDia(iso, '2026-09-14')).toBe(true);
      expect(esMismoDia(iso, '2026-09-13')).toBe(false);
      expect(esMismoDia(iso, '2026-09-15')).toBe(false);
    });
  });

  describe('formatFechaEspanol - Presentación legible sin pérdida de día', () => {
    it('formatea "2026-09-14" mostrando septiembre y sin saltar al 13', () => {
      const txt = formatFechaEspanol('2026-09-14');
      expect(txt.toLowerCase()).toContain('14');
      expect(txt.toLowerCase()).toContain('septiembre');
      expect(txt.toLowerCase()).toContain('2026');
      expect(txt.toLowerCase()).not.toContain('13');
    });

    it('formatea un ISO de medianoche UTC sin retroceder de día', () => {
      const txt = formatFechaEspanol('2026-09-14T00:00:00.000Z');
      expect(txt.toLowerCase()).toContain('14');
      expect(txt.toLowerCase()).toContain('septiembre');
    });
  });

  describe('buildGoogleCalendarUrl - Sincronización exacta con hora de bloque', () => {
    it('genera URL oficial con fechas en UTC exactas y timezone ctz=America/Santiago', () => {
      const urlStr = buildGoogleCalendarUrl({
        title: 'Vuelo en Parapente - Reserva #123',
        fecha: '2026-09-14',
        hora: '14:00',
        duracionMinutos: 60,
        details: 'Detalles de prueba',
        location: 'Pista Maitencillo',
      });

      const url = new URL(urlStr);
      expect(url.hostname).toBe('calendar.google.com');
      expect(url.searchParams.get('action')).toBe('TEMPLATE');
      expect(url.searchParams.get('text')).toBe('Vuelo en Parapente - Reserva #123');
      expect(url.searchParams.get('ctz')).toBe('America/Santiago');
      expect(url.searchParams.get('location')).toBe('Pista Maitencillo');

      // Las fechas en dates no deben ser medianoche (000000Z)
      const dates = url.searchParams.get('dates') || '';
      expect(dates).not.toContain('000000Z');
      // Con GMT-3 en septiembre, 14:00 local es 17:00 UTC
      expect(dates).toContain('170000Z');
      expect(dates).toContain('180000Z');
    });

    it('si no se pasa hora, asigna por defecto 10:00 AM (no medianoche 00:00 UTC)', () => {
      const urlStr = buildGoogleCalendarUrl({
        title: 'Vuelo Pendiente',
        fecha: '2026-09-14',
      });

      const url = new URL(urlStr);
      const dates = url.searchParams.get('dates') || '';
      expect(dates).not.toContain('000000Z');
      // Con GMT-3, 10:00 local es 13:00 UTC
      expect(dates).toContain('130000Z');
    });
  });
});
