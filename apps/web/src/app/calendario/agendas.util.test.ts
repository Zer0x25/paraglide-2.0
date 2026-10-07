import { describe, it, expect } from 'vitest';
import {
  horaLocalHHMM,
  esMismoDia,
  dateKeyLocal,
  vueloEnBloque,
  pilotosDisponiblesDia,
  agruparVuelosPorPiloto,
  agruparVuelosPorLista,
  pilotosLibresEnBloque,
  type VueloVista,
  type PilotoDia,
} from './agendas.util';
import { fechaHoraLocalToIso } from '@parapente/shared';

// ---------------------------------------------------------------------------
// Helpers de fixture. Se construyen con `fechaHoraLocalToIso` (hora local Santiago)
// para garantizar paridad absoluta tanto en local como en CI con TZ=UTC.
// ---------------------------------------------------------------------------

/** ISO de una fecha/hora LOCAL fija (2026-08-29 en America/Santiago). */
const isoDe = (y: number, mo: number, d: number, h: number, mi: number): string => {
  const mStr = String(mo + 1).padStart(2, '0');
  const dStr = String(d).padStart(2, '0');
  const hStr = String(h).padStart(2, '0');
  const miStr = String(mi).padStart(2, '0');
  return fechaHoraLocalToIso(`${y}-${mStr}-${dStr}`, `${hStr}:${miStr}`);
};

/** DateKey local YYYY-MM-DD usando la fuente única de verdad. */
const dateKeyDe = (d: Date | string): string => dateKeyLocal(d);

const vuelo = (overrides: Partial<VueloVista>): VueloVista => ({
  id: 1,
  pilotoId: 1,
  pasajeroId: 10,
  fechaHora: isoDe(2026, 7, 29, 10, 30),
  estado: 'AGENDADO',
  valorPactado: 50000,
  piloto: { nombre: 'Ana Piloto' },
  pasajero: { nombre: 'Juan Pérez' },
  ...overrides,
});

const piloto = (overrides: Partial<PilotoDia>): PilotoDia => ({
  id: 1,
  nombre: 'Ana Piloto',
  activo: true,
  prioridad: 1,
  disponibilidadTotal: true,
  excepciones: [],
  ...overrides,
});

describe('agendas.util — horaLocalHHMM', () => {
  it('devuelve la hora local HH:mm con padStart (horas y minutos de 1 dígito)', () => {
    expect(horaLocalHHMM(isoDe(2026, 7, 29, 9, 5))).toBe('09:05');
    expect(horaLocalHHMM(isoDe(2026, 7, 29, 0, 0))).toBe('00:00');
  });

  it('devuelve la hora local HH:mm sin tocar horas/minutos de 2 dígitos', () => {
    expect(horaLocalHHMM(isoDe(2026, 7, 29, 14, 30))).toBe('14:30');
    expect(horaLocalHHMM(isoDe(2026, 7, 29, 23, 59))).toBe('23:59');
  });
});

describe('agendas.util — esMismoDia', () => {
  it('true cuando el ISO pertenece al día local indicado', () => {
    const iso = isoDe(2026, 7, 29, 9, 5);
    expect(esMismoDia(iso, dateKeyDe(new Date(2026, 7, 29, 9, 5)))).toBe(true);
  });

  it('false cuando el ISO es de otro día local', () => {
    const iso = isoDe(2026, 7, 29, 9, 5);
    const key = dateKeyDe(new Date(2026, 7, 29, 9, 5));
    const otroKey = key === '2026-08-28' ? '2026-08-30' : '2026-08-28';
    expect(esMismoDia(iso, otroKey)).toBe(false);
  });

  it('compara un ISO fijo tipo "2026-08-29T14:30:00.000Z" contra su dateKey local (resta offset)', () => {
    const iso = '2026-08-29T14:30:00.000Z';
    const d = new Date(iso);
    const keyLocal = dateKeyDe(d);
    // La clave local calculada SIEMPRE debe matchear (robusto a cualquier TZ).
    expect(esMismoDia(iso, keyLocal)).toBe(true);
    const otroKey = keyLocal === '2026-08-29' ? '2026-08-30' : '2026-08-29';
    expect(esMismoDia(iso, otroKey)).toBe(false);
  });
});

describe('agendas.util — vueloEnBloque', () => {
  const dateKey = '2026-08-29';

  it('true para un vuelo dentro del intervalo [inicio, fin)', () => {
    expect(vueloEnBloque(vuelo({ fechaHora: isoDe(2026, 7, 29, 10, 30) }), dateKey, '10:00', '13:00')).toBe(true);
  });

  it('true justo en horaInicio (intervalo cerrado a la izquierda)', () => {
    expect(vueloEnBloque(vuelo({ fechaHora: isoDe(2026, 7, 29, 10, 0) }), dateKey, '10:00', '13:00')).toBe(true);
  });

  it('false justo en horaFin (intervalo semiabierto)', () => {
    expect(vueloEnBloque(vuelo({ fechaHora: isoDe(2026, 7, 29, 13, 0) }), dateKey, '10:00', '13:00')).toBe(false);
  });

  it('false para un vuelo anterior al bloque', () => {
    expect(vueloEnBloque(vuelo({ fechaHora: isoDe(2026, 7, 29, 9, 0) }), dateKey, '10:00', '13:00')).toBe(false);
  });

  it('false para un vuelo de otro día aunque la hora caiga en el rango', () => {
    expect(vueloEnBloque(vuelo({ fechaHora: isoDe(2026, 7, 28, 11, 0) }), dateKey, '10:00', '13:00')).toBe(false);
  });
});

describe('agendas.util — pilotosDisponiblesDia', () => {
  const dateKey = '2026-08-29';

  it('excluye al piloto con disponibilidadTotal y excepción ese día', () => {
    const p = piloto({ id: 1, disponibilidadTotal: true, excepciones: [{ fecha: '2026-08-29T00:00:00.000Z' }] });
    expect(pilotosDisponiblesDia([p], dateKey)).toHaveLength(0);
  });

  it('incluye al piloto con disponibilidadTotal false y excepción ese día', () => {
    const p = piloto({ id: 1, disponibilidadTotal: false, excepciones: [{ fecha: '2026-08-29T00:00:00.000Z' }] });
    const res = pilotosDisponiblesDia([p], dateKey);
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe(1);
  });

  it('excluye a pilotos inactivos', () => {
    const p = piloto({ id: 1, activo: false, excepciones: [{ fecha: '2026-08-29' }] });
    expect(pilotosDisponiblesDia([p], dateKey)).toHaveLength(0);
  });

  it('complemento: total sin excepción → disponible; parcial sin excepción → NO disponible', () => {
    const total = piloto({ id: 1, disponibilidadTotal: true, excepciones: [] });
    const parcial = piloto({ id: 2, nombre: 'Beto Piloto', disponibilidadTotal: false, excepciones: [] });
    const res = pilotosDisponiblesDia([total, parcial], dateKey);
    expect(res.map((p) => p.id)).toEqual([1]);
  });

  it('una excepción de otro día no afecta la disponibilidad', () => {
    const p = piloto({ id: 1, disponibilidadTotal: true, excepciones: [{ fecha: '2026-08-28T00:00:00.000Z' }] });
    expect(pilotosDisponiblesDia([p], dateKey)).toHaveLength(1);
  });
});

describe('agendas.util — agruparVuelosPorPiloto', () => {
  it('agrupa por pilotoId, solo vuelos del día y del bloque, orden alfabético por nombre', () => {
    const dateKey = '2026-08-29';
    const vuelos: VueloVista[] = [
      vuelo({ id: 2, pilotoId: 1, fechaHora: isoDe(2026, 7, 29, 10, 30), pasajero: { nombre: 'P2' } }),
      vuelo({ id: 3, pilotoId: 1, fechaHora: isoDe(2026, 7, 29, 12, 30), pasajero: { nombre: 'P3' } }),
      vuelo({ id: 1, pilotoId: 2, fechaHora: isoDe(2026, 7, 29, 11, 0), piloto: { nombre: 'Beto Piloto' }, pasajero: { nombre: 'P1' } }),
      // Fuera del bloque (09:00) y de otro día: no deben aparecer
      vuelo({ id: 4, pilotoId: 1, fechaHora: isoDe(2026, 7, 29, 9, 0), pasajero: { nombre: 'Fuera bloque' } }),
      vuelo({ id: 5, pilotoId: 3, fechaHora: isoDe(2026, 7, 28, 11, 0), piloto: { nombre: 'Carla Piloto' }, pasajero: { nombre: 'Otro día' } }),
    ];

    const grupos = agruparVuelosPorPiloto(vuelos, dateKey, '10:00', '13:00');

    expect(grupos).toHaveLength(2);
    // Orden alfabético por nombre (localeCompare es): Ana antes que Beto.
    expect(grupos[0].pilotoId).toBe(1);
    expect(grupos[0].nombre).toBe('Ana Piloto');
    expect(grupos[0].vuelos.map((v) => v.id)).toEqual([2, 3]);
    expect(grupos[1].pilotoId).toBe(2);
    expect(grupos[1].nombre).toBe('Beto Piloto');
    expect(grupos[1].vuelos.map((v) => v.id)).toEqual([1]);
  });

  it('devuelve [] si ningún vuelo cae en el bloque', () => {
    const grupos = agruparVuelosPorPiloto(
      [vuelo({ id: 1, fechaHora: isoDe(2026, 7, 29, 14, 0) })],
      '2026-08-29',
      '10:00',
      '13:00'
    );
    expect(grupos).toEqual([]);
  });
});

describe('agendas.util — agruparVuelosPorLista', () => {
  it('agrupa vuelos arbitrarios por piloto con orden alfabético', () => {
    const vuelos: VueloVista[] = [
      vuelo({ id: 2, pilotoId: 2, piloto: { nombre: 'Beto Piloto' }, fechaHora: isoDe(2026, 7, 29, 6, 0) }),
      vuelo({ id: 1, pilotoId: 1, piloto: { nombre: 'Ana Piloto' }, fechaHora: isoDe(2026, 7, 29, 7, 30) }),
    ];
    const grupos = agruparVuelosPorLista(vuelos);
    expect(grupos).toHaveLength(2);
    expect(grupos[0].nombre).toBe('Ana Piloto');
    expect(grupos[1].nombre).toBe('Beto Piloto');
  });
});

describe('agendas.util — pilotosLibresEnBloque', () => {
  it('cuenta solo los pilotos disponibles sin vuelos en el bloque', () => {
    const disponibles = [
      piloto({ id: 1 }),
      piloto({ id: 2, nombre: 'Beto Piloto' }),
      piloto({ id: 3, nombre: 'Carla Piloto' }),
    ];
    const carriles = [{ pilotoId: 1, nombre: 'Ana Piloto', vuelos: [] as VueloVista[] }];
    expect(pilotosLibresEnBloque(disponibles, carriles)).toBe(2);
  });

  it('0 cuando todos los pilotos disponibles ya tienen carril', () => {
    const disponibles = [piloto({ id: 1 })];
    const carriles = [{ pilotoId: 1, nombre: 'Ana Piloto', vuelos: [] as VueloVista[] }];
    expect(pilotosLibresEnBloque(disponibles, carriles)).toBe(0);
  });
});
