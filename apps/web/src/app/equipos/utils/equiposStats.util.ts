import type { EquipoDTO } from '@parapente/shared';

export interface EquiposStats {
  total: number;
  velas: number;
  paracaidas: number;
  alertas: number;
}

export function calcularStatsEquipos(equipos?: EquipoDTO[] | null, fechaReferencia: Date = new Date()): EquiposStats {
  const list = equipos || [];
  const total = list.length;
  const velas = list.filter((e) => e.tipo === 'VELA' && e.estado === 'OPERATIVO').length;
  const paracaidas = list.filter(
    (e) => e.tipo === 'PARACAIDAS_EMERGENCIA' && e.estado === 'OPERATIVO'
  ).length;

  const en15Dias = new Date(fechaReferencia);
  en15Dias.setDate(en15Dias.getDate() + 15);

  const alertas = list.filter((e) => {
    if (e.estado === 'REVISION_PENDIENTE' || e.estado === 'EN_MANTENIMIENTO') return true;
    if (e.limiteHorasInspeccion && e.horasVueloEstimadas >= e.limiteHorasInspeccion) return true;
    if (e.fechaProximaRevision) {
      const prox = new Date(e.fechaProximaRevision);
      if (prox <= en15Dias) return true;
    }
    return false;
  }).length;

  return { total, velas, paracaidas, alertas };
}

export function filtrarEquipos(
  equipos?: EquipoDTO[] | null,
  filtros: { searchQuery: string; tipoFilter: string; estadoFilter: string } = {
    searchQuery: '',
    tipoFilter: 'TODOS',
    estadoFilter: 'TODOS',
  }
): EquipoDTO[] {
  const list = equipos || [];
  const { searchQuery, tipoFilter, estadoFilter } = filtros;
  const q = searchQuery.toLowerCase().trim();

  return list.filter((e) => {
    if (tipoFilter !== 'TODOS' && e.tipo !== tipoFilter) return false;
    if (estadoFilter !== 'TODOS' && e.estado !== estadoFilter) return false;

    if (q) {
      const matchCodigo = e.codigo.toLowerCase().includes(q);
      const matchNombre = e.nombre.toLowerCase().includes(q);
      const matchMarca = e.marca ? e.marca.toLowerCase().includes(q) : false;
      const matchSerie = e.numeroSerie ? e.numeroSerie.toLowerCase().includes(q) : false;
      const matchPiloto = e.pilotoAsignado?.nombre
        ? e.pilotoAsignado.nombre.toLowerCase().includes(q)
        : false;

      return matchCodigo || matchNombre || matchMarca || matchSerie || matchPiloto;
    }

    return true;
  });
}
