import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { unwrapList, horaLocalHHMM } from '@parapente/shared';
import { ParaglideApiClient } from '../client/api-client';
import { registerTool } from './helper';

export function registerDisponibilidadTools(server: McpServer, apiClient: ParaglideApiClient) {
  // 1. Consultar Meteorología
  registerTool(server, {
    name: 'consultar_meteorologia',
    description:
      'Consulta las condiciones meteorológicas actuales del centro de vuelo (viento, ráfagas, dirección, volabilidad y recomendación).',
    handler: async () => {
      try {
        const meteo = await apiClient.getMeteorologia();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  // Contrato real de GET /meteorologia/estado-actual (CondicionPista):
                  // estadoPista/velocidadViento/rachaViento/observaciones/fechaHora.
                  // Se conservan los aliases por compatibilidad con mocks antiguos.
                  condicion: meteo.estadoPista || meteo.estado || meteo.condicion || 'DESCONOCIDO',
                  volable: meteo.volable ?? (meteo.estadoPista ? meteo.estadoPista !== 'CERRADA' : meteo.estado === 'VOLABLE'),
                  vientoKmH: meteo.velocidadViento ?? meteo.vientoKmH ?? meteo.windSpeed,
                  rafagasKmH: meteo.rachaViento ?? meteo.rafagasKmH ?? meteo.windGusts,
                  direccionViento: meteo.direccionViento ?? meteo.windDirection,
                  recomendacion:
                    meteo.recomendacion ||
                    meteo.observaciones ||
                    (meteo.volable ? 'Condiciones aptas para operar' : 'Condiciones no aptas o de precaución'),
                  temperatura: meteo.temperatura,
                  ultimaActualizacion: meteo.fechaHora || meteo.actualizadoEn || new Date().toISOString(),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Error al consultar meteorología: ${err.message}`,
            },
          ],
        };
      }
    },
  });

  // 2. Consultar Disponibilidad y Calendario
  registerTool(server, {
    name: 'consultar_disponibilidad_calendario',
    description:
      'Consulta la configuración de bloques horarios, slots disponibles y capacidad de vuelos para una fecha específica (YYYY-MM-DD).',
    inputSchema: {
      fecha: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha debe ser YYYY-MM-DD (ej: 2026-09-10)'),
    },
    handler: async ({ fecha }: { fecha: string }) => {
      try {
        // Consultar resolución de bloques y vuelos agendados
        const [resolucion, vuelosRes, pilotosRes] = await Promise.all([
          apiClient.resolverBloques(fecha, fecha).catch(() => ({} as Record<string, any>)),
          apiClient.getVuelos({ desde: fecha, hasta: fecha, campos: 'vista-calendario' }),
          apiClient.getPilotos().catch(() => []),
        ]);

        const diaResuelto = (resolucion as Record<string, any>)?.[fecha];
        const estaBloqueado = diaResuelto?.bloqueado ?? false;
        const horarios: Array<{ horaInicio: string; horaFin: string }> = diaResuelto?.horarios || [];

        const vuelos = unwrapList<any>(vuelosRes);
        const pilotos = unwrapList<any>(pilotosRes);
        const pilotosActivos = pilotos.filter((p: any) => p.activo !== false);

        // Agrupar vuelos agendados por horario
        const vuelosPorHora: Record<string, number> = {};
        for (const v of vuelos) {
          if (v.estado !== 'CANCELADO') {
            const hora = horaLocalHHMM(v.fechaHora);
            vuelosPorHora[hora] = (vuelosPorHora[hora] || 0) + 1;
          }
        }

        const capacidadPorBloque = pilotosActivos.length || 2; // Estimado por pilotos activos
        const bloquesDisponibles = horarios.map((h) => {
          const ocupados = vuelosPorHora[h.horaInicio] || 0;
          const cuposLibres = Math.max(0, capacidadPorBloque - ocupados);
          return {
            hora: h.horaInicio,
            horaFin: h.horaFin,
            capacidadTotal: capacidadPorBloque,
            vuelosAgendados: ocupados,
            cuposDisponibles: cuposLibres,
            disponible: cuposLibres > 0 && !estaBloqueado,
          };
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  fecha,
                  bloqueadoPorAdmin: estaBloqueado,
                  nombreConfiguracion: diaResuelto?.nombre || 'Configuración estándar',
                  totalPilotosActivos: pilotosActivos.length,
                  totalVuelosDelDia: vuelos.length,
                  bloques: bloquesDisponibles,
                  resumen: estaBloqueado
                    ? 'El día se encuentra bloqueado para operaciones.'
                    : bloquesDisponibles.length === 0
                    ? 'No hay bloques horarios configurados para esta fecha.'
                    : `Hay ${bloquesDisponibles.filter((b) => b.disponible).length} bloques con cupos libres.`,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Error al consultar disponibilidad: ${err.message}`,
            },
          ],
        };
      }
    },
  });

  // 3. Consultar Pilotos Disponibles
  registerTool(server, {
    name: 'consultar_pilotos_disponibles',
    description:
      'Lista los pilotos activos en la escuela y sus categorías (MASTER, SENIOR, JUNIOR), sin exponer datos sensibles.',
    handler: async () => {
      try {
        const pilotosRes = await apiClient.getPilotos();
        const pilotos = unwrapList<any>(pilotosRes);
        const pilotosSanitizados = pilotos
          .filter((p: any) => p.activo !== false)
          .map((p: any) => ({
            id: p.id,
            nombre: p.nombre,
            categoria: p.categoria || 'PILOTO',
            disponibilidadTotal: p.disponibilidadTotal ?? true,
          }));

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  totalPilotos: pilotosSanitizados.length,
                  pilotos: pilotosSanitizados,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Error al consultar pilotos: ${err.message}`,
            },
          ],
        };
      }
    },
  });
}
