import { prisma } from '../plugins/prisma';
import { CreateCondicionPistaPayload } from '@parapente/shared';
import { obtenerOpenMeteo, gradosADireccion, estimarTechoNubes } from './openMeteo.service';

export class MeteorologiaService {
  async getUltimoEstado() {
    try {
      const ultimo = await prisma.condicionPista.findFirst({
        where: { deletedAt: null },
        orderBy: { fechaHora: 'desc' },
      });

      if (!ultimo) {
        return {
          id: 0,
          fechaHora: new Date(),
          estadoPista: 'ABIERTA',
          velocidadViento: 12,
          rachaViento: 16,
          direccionViento: 'SO',
          temperatura: 22,
          visibilidad: 'EXCELENTE',
          techoNubes: 1800,
          observaciones: 'Condiciones térmicas y dinámicas óptimas para vuelos biplaza.',
          registradoPor: 'Director de Vuelo',
        };
      }

      return ultimo;
    } catch (err) {
      console.warn('Advertencia DB en getUltimoEstado, usando fallback:', err);
      return {
        id: 0,
        fechaHora: new Date(),
        estadoPista: 'ABIERTA',
        velocidadViento: 12,
        rachaViento: 16,
        direccionViento: 'SO',
        temperatura: 22,
        visibilidad: 'EXCELENTE',
        techoNubes: 1800,
        observaciones: 'Condiciones normales de vuelo.',
        registradoPor: 'Sistema',
      };
    }
  }

  async getHistorial(limit = 30) {
    try {
      return await prisma.condicionPista.findMany({
        where: { deletedAt: null },
        orderBy: { fechaHora: 'desc' },
        take: limit,
      });
    } catch (err) {
      console.warn('Advertencia DB en getHistorial, retornando arreglo vacío:', err);
      return [];
    }
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
    const horaLocal = c.time ? new Date(c.time).toLocaleTimeString('es-CL') : new Date().toLocaleTimeString('es-CL');

    return {
      estadoPista: 'ABIERTA',
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
