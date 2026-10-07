import { describe, it, expect } from 'vitest';
import { calcularStatsEquipos, filtrarEquipos } from '../equiposStats.util';
import type { EquipoDTO } from '@parapente/shared';

describe('equiposStats.util', () => {
  const baseEquipos = [
    {
      id: 1,
      codigo: 'VELA-01',
      nombre: 'Ozone Magnum 3',
      tipo: 'VELA',
      marca: 'Ozone',
      modelo: 'Magnum 3',
      numeroSerie: 'MG3-001',
      estado: 'OPERATIVO',
      horasVueloEstimadas: 30,
      vuelosRealizados: 50,
      limiteHorasInspeccion: 100,
      fechaProximaRevision: new Date('2026-12-01'),
      pilotoAsignado: { id: 1, nombre: 'Rodrigo' },
      mantenimientos: [],
    },
    {
      id: 2,
      codigo: 'RES-01',
      nombre: 'Companion SQR',
      tipo: 'PARACAIDAS_EMERGENCIA',
      marca: 'Companion',
      modelo: 'SQR 220',
      numeroSerie: 'SQR-001',
      estado: 'REVISION_PENDIENTE',
      horasVueloEstimadas: 99,
      vuelosRealizados: 110,
      limiteHorasInspeccion: 100,
      fechaProximaRevision: new Date('2026-09-25'),
      pilotoAsignado: null,
      mantenimientos: [],
    },
  ] as unknown as EquipoDTO[];

  describe('calcularStatsEquipos', () => {
    it('calcula totales, velas operativas, paracaídas y alertas correctamente', () => {
      const fechaRef = new Date('2026-09-20');
      const stats = calcularStatsEquipos(baseEquipos, fechaRef);

      expect(stats.total).toBe(2);
      expect(stats.velas).toBe(1);
      expect(stats.paracaidas).toBe(0); // REVISION_PENDIENTE, no OPERATIVO
      expect(stats.alertas).toBe(1); // RES-01 está en REVISION_PENDIENTE y revisión en 5 días
    });

    it('retorna ceros cuando la lista es nula o vacía', () => {
      const stats = calcularStatsEquipos(null);
      expect(stats).toEqual({ total: 0, velas: 0, paracaidas: 0, alertas: 0 });
    });
  });

  describe('filtrarEquipos', () => {
    it('filtra por término de búsqueda en nombre, código o piloto', () => {
      const resultado = filtrarEquipos(baseEquipos, {
        searchQuery: 'Ozone',
        tipoFilter: 'TODOS',
        estadoFilter: 'TODOS',
      });
      expect(resultado).toHaveLength(1);
      expect(resultado[0].codigo).toBe('VELA-01');
    });

    it('filtra por tipo y estado simultáneamente', () => {
      const resultado = filtrarEquipos(baseEquipos, {
        searchQuery: '',
        tipoFilter: 'PARACAIDAS_EMERGENCIA',
        estadoFilter: 'REVISION_PENDIENTE',
      });
      expect(resultado).toHaveLength(1);
      expect(resultado[0].codigo).toBe('RES-01');
    });
  });
});
