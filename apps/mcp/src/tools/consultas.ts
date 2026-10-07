import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { unwrapList } from '@parapente/shared';
import { ParaglideApiClient } from '../client/api-client';
import { registerTool } from './helper';

export function registerConsultasTools(server: McpServer, apiClient: ParaglideApiClient) {
  // 1. Preguntas Frecuentes (FAQs)
  registerTool(server, {
    name: 'consultar_preguntas_frecuentes',
    description:
      'Consulta las preguntas frecuentes (FAQs) oficiales de la escuela de parapente. Permite responder dudas sobre la experiencia de vuelo, duración, seguridad, etc.',
    inputSchema: {
      categoria: z.string().optional().describe('Categoría opcional (ej: GENERAL, VUELO, PAGO, SEGURIDAD)'),
      buscar: z.string().optional().describe('Término de búsqueda opcional para filtrar por texto'),
    },
    handler: async ({ categoria, buscar }: { categoria?: string; buscar?: string }) => {
      try {
        const rawFaqs = await apiClient.getFaqs();
        let items = unwrapList<any>(rawFaqs);

        if (categoria) {
          items = items.filter((f: any) => f.categoria?.toLowerCase() === categoria.toLowerCase());
        }

        if (buscar) {
          const q = buscar.toLowerCase();
          items = items.filter(
            (f: any) =>
              f.pregunta?.toLowerCase().includes(q) || f.respuesta?.toLowerCase().includes(q)
          );
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  total: items.length,
                  faqs: items.map((f: any) => ({
                    id: f.id,
                    categoria: f.categoria,
                    pregunta: f.pregunta,
                    respuesta: f.respuesta,
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
              text: `Error al consultar preguntas frecuentes: ${err.message}`,
            },
          ],
        };
      }
    },
  });

  // 2. Reglas Operativas
  registerTool(server, {
    name: 'consultar_reglas_operativas',
    description:
      'Consulta las reglas y políticas operativas oficiales: peso máximo permitido, condiciones de salud, vestimenta recomendada, política de cancelaciones por mal clima y anticipación requerida.',
    inputSchema: {},
    handler: async () => {
      try {
        const rawReglas = await apiClient.getReglasOperativas();
        const items = unwrapList<any>(rawReglas);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  totalReglas: items.length,
                  reglas: items.map((r: any) => ({
                    id: r.id,
                    titulo: r.titulo || r.nombre,
                    descripcion: r.descripcion || r.contenido,
                    categoria: r.categoria,
                    obligatorio: r.obligatorio ?? true,
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
              text: `Error al consultar reglas operativas: ${err.message}`,
            },
          ],
        };
      }
    },
  });

  // 3. Información de Contacto y Escuela
  registerTool(server, {
    name: 'consultar_contacto_escuela',
    description:
      'Consulta la información de contacto oficial de la escuela de parapente: teléfono, WhatsApp, email, dirección de despegue/oficina y redes sociales.',
    inputSchema: {},
    handler: async () => {
      try {
        const empresa = await apiClient.getEmpresa();
        if (!empresa) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    nombre: 'Escuela de Parapente',
                    mensaje: 'Datos de empresa no configurados aún en el sistema.',
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  nombre: empresa.nombre || 'Escuela de Parapente',
                  telefono: empresa.telefono,
                  email: empresa.email,
                  direccion: empresa.direccion,
                  sitioWeb: empresa.sitioWeb,
                  redesSociales: {
                    instagram: empresa.instagram,
                    facebook: empresa.facebook,
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
              text: `Error al consultar información de la escuela: ${err.message}`,
            },
          ],
        };
      }
    },
  });

  // 4. Promociones Vigentes
  registerTool(server, {
    name: 'consultar_promociones_activas',
    description:
      'Consulta las promociones y códigos de descuento activos que los clientes pueden utilizar al reservar o cotizar.',
    inputSchema: {},
    handler: async () => {
      try {
        const rawPromos = await apiClient.getPromociones();
        const items = unwrapList<any>(rawPromos);
        const activas = items.filter((p: any) => p.activa !== false);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  total: activas.length,
                  promociones: activas.map((p: any) => ({
                    id: p.id,
                    nombre: p.nombre,
                    codigo: p.codigo,
                    descuentoPorcentaje: p.descuentoPorcentaje,
                    descuentoFijo: p.descuentoFijo,
                    descripcion: p.descripcion,
                    validaHasta: p.validaHasta,
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
              text: `Error al consultar promociones: ${err.message}`,
            },
          ],
        };
      }
    },
  });
}
