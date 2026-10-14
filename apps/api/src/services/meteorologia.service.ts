import { prisma } from '../plugins/prisma';
import { CreateCondicionPistaPayload } from '@parapente/shared';
import { obtenerOpenMeteo, gradosADireccion, estimarTechoNubes } from './openMeteo.service';

export class MeteorologiaService {
  async getUltimoEstado() {
    const ultimo = await prisma.condicionPista.findFirst({
      where: { deletedAt: null },
      orderBy: { fechaHora: 'desc' },
    });

    if (!ultimo) {
      return null;
    }

    return ultimo;
  }

  async getHistorial(limit = 30) {
    return prisma.condicionPista.findMany({
      where: { deletedAt: null },
      orderBy: { fechaHora: 'desc' },
      take: limit,
    });
  }

  async registrar(data: CreateCondicionPistaPayload) {
    return prisma.condicionPista.create({
      data: {
        estadoPista: data.estadoPista,
        velocidadViento: data.velocidadViento,
        rachaViento: data.rachaViento,
        direccionViento: data.direccionViento,
        temperatura: data.temperatura,
        visibilidad: data.visibilidad || 'EXCELENTE',
        techoNubes: data.techoNubes,
        nubosidad: data.nubosidad ?? null,
        indiceUv: data.indiceUv,
        observaciones: data.observaciones,
        registradoPor: data.registradoPor || 'Director de Vuelo',
      },
    });
  }

  /**
   * Consulta Open-Meteo y mapea la respuesta al shape de CreateCondicionPistaPayload.
   * No persiste: es un "pronóstico en vivo" para el frontend. Retorna null si la API falla.
   */
  async obtenerPronosticoOpenMeteo(): Promise<CreateCondicionPistaPayload> {
    const datos = await obtenerOpenMeteo();
    if (!datos) {
      throw new Error('No se pudo obtener el pronóstico de Open-Meteo en este momento.');
    }

    const c = datos.current;
    const horaLocal = c.time
      ? new Date(c.time).toLocaleTimeString('es-CL')
      : new Date().toLocaleTimeString('es-CL');

    // Respetar el último estado manual de pista si fue CERRADA o PRECAUCION,
    // o derivar alerta por viento/racha extremos (>35 km/h CERRADA, >25 km/h PRECAUCION).
    const ultimo = await this.getUltimoEstado();
    const viento = c.wind_speed_10m ?? 0;
    const racha = c.wind_gusts_10m ?? 0;
    let estadoDerivado: 'ABIERTA' | 'PRECAUCION' | 'CERRADA' = 'ABIERTA';
    if (viento >= 35 || racha >= 45) {
      estadoDerivado = 'CERRADA';
    } else if (viento >= 25 || racha >= 35) {
      estadoDerivado = 'PRECAUCION';
    }
    if (ultimo && ultimo.registradoPor !== 'Open-Meteo' && ultimo.estadoPista !== 'ABIERTA') {
      estadoDerivado = ultimo.estadoPista;
    }

    return {
      estadoPista: estadoDerivado,
      velocidadViento: c.wind_speed_10m ?? null,
      rachaViento: c.wind_gusts_10m ?? null,
      direccionViento: gradosADireccion(c.wind_direction_10m),
      temperatura: c.temperature_2m ?? null,
      visibilidad: 'EXCELENTE',
      techoNubes: estimarTechoNubes(c.cloud_cover),
      nubosidad: c.cloud_cover != null ? Math.round(c.cloud_cover) : null,
      indiceUv: c.uv_index ?? null,
      observaciones: `Pronóstico automático Open-Meteo (${horaLocal})`,
      registradoPor: 'Open-Meteo',
    };
  }
}

export const meteorologiaService = new MeteorologiaService();
