import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ParaglideApiClient } from '../client/api-client';
import { registerTool } from './helper';

export function registerTarifasTools(server: McpServer, apiClient: ParaglideApiClient) {
  registerTool(server, {
    name: 'calcular_tarifa_reserva',
    description:
      'Calcula el valor total, descuentos y detalle de pago para una reserva antes de crearla (Fase 2 de tarifas y promociones).',
    inputSchema: {
      tarifaId: z
        .number()
        .int()
        .optional()
        .default(1)
        .describe('ID de la tarifa (1 por defecto: Vuelo Standard)'),
      promocionId: z
        .number()
        .int()
        .optional()
        .describe('ID opcional de la promoción a aplicar'),
      cantidadPasajeros: z
        .number()
        .int()
        .min(1)
        .max(20)
        .describe('Cantidad de pasajeros a cotizar'),
    },
    handler: async ({
      tarifaId,
      promocionId,
      cantidadPasajeros,
    }: {
      tarifaId?: number;
      promocionId?: number;
      cantidadPasajeros: number;
    }) => {
      try {
        const calculo = await apiClient.calcularTarifa({
          tarifaId,
          promocionId,
          cantidadPasajeros,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  tarifaId: tarifaId ?? 1,
                  promocionId: promocionId ?? null,
                  cantidadPasajeros,
                  subtotal: calculo.precioBase ?? calculo.subtotal ?? calculo.valorTotal,
                  descuento: calculo.descuento ?? 0,
                  total: calculo.valorTotal ?? calculo.total,
                  valorPorPasajero:
                    calculo.valorTotal ?? calculo.total
                      ? Math.round(Number(calculo.valorTotal ?? calculo.total) / cantidadPasajeros)
                      : null,
                  detalle: calculo.detalle || undefined,
                  moneda: 'CLP',
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
              text: `Error al calcular tarifa: ${err.message}`,
            },
          ],
        };
      }
    },
  });
}
