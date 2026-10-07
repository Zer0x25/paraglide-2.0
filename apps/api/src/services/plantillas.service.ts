import { prisma } from '../plugins/prisma';
import { CreatePlantillaMensajePayload } from '@parapente/shared';
import { listar, ListQuery } from './pagination.util';

const SEED_PLANTILLAS = [
  {
    tipo: 'CONFIRMACION_RESERVA',
    titulo: 'Confirmación de Reserva de Vuelo',
    canal: 'WHATSAPP',
    cuerpo: '¡Hola {{nombre}}! 🪂 Tu reserva #{{numero_reserva}} para tu vuelo en parapente el día {{fecha}} está CONFIRMADA.\n\n🎫 Puedes ver tu Boarding Pass aquí: {{link_voucher}}\n✍️ Por favor firma tu deslinde digital previo al despegue: {{link_deslinde}}\n\n¡Nos vemos en el aire!',
    variables: 'nombre, numero_reserva, fecha, hora, link_voucher, link_deslinde, saldo',
    activo: true,
  },
  {
    tipo: 'RECORDATORIO_24H',
    titulo: 'Recordatorio de Vuelo (24h antes)',
    canal: 'WHATSAPP',
    cuerpo: '¡Hola {{nombre}}! 🌤️ Te recordamos que tu vuelo en parapente es MAÑANA {{fecha}} a las {{hora}}.\n\nRecuerda llevar calzado deportivo cerrado (zapatillas/trekking) y llegar 15 minutos antes a la zona de despegue.\n\n🎫 Tu Ticket de Vuelo: {{link_voucher}}',
    variables: 'nombre, fecha, hora, link_voucher',
    activo: true,
  },
  {
    tipo: 'SOLICITUD_DESLINDE',
    titulo: 'Solicitud de Deslinde Digital',
    canal: 'WHATSAPP',
    cuerpo: '¡Hola {{nombre}}! Para agilizar tu embarque y vuelo, por favor completa tu ficha médica y firma el deslinde digital en este enlace seguro:\n{{link_deslinde}}\n\n¡Es obligatorio antes de despegar!',
    variables: 'nombre, link_deslinde',
    activo: true,
  },
  {
    tipo: 'AGRADECIMIENTO_RESEÑA',
    titulo: 'Agradecimiento Post-Vuelo & Reseña',
    canal: 'WHATSAPP',
    cuerpo: '¡Hola {{nombre}}! 🦅 Esperamos que hayas disfrutado al máximo tu experiencia volando en parapente con nosotros.\n\n¿Nos dejarías una breve reseña de 5 estrellas en Google para ayudarnos a seguir creciendo? ¡Te lo agradeceríamos mucho! ⭐⭐⭐⭐⭐',
    variables: 'nombre',
    activo: true,
  },
  {
    tipo: 'AVISO_CLIMA_CANCELACION',
    titulo: 'Aviso de Reprogramación por Meteorología',
    canal: 'WHATSAPP',
    cuerpo: 'Estimado(a) {{nombre}}, por razones estrictas de seguridad operacional y condiciones de viento no volables, las operaciones de hoy {{fecha}} han debido ser suspendidas. Tu reserva sigue 100% activa para reagendar en la fecha que más te acomode sin ningún costo. ¡Tu seguridad es siempre lo primero!',
    variables: 'nombre, fecha',
    activo: true,
  },
  {
    tipo: 'ENLACE_PANTALLA_DIA',
    titulo: 'Enlace del Tablero de Vuelos (día de vuelo)',
    canal: 'WHATSAPP',
    cuerpo: '¡Hola {{nombre}}! 🪂 Tu vuelo es hoy {{fecha}} a las {{hora}}. Puedes seguir el tablero de embarque en vivo en este enlace (válido solo hoy):\n\n{{link_pantalla}}',
    variables: 'nombre, fecha, hora, link_pantalla',
    activo: true,
  },
];

export class PlantillasService {
  async initSeeds() {
    for (const p of SEED_PLANTILLAS) {
      const existing = await prisma.plantillaMensaje.findFirst({
        where: { tipo: p.tipo, deletedAt: null },
      });
      if (!existing) {
        await prisma.plantillaMensaje.create({ data: p as any });
      }
    }
  }

  async getAll(opts: ListQuery = {}) {
    await this.initSeeds();
    return listar(
      opts,
      ({ skip, take }) =>
        prisma.plantillaMensaje.findMany({
          where: { deletedAt: null },
          orderBy: { id: 'asc' },
          skip,
          take,
        }),
      () => prisma.plantillaMensaje.count({ where: { deletedAt: null } }),
    );
  }

  async getById(id: number) {
    return prisma.plantillaMensaje.findFirst({
      where: { id, deletedAt: null },
    });
  }

  async getByTipo(tipo: string) {
    await this.initSeeds();
    return prisma.plantillaMensaje.findFirst({
      where: { tipo, deletedAt: null },
    });
  }

  async create(data: CreatePlantillaMensajePayload) {
    return prisma.plantillaMensaje.create({
      data: {
        tipo: data.tipo,
        titulo: data.titulo,
        canal: data.canal,
        cuerpo: data.cuerpo,
        variables: data.variables || null,
        activo: data.activo ?? true,
      },
    });
  }

  async update(id: number, data: Partial<CreatePlantillaMensajePayload>) {
    return prisma.plantillaMensaje.update({
      where: { id },
      data: {
        ...(data.tipo && { tipo: data.tipo }),
        ...(data.titulo && { titulo: data.titulo }),
        ...(data.canal && { canal: data.canal }),
        ...(data.cuerpo && { cuerpo: data.cuerpo }),
        ...(data.variables !== undefined && { variables: data.variables }),
        ...(data.activo !== undefined && { activo: data.activo }),
      },
    });
  }

  async delete(id: number) {
    return prisma.plantillaMensaje.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  render(cuerpo: string, vars: Record<string, string>) {
    let result = cuerpo;
    for (const [key, value] of Object.entries(vars)) {
      // Escapar meta-caracteres regex de la clave para no lanzar en new RegExp
      // (claves como {{a.b}}, {{precio(taxa)}} rompían el endpoint con 500).
      const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(new RegExp(`{{${escaped}}}`, 'g'), value ?? '');
    }
    return result;
  }
}

export const plantillasService = new PlantillasService();
