import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { unwrapList } from '@parapente/shared';
import { ParaglideApiClient } from '../client/api-client';
import { mcpConfig } from '../config';
import { registerTool } from './helper';

export function registerReservasTools(server: McpServer, apiClient: ParaglideApiClient) {
  // 1. Crear Reserva
  registerTool(server, {
    name: 'crear_reserva',
    description:
      'Crea una nueva reserva de vuelo en estado SIN_AGENDAR. Si se conoce el bloque horario y fecha deseada, se puede indicar como referencia.',
    inputSchema: {
      nombreTitular: z.string().min(1, 'El nombre del titular o cliente es obligatorio'),
      email: z.string().email('Email inválido').optional(),
      telefono: z.string().optional(),
      rutDniTitular: z.string().optional(),
      fechaAgenda: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD').optional(),
      horaAgenda: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato HH:mm (ej: 10:00)').optional(),
      esGiftCard: z.boolean().optional(),
      valorTotal: z.number().min(0).optional(),
      abono: z.number().min(0).optional(),
      pasajeros: z
        .array(
          z.object({
            nombre: z.string().min(1, 'El nombre del pasajero es obligatorio'),
            peso: z.number().positive().max(130, 'El peso máximo es 130 kg').optional(),
            telefono: z.string().optional(),
            email: z.string().email().optional(),
            rutDni: z.string().optional(),
          })
        )
        .min(1, 'Debe incluir al menos 1 pasajero'),
      notas: z.string().optional(),
    },
    handler: async ({
      nombreTitular,
      email,
      telefono,
      rutDniTitular,
      fechaAgenda,
      horaAgenda,
      esGiftCard,
      valorTotal,
      abono,
      pasajeros,
    }: any) => {
      try {
        const payload: any = {
          nombreTitular,
          email: email || '',
          telefono: telefono || '',
          rutDniTitular: rutDniTitular || '',
          fechaAgenda: fechaAgenda || null,
          horaAgenda: horaAgenda || null,
          esGiftCard: Boolean(esGiftCard),
          valorTotal: valorTotal || 0,
          abono: abono || 0,
          estado: 'SIN_AGENDAR',
          pasajeros: pasajeros.map((p: any) => ({
            nombre: p.nombre,
            peso: p.peso || 75,
            telefono: p.telefono || '',
            email: p.email || '',
            rutDni: p.rutDni || '',
          })),
        };

        const creada = await apiClient.crearReserva(payload);
        // Enlaces públicos solo con identificadores no secuenciales (nunca el id numérico).
        const publicId = creada.shortId || creada.tokenPublico;
        const origin = mcpConfig.webUrl.replace(/\/$/, '');

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  mensaje: `Reserva #${creada.id} creada exitosamente.`,
                  id: creada.id,
                  tokenPublico: creada.tokenPublico,
                  shortId: creada.shortId,
                  nombreTitular: creada.nombreTitular,
                  totalPasajeros: creada.pasajeros?.length || pasajeros.length,
                  estado: creada.estado || 'SIN_AGENDAR',
                  estadoPago: creada.estadoPago || 'PENDIENTE',
                  valorTotal: creada.valorTotal,
                  version: creada.version,
                  enlacesPublicos: {
                    voucher: `${origin}/voucher/${publicId}`,
                    deslinde: `${origin}/deslinde/${publicId}`,
                  },
                  siguientePaso:
                    'Para confirmar los turnos de vuelo de los pasajeros, ejecute la tool "agendar_vuelos_reserva" indicando la fecha y hora elegidas.',
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
              text: `Error al crear reserva: ${err.message}`,
            },
          ],
        };
      }
    },
  });

  // 2. Consultar Reserva por ID
  registerTool(server, {
    name: 'consultar_reserva',
    description:
      'Obtiene los detalles completos de una reserva por su ID numérico: datos del titular, pasajeros, vuelos agendados, pagos y enlaces de deslinde.',
    inputSchema: {
      reservaId: z.number().int().positive('El ID de reserva debe ser un entero positivo'),
    },
    handler: async ({ reservaId }: { reservaId: number }) => {
      try {
        const reserva = await apiClient.getReserva(reservaId);
        if (!reserva) {
          return {
            isError: true,
            content: [{ type: 'text', text: `No se encontró la reserva con ID ${reservaId}` }],
          };
        }

        const publicId = reserva.shortId || reserva.tokenPublico;
        const origin = mcpConfig.webUrl.replace(/\/$/, '');

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  id: reserva.id,
                  tokenPublico: reserva.tokenPublico,
                  shortId: reserva.shortId,
                  nombreTitular: reserva.nombreTitular,
                  email: reserva.email,
                  telefono: reserva.telefono,
                  rutDniTitular: reserva.rutDniTitular,
                  estado: reserva.estado,
                  estadoPago: reserva.estadoPago,
                  valorTotal: reserva.valorTotal,
                  abono: reserva.abono,
                  saldoPendiente: Math.max(0, (reserva.valorTotal || 0) - (reserva.abono || 0)),
                  version: reserva.version,
                  pasajeros: (reserva.pasajeros || []).map((p: any) => ({
                    id: p.id,
                    nombre: p.nombre,
                    peso: p.peso,
                    deslindeFirmado: p.deslindeFirmado,
                    vuelos: (p.vuelos || []).map((v: any) => ({
                      vueloId: v.id,
                      fechaHora: v.fechaHora,
                      estado: v.estado,
                      piloto: v.piloto?.nombre || 'Sin asignar',
                    })),
                  })),
                  pagos: (reserva.pagos || []).map((pago: any) => ({
                    id: pago.id,
                    monto: pago.monto,
                    metodo: pago.metodoPago,
                    fecha: pago.fecha,
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
              text: `Error al consultar reserva: ${err.message}`,
            },
          ],
        };
      }
    },
  });

  // 3. Listar Reservas
  registerTool(server, {
    name: 'listar_reservas',
    description:
      'Lista reservas con filtros opcionales de búsqueda (nombre, email, rut), estado, rango de fechas y paginación.',
    inputSchema: {
      q: z.string().optional().describe('Término de búsqueda por nombre, email o rut'),
      estado: z
        .enum(['SIN_AGENDAR', 'AGENDADA', 'COMPLETADA', 'CANCELADA'])
        .optional()
        .describe('Filtro por estado de la reserva'),
      desde: z.string().optional().describe('Fecha inicio YYYY-MM-DD'),
      hasta: z.string().optional().describe('Fecha fin YYYY-MM-DD'),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(50).default(10),
    },
    handler: async ({ q, estado, desde, hasta, page, pageSize }: any) => {
      try {
        const res = await apiClient.listarReservas({ q, estado, desde, hasta, page, pageSize });
        const items = unwrapList<any>(res);
        const pagination = (res as any)?.pagination;
        const total = pagination?.total ?? (res as any)?.total ?? items.length;
        const totalPages = pagination?.totalPages ?? Math.ceil(total / (pageSize || 10));

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  total,
                  totalPages,
                  page: pagination?.page ?? (res as any)?.page ?? page,
                  pageSize: pagination?.pageSize ?? (res as any)?.pageSize ?? pageSize,
                  items: items.map((r: any) => ({
                    id: r.id,
                    nombreTitular: r.nombreTitular,
                    email: r.email,
                    telefono: r.telefono,
                    fechaAgenda: r.fechaAgenda,
                    horaAgenda: r.horaAgenda,
                    esGiftCard: r.esGiftCard,
                    estado: r.estado,
                    estadoPago: r.estadoPago,
                    valorTotal: r.valorTotal,
                    cantidadPasajeros: r.pasajeros?.length ?? 1,
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
              text: `Error al listar reservas: ${err.message}`,
            },
          ],
        };
      }
    },
  });

  // 4. Obtener Enlaces de Deslinde y Voucher
  registerTool(server, {
    name: 'obtener_enlaces_deslinde',
    description:
      'Genera y retorna los enlaces web públicos (con token seguro) para la firma de deslinde de responsabilidad y descarga de voucher de una reserva.',
    inputSchema: {
      reservaId: z.number().int().positive('ID de reserva numérico'),
    },
    handler: async ({ reservaId }: { reservaId: number }) => {
      try {
        const reserva = await apiClient.getReserva(reservaId);
        if (!reserva) {
          return {
            isError: true,
            content: [{ type: 'text', text: `No se encontró la reserva con ID ${reservaId}` }],
          };
        }

        const publicId = reserva.shortId || reserva.tokenPublico;
        const origin = mcpConfig.webUrl.replace(/\/$/, '');

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  reservaId: reserva.id,
                  titular: reserva.nombreTitular,
                  enlaceDeslindePublico: `${origin}/deslinde/${publicId}`,
                  enlaceVoucherPublico: `${origin}/voucher/${publicId}`,
                  pasajeros: (reserva.pasajeros || []).map((p: any) => ({
                    pasajeroId: p.id,
                    nombre: p.nombre,
                    deslindeFirmado: p.deslindeFirmado,
                    enlaceDirectoFirma: `${origin}/deslinde/${publicId}`,
                  })),
                  instrucciones:
                    'Comparta el enlace de deslinde con los pasajeros para que firmen digitalmente su declaración de salud y consentimiento antes de presentarse al vuelo.',
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
              text: `Error al obtener enlaces de deslinde: ${err.message}`,
            },
          ],
        };
      }
    },
  });

  // 5. Cancelar Reserva
  registerTool(server, {
    name: 'cancelar_reserva',
    description:
      'Cancela una reserva y desactiva los vuelos agendados asociados. Soporta emitir devolución de dinero inmediata si la reserva tenía abonos registrados.',
    inputSchema: {
      reservaId: z.number().int().positive('ID de reserva numérico'),
      motivo: z.string().min(3, 'Indique un motivo claro de cancelación'),
      devolverDinero: z
        .boolean()
        .optional()
        .default(false)
        .describe('Si es true, emite automáticamente la devolución del dinero abonado'),
    },
    handler: async ({
      reservaId,
      motivo,
      devolverDinero = false,
    }: {
      reservaId: number;
      motivo: string;
      devolverDinero?: boolean;
    }) => {
      try {
        // Control optimista (mismo patrón que desagendar_reserva): consultar la
        // versión previa y enviarla para que la API responda 409 ante cambios
        // concurrentes, en vez de pisar la reserva con una versión obsoleta.
        const reserva = await apiClient.getReserva(reservaId);
        if (!reserva) {
          return {
            isError: true,
            content: [{ type: 'text', text: `No se encontró la reserva con ID ${reservaId}` }],
          };
        }

        let devolucionPayload: any = undefined;

        if (devolverDinero && Number(reserva.abono || 0) > Number(reserva.montoDevuelto || 0)) {
          const saldoDevolver = Number(reserva.abono) - Number(reserva.montoDevuelto || 0);
          devolucionPayload = {
            monto: saldoDevolver,
            metodoPago: 'TRANSFERENCIA',
            notas: `Devolución automática MCP: ${motivo}`,
          };
        }

        const resultado = await apiClient.cancelarReserva(reservaId, {
          motivo,
          devolucion: devolucionPayload,
          version: reserva.version,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  mensaje: `Reserva #${reservaId} cancelada exitosamente.`,
                  motivo,
                  devolucionEmitida: !!devolucionPayload,
                  montoDevuelto: devolucionPayload?.monto ?? 0,
                  resultado,
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
              text: `Error al cancelar reserva: ${err.message}`,
            },
          ],
        };
      }
    },
  });

  // 6. Desagendar Reserva
  registerTool(server, {
    name: 'desagendar_reserva',
    description:
      'Devuelve una reserva de estado AGENDADA a SIN_AGENDAR, liberando los vuelos y pilotos asignados para que pueda volver a ser agendada en otra fecha/bloque.',
    inputSchema: {
      reservaId: z.number().int().positive('ID de reserva numérico'),
      version: z
        .number()
        .int()
        .optional()
        .describe('Versión de concurrencia optimista (si no se especifica, se obtendrá automáticamente)'),
    },
    handler: async ({
      reservaId,
      version,
    }: {
      reservaId: number;
      version?: number;
    }) => {
      try {
        let versionAUsar = version;
        if (versionAUsar === undefined) {
          const reservaActual = await apiClient.getReserva(reservaId);
          if (!reservaActual) {
            return {
              isError: true,
              content: [{ type: 'text', text: `No se encontró la reserva con ID ${reservaId}` }],
            };
          }
          versionAUsar = reservaActual.version;
        }

        const resultado = await apiClient.desagendarReserva(reservaId, {
          version: versionAUsar,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  mensaje: `Reserva #${reservaId} desagendada exitosamente. Vuelve a estado SIN_AGENDAR.`,
                  reservaId,
                  estado: resultado.estado || 'SIN_AGENDAR',
                  vuelosLiberados: resultado.vuelosEliminados ?? resultado.vuelosLiberados ?? 0,
                  version: resultado.version,
                  siguientePaso:
                    'La reserva ahora puede ser editada o reagendada en una nueva fecha/bloque usando la tool "agendar_vuelos_reserva".',
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
              text: `Error al desagendar reserva: ${err.message}`,
            },
          ],
        };
      }
    },
  });
}
