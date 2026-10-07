import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { fechaHoraLocalToIso } from '@parapente/shared';
import { ParaglideApiClient } from '../client/api-client';
import { mcpConfig } from '../config';
import { registerTool } from './helper';

export function registerWorkflowTools(server: McpServer, apiClient: ParaglideApiClient) {
  registerTool(server, {
    name: 'crear_y_agendar_reserva',
    description:
      'Operación compuesta de alta eficiencia: cotiza la tarifa, crea la reserva y agenda inmediatamente los vuelos de todos los pasajeros en el bloque horario indicado.',
    inputSchema: {
      nombreTitular: z.string().min(1, 'Nombre del titular o cliente'),
      email: z.string().email('Email válido').optional(),
      telefono: z.string().optional(),
      rutDniTitular: z.string().optional(),
      fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha en formato YYYY-MM-DD (ej: 2026-09-10)'),
      hora: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora de inicio de bloque en formato HH:mm (ej: 11:00)'),
      tarifaId: z.number().int().optional().describe('ID de la tarifa a cotizar (1 por defecto en el calculador)'),
      promocionId: z.number().int().optional().describe('ID opcional de la promoción a aplicar'),
      abono: z.number().min(0).optional().default(0),
      pasajeros: z
        .array(
          z.object({
            nombre: z.string().min(1, 'Nombre del pasajero'),
            peso: z.number().positive().max(130).optional(),
            telefono: z.string().optional(),
            email: z.string().email().optional(),
            rutDni: z.string().optional(),
          })
        )
        .min(1, 'Debe incluir al menos 1 pasajero'),
    },
    handler: async ({
      nombreTitular,
      email,
      telefono,
      rutDniTitular,
      fecha,
      hora,
      tarifaId,
      promocionId,
      abono,
      pasajeros,
    }: any) => {
      try {
        // 1. Calcular Tarifa. Nunca se inventa un precio de fallback:
        // un valorTotal estimado se guardaría como dinero real de la reserva.
        let valorTotal = 0;
        let descuento = 0;
        try {
          const cotizacion = await apiClient.calcularTarifa({
            tarifaId,
            promocionId,
            cantidadPasajeros: pasajeros.length,
          });
          valorTotal = Number(cotizacion.total ?? cotizacion.valorTotal ?? 0);
          descuento = Number(cotizacion.descuento ?? 0);
        } catch (tarifaErr: any) {
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: `No se pudo cotizar la tarifa; se aborta el flujo antes de crear la reserva para no registrar un precio inventado. Detalle: ${tarifaErr?.message || tarifaErr}`,
              },
            ],
          };
        }

        // 2. Crear Reserva
        const payloadReserva: any = {
          nombreTitular,
          email: email || '',
          telefono: telefono || '',
          rutDniTitular: rutDniTitular || '',
          fechaAgenda: fecha,
          horaAgenda: hora,
          valorTotal,
          abono,
          descuento,
          estado: 'SIN_AGENDAR',
          pasajeros: pasajeros.map((p: any) => ({
            nombre: p.nombre,
            peso: p.peso || 75,
            telefono: p.telefono || '',
            email: p.email || '',
            rutDni: p.rutDni || '',
          })),
        };

        const reservaCreada = await apiClient.crearReserva(payloadReserva);

        // 3. Agendar vuelos inmediatamente
        const isoFechaHora = fechaHoraLocalToIso(fecha, hora);
        const agendamiento = await apiClient.agendarGrupo({
          reservaId: reservaCreada.id,
          fechaHora: isoFechaHora,
          // Nunca inventar precio: si la cotización vale 0 (p. ej. promo 100%),
          // el valor pactado es 0, no un monto fallback.
          valorPactadoPorPasajero: valorTotal > 0 ? valorTotal / pasajeros.length : 0,
          version: reservaCreada.version,
        });

        // Enlaces públicos solo con identificadores no secuenciales (nunca el id numérico).
        const publicId = reservaCreada.shortId || reservaCreada.tokenPublico;
        const origin = mcpConfig.webUrl.replace(/\/$/, '');

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  mensaje: `Reserva #${reservaCreada.id} creada y agendada exitosamente para el ${fecha} a las ${hora}.`,
                  reservaId: reservaCreada.id,
                  tokenPublico: reservaCreada.tokenPublico,
                  shortId: reservaCreada.shortId,
                  titular: reservaCreada.nombreTitular,
                  totalPasajeros: pasajeros.length,
                  valorTotal,
                  abono,
                  saldoPendiente: Math.max(0, valorTotal - abono),
                  estadoReserva: 'AGENDADA',
                  estadoPago: abono >= valorTotal && valorTotal > 0 ? 'PAGADO' : abono > 0 ? 'ABONADO' : 'PENDIENTE',
                  vuelosAgendados: (agendamiento.vuelos || []).map((v: any) => ({
                    vueloId: v.id,
                    fechaHora: v.fechaHora,
                    pasajero: v.pasajero?.nombre,
                    piloto: v.piloto?.nombre,
                  })),
                  enlacesPublicos: {
                    voucher: `${origin}/voucher/${publicId}`,
                    deslinde: `${origin}/deslinde/${publicId}`,
                  },
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
              text: `Error en el flujo de creación y agendamiento: ${err.message}`,
            },
          ],
        };
      }
    },
  });
}
