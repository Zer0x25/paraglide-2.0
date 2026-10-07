import { config } from '../config';

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';

export interface OpenMeteoCurrent {
  time: string;
  wind_speed_10m: number | null;
  wind_gusts_10m: number | null;
  wind_direction_10m: number | null;
  temperature_2m: number | null;
  cloud_cover: number | null;
  cloud_cover_low: number | null;
  cloud_cover_mid: number | null;
  cloud_cover_high: number | null;
  uv_index: number | null;
  uv_index_clear_sky: number | null;
}

export interface OpenMeteoResponse {
  latitude: number;
  longitude: number;
  current: OpenMeteoCurrent;
  current_units?: Record<string, string>;
}

/**
 * Convierte grados (0-360, 0=N, 90=E, 180=S, 270=W) a abreviatura de 2 letras.
 * El redondeo sobre sectores de 45° centra cada punto cardinal/ordinal.
 */
export function gradosADireccion(grados: number | null | undefined): string | null {
  if (grados == null || Number.isNaN(grados)) return null;
  const puntos = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  const indice = Math.round(((grados % 360) + 360) % 360 / 45) % 8;
  return puntos[indice];
}

/**
 * Estima el techo de nubes (metros) a partir de la cobertura total de nubes.
 * Heurística gruesa (no es un dato real de techo): 0% -> ~3000m; 100% -> ~300m.
 * No usar para decisiones de seguridad operacional sin validación humana.
 */
export function estimarTechoNubes(cloudCover: number | null | undefined): number | null {
  if (cloudCover == null || Number.isNaN(cloudCover)) return null;
  const cubierto = Math.min(100, Math.max(0, cloudCover));
  return Math.round(3000 - (cubierto / 100) * 2700);
}

/**
 * Consulta Open-Meteo (sin API key) para la ubicación del centro de vuelo.
 * Retorna null en caso de fallo de red/JSON para no romper el flujo.
 */
export async function obtenerOpenMeteo(
  lat: number = config.centroLat,
  lon: number = config.centroLon,
): Promise<OpenMeteoResponse | null> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current:
      'wind_speed_10m,wind_gusts_10m,wind_direction_10m,temperature_2m,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,uv_index,uv_index_clear_sky',
    wind_speed_unit: 'kmh',
    timezone: 'auto',
  });

  try {
    const res = await fetch(`${OPEN_METEO_URL}?${params.toString()}`, {
      headers: { Accept: 'application/json' },
      // Node fetch no tiene timeout por defecto: abortamos a los 5s para no colgar el endpoint.
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.warn(`Open-Meteo respondió ${res.status} para lat=${lat} lon=${lon}`);
      return null;
    }
    const json = (await res.json()) as OpenMeteoResponse;
    if (!json?.current) {
      console.warn('Open-Meteo devolvió una respuesta sin "current"');
      return null;
    }
    return json;
  } catch (err) {
    console.warn('Fallo al consultar Open-Meteo:', err);
    return null;
  }
}

export const openMeteoService = { obtenerOpenMeteo, gradosADireccion, estimarTechoNubes };
