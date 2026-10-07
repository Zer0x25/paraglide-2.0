import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { fechaHoraLocalToIso } from '@parapente/shared';
import { ParaglideApiClient } from '../client/api-client';
import { registerTool } from './helper';

/**
 * Normaliza una fecha-hora de entrada a ISO UTC. El formato `YYYY-MM-DD HH:mm`
 * se interpreta como HORA LOCAL (America/Santiago), nunca como UTC: marcarlo
 * con `Z` desplazaba los vuelos 3-4 horas.
 */
function normalizarFechaHoraLocal(fechaHora: string): string {
  if (fechaHora.includes('T')) return fechaHora;
  const [fecha, hora] = fechaHora.trim().split(/\s+/);
  return fechaHoraLocalToIso(fecha, hora || '12:00');
}

export function registerAgendamientoTools(server: McpServer, apiClient: ParaglideApiClient) {
  // 1. Agendar Vuelos de Grupo
  registerTool(server, {
    name: 'agendar_vuelos_reserva',
    description:
      'Agenda los vuelos para todos los pasajeros de una reserva en un bloque y fecha específicos. Asigna pilotos automáticamente si no se especifican.',
    inputSchema: {
      reservaId: z.number().int().positive('ID de reserva numérico'),
      fechaHora: z
        .string()
        .describe('Fecha y hora del vuelo en formato ISO UTC (ej: 2026-09-10T14:00:00.000Z) o hora local America/Santiago (ej: 2026-09-10 11:00)'),
      valorPactadoPorPasajero: z.number().positive().optional().describe('Valor pactado unitario por pasajero (opcional)'),
      asignaciones: z
        .record(z.string(), z.number())
        .optional()
        .describe('Mapa opcional de ID pasajero a ID de piloto asignado { [pasajeroId]: pilotoId }'),
      version: z
        .number()
        .int()
        .optional()
        .describe('Versión de concurrencia optimista de la reserva (si se omite, se consulta automáticamente)'),
    },
    handler: async ({
      reservaId,
      fechaHora,
      valorPactadoPorPasajero,
      asignaciones,
      version,
    }: {
      reservaId: number;
      fechaHora: string;
      valorPactadoPorPasajero?: number;
      asignaciones?: Record<string, number>;
      version?: number;
    }) => {
      try {
        // Normalizar fecha/hora a ISO si viene en formato YYYY-MM-DD HH:mm
        const isoFechaHora = normalizarFechaHoraLocal(fechaHora);

        // Si no viene versión, obtener versión actual de la reserva
        let resVersion = version;
        if (resVersion === undefined) {
          const reserva = await apiClient.getReserva(reservaId);
          if (!reserva) {
            return {
              isError: true,
              content: [{ type: 'text', text: `No se encontró la reserva con ID ${reservaId}` }],
            };
          }
          resVersion = reserva.version;
        }

        // Convertir asignaciones de Record<string, number> a Record<number, number>
        const parsedAsignaciones: Record<number, number> | undefined = asignaciones
          ? Object.fromEntries(Object.entries(asignaciones).map(([k, v]) => [Number(k), v]))
          : undefined;

        const resultado = await apiClient.agendarGrupo({
          reservaId,
          fechaHora: isoFechaHora,
          valorPactadoPorPasajero,
          asignaciones: parsedAsignaciones,
          version: resVersion,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  mensaje: `Vuelos para la reserva #${reservaId} agendados exitosamente.`,
                  totalVuelosAgendados: resultado.vuelos?.length || 0,
                  vuelos: (resultado.vuelos || []).map((v: any) => ({
                    vueloId: v.id,
                    fechaHora: v.fechaHora,
                    pasajero: v.pasajero?.nombre || `Pasajero #${v.pasajeroId}`,
                    piloto: v.piloto?.nombre || `Piloto #${v.pilotoId}`,
                    estado: v.estado,
                  })),
                  estadoReserva: 'AGENDADA',
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        const esConflicto =
          err.status === 409 ||
          String(err.message).toLowerCase().includes('concurrencia') ||
          String(err.message).toLowerCase().includes('cambió');
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: esConflicto
                ? `Conflicto de concurrencia (409): La reserva o el cupo cambió recientemente. Consulte la reserva con "consultar_reserva" e intente agendar de nuevo.`
                : `Error al agendar vuelos: ${err.message}`,
            },
          ],
        };
      }
    },
  });

  // 2. Reagendar Reserva
  registerTool(server, {
    name: 'reagendar_reserva',
    description:
      'Reagenda los vuelos de una reserva a una nueva fecha y hora (útil ante cancelaciones por mal tiempo o solicitud del cliente).',
    inputSchema: {
      reservaId: z.number().int().positive('ID de reserva numérico'),
      nuevaFechaHora: z
        .string()
        .describe('Nueva fecha y hora en formato ISO o YYYY-MM-DD HH:mm'),
      motivo: z.string().optional().describe('Motivo de la reprogramación (ej: alerta de viento, reprogramación cliente)'),
    },
    handler: async ({
      reservaId,
      nuevaFechaHora,
      motivo,
    }: {
      reservaId: number;
      nuevaFechaHora: string;
      motivo?: string;
    }) => {
      try {
        const isoFechaHora = normalizarFechaHoraLocal(nuevaFechaHora);

        const reserva = await apiClient.getReserva(reservaId);
        if (!reserva) {
          return {
            isError: true,
            content: [{ type: 'text', text: `No se encontró la reserva con ID ${reservaId}` }],
          };
        }

        const resultado = await apiClient.agendarGrupo({
          reservaId,
          fechaHora: isoFechaHora,
          version: reserva.version,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  mensaje: `Reserva #${reservaId} reprogramada exitosamente a ${isoFechaHora}.`,
                  motivo: motivo || 'Reprogramación solicitada',
                  totalVuelosReagendados: resultado.vuelos?.length || 0,
                  vuelos: (resultado.vuelos || []).map((v: any) => ({
                    vueloId: v.id,
                    fechaHora: v.fechaHora,
                    pasajero: v.pasajero?.nombre,
                    piloto: v.piloto?.nombre,
                  })),
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
              text: `Error al reagendar reserva: ${err.message}`,
            },
          ],
        };
      }
    },
  });
}
