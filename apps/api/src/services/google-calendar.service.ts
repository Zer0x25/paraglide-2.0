import { JWT } from 'google-auth-library';
import { prisma } from '../plugins/prisma';
import { config } from '../config';
import { toNum } from './money.util';

export class GoogleCalendarService {
  private jwtClient: JWT | null = null;

  /**
   * Indica si la sincronización con Google Calendar está configurada y habilitada
   */
  isEnabled(): boolean {
    return Boolean(
      config.googleCalendarId &&
      config.googleCalendarClientEmail &&
      config.googleCalendarPrivateKey
    );
  }

  /**
   * Obtiene o inicializa el cliente JWT autenticado para la API de Google Calendar
   */
  private getClient(): JWT | null {
    if (!this.isEnabled()) return null;
    if (!this.jwtClient) {
      this.jwtClient = new JWT({
        email: config.googleCalendarClientEmail,
        key: config.googleCalendarPrivateKey.replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/calendar'],
      });
    }
    return this.jwtClient;
  }

  /**
   * Obtiene el nombre de la escuela desde la base de datos o variable de entorno
   */
  private async getSchoolName(): Promise<string> {
    try {
      const empresa = await prisma.empresa.findFirst({ select: { nombre: true } });
      if (empresa?.nombre) return empresa.nombre;
    } catch {
      // fallback silencioso
    }
    return process.env.APP_SCHOOL_NAME || 'Parapente School';
  }

  /**
   * Construye el payload de evento en formato Google Calendar v3
   */
  private buildEventPayload(vuelo: any, schoolName: string) {
    const start = new Date(vuelo.fechaHora);
    const end = new Date(start.getTime() + 45 * 60 * 1000); // 45 min duración de bloque estándar

    const pasajeroNombre = vuelo.pasajero?.nombre || 'Pasajero';
    const pilotoNombre = vuelo.piloto?.nombre || 'Sin Asignar';
    const reservaNum = vuelo.pasajero?.reserva?.numeroReserva || `RES-${vuelo.pasajero?.reservaId || vuelo.reservaId || 'N/A'}`;
    const deslindeStatus = vuelo.pasajero?.firmaDeslinde ? '✅ Firmado digitalmente' : '⚠️ Pendiente de firma';
    const estadoVuelo = vuelo.estado || 'AGENDADO';
    const pesoStr = vuelo.pasajero?.peso ? `${vuelo.pasajero.peso} kg` : 'No registrado';
    const telefono = vuelo.pasajero?.reserva?.telefono || vuelo.pasajero?.telefonoEmergencia || 'No registrado';

    const descriptionLines = [
      `🪂 VUELO EN PARAPENTE - ${schoolName.toUpperCase()}`,
      `─────────────────────────────────────`,
      `👤 Pasajero: ${pasajeroNombre} (${pesoStr})`,
      `🧑‍✈️ Piloto Asignado: ${pilotoNombre}`,
      `📋 Reserva: #${reservaNum}`,
      `📞 Contacto / WhatsApp: ${telefono}`,
      `📝 Deslinde de Seguridad: ${deslindeStatus}`,
      `💰 Valor: $${toNum(vuelo.valorPactado).toLocaleString('es-CL')} CLP`,
      `📌 Estado del Vuelo: ${estadoVuelo}`,
      `─────────────────────────────────────`,
      `Ubicación: Pista de Despegue Principal`,
    ];

    return {
      summary: `🪂 Vuelo: ${pasajeroNombre} (${pilotoNombre})`,
      description: descriptionLines.join('\n'),
      location: `Pista de Despegue ${schoolName}`,
      start: {
        dateTime: start.toISOString(),
      },
      end: {
        dateTime: end.toISOString(),
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 120 },   // 2 horas antes
          { method: 'popup', minutes: 1440 },  // 24 horas antes
        ],
      },
    };
  }

  /**
   * Sincroniza la creación de un nuevo vuelo insertando el evento en Google Calendar
   */
  async syncVueloCreated(vueloId: number): Promise<string | null> {
    if (!this.isEnabled()) return null;

    try {
      const client = this.getClient();
      if (!client) return null;

      const vuelo = await prisma.vuelo.findFirst({
        where: { id: vueloId, deletedAt: null },
        include: {
          piloto: true,
          pasajero: {
            include: {
              reserva: true,
            },
          },
        },
      });

      if (!vuelo || vuelo.estado === 'CANCELADO') return null;

      // Si ya tiene un evento en Google Calendar, lo actualizamos en vez de duplicar
      if (vuelo.googleEventId) {
        await this.syncVueloUpdated(vueloId);
        return vuelo.googleEventId;
      }

      const schoolName = await this.getSchoolName();
      const eventData = this.buildEventPayload(vuelo, schoolName);

      const res = await client.request<{ id: string }>({
        url: `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.googleCalendarId)}/events`,
        method: 'POST',
        data: eventData,
      });

      const googleEventId = res.data?.id;
      if (googleEventId) {
        await prisma.vuelo.update({
          where: { id: vueloId },
          data: { googleEventId },
        });
      }

      return googleEventId || null;
    } catch (error: any) {
      console.warn(`[GoogleCalendarService] Advertencia al sincronizar creación de vuelo ${vueloId}:`, error?.message || error);
      return null;
    }
  }

  /**
   * Sincroniza la actualización de un vuelo en Google Calendar
   */
  async syncVueloUpdated(vueloId: number): Promise<void> {
    if (!this.isEnabled()) return;

    try {
      const client = this.getClient();
      if (!client) return;

      const vuelo = await prisma.vuelo.findFirst({
        where: { id: vueloId, deletedAt: null },
        include: {
          piloto: true,
          pasajero: {
            include: {
              reserva: true,
            },
          },
        },
      });

      if (!vuelo) return;

      // Si el vuelo fue cancelado, lo eliminamos de Google Calendar
      if (vuelo.estado === 'CANCELADO') {
        await this.syncVueloDeleted(vueloId, vuelo.googleEventId || undefined);
        return;
      }

      // Si no tenía evento asignado aún, lo creamos
      if (!vuelo.googleEventId) {
        await this.syncVueloCreated(vueloId);
        return;
      }

      const schoolName = await this.getSchoolName();
      const eventData = this.buildEventPayload(vuelo, schoolName);

      try {
        await client.request({
          url: `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.googleCalendarId)}/events/${encodeURIComponent(vuelo.googleEventId)}`,
          method: 'PATCH',
          data: eventData,
        });
      } catch (patchErr: any) {
        // Si el evento fue eliminado manualmente en Google Calendar (404 o 410), crearlo de nuevo
        if (patchErr?.response?.status === 404 || patchErr?.response?.status === 410) {
          await prisma.vuelo.update({
            where: { id: vueloId },
            data: { googleEventId: null },
          });
          await this.syncVueloCreated(vueloId);
        } else {
          throw patchErr;
        }
      }
    } catch (error: any) {
      console.warn(`[GoogleCalendarService] Advertencia al sincronizar actualización de vuelo ${vueloId}:`, error?.message || error);
    }
  }

  /**
   * Elimina el evento correspondiente de Google Calendar si el vuelo es cancelado o eliminado
   */
  async syncVueloDeleted(vueloId: number, googleEventIdArg?: string): Promise<void> {
    if (!this.isEnabled()) return;

    try {
      const client = this.getClient();
      if (!client) return;

      let eventId = googleEventIdArg;
      if (!eventId) {
        const vuelo = await prisma.vuelo.findUnique({
          where: { id: vueloId },
          select: { googleEventId: true },
        });
        eventId = vuelo?.googleEventId || undefined;
      }

      if (!eventId) return;

      try {
        await client.request({
          url: `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.googleCalendarId)}/events/${encodeURIComponent(eventId)}`,
          method: 'DELETE',
        });
      } catch (delErr: any) {
        // 404 o 410 significa que ya no existe en Google Calendar; es seguro ignorarlo
        if (delErr?.response?.status !== 404 && delErr?.response?.status !== 410) {
          throw delErr;
        }
      }

      // Limpiar el campo en Postgres si el vuelo aún existe
      try {
        await prisma.vuelo.update({
          where: { id: vueloId },
          data: { googleEventId: null },
        });
      } catch {
        // Ignorar si el registro fue hard-deleted
      }
    } catch (error: any) {
      console.warn(`[GoogleCalendarService] Advertencia al eliminar evento de Google Calendar para vuelo ${vueloId}:`, error?.message || error);
    }
  }

  /**
   * Elimina de Google Calendar todos los eventos de vuelos asociados a una reserva
   */
  async syncReservaVuelosDeleted(reservaId: number): Promise<void> {
    if (!this.isEnabled()) return;

    try {
      // Los llamadores (cancelar/desagendar/eliminar) soft-deletan los vuelos
      // ANTES de llamar aquí, así que hay que incluir los borrados:
      // `deletedAt: {}` evita la inyección `deletedAt: null` de la extensión
      // (solo actúa cuando el filtro es undefined).
      const vuelos = await prisma.vuelo.findMany({
        where: { reservaId, googleEventId: { not: null }, deletedAt: {} },
        select: { id: true, googleEventId: true },
      });

      for (const v of vuelos) {
        if (v.googleEventId) {
          await this.syncVueloDeleted(v.id, v.googleEventId);
        }
      }
    } catch (error: any) {
      console.warn(`[GoogleCalendarService] Advertencia al eliminar eventos de reserva ${reservaId}:`, error?.message || error);
    }
  }

  /**
   * Reconcilia los vuelos locales con Google Calendar.
   * - Busca vuelos activos en ventana relevante (desde hace 24h hacia el futuro).
   * - Crea los que no tengan googleEventId.
   * - Actualiza los que ya tengan googleEventId.
   * - Purga de Google Calendar los vuelos cancelados que aún conservan googleEventId.
   */
  async reconcileVuelos(options?: { desdeFecha?: Date }): Promise<{
    total: number;
    creados: number;
    actualizados: number;
    eliminados: number;
    fallidos: number;
  }> {
    const stats = { total: 0, creados: 0, actualizados: 0, eliminados: 0, fallidos: 0 };
    if (!this.isEnabled()) return stats;

    const fechaCorte = options?.desdeFecha || new Date(Date.now() - 24 * 60 * 60 * 1000);

    try {
      // 1. Vuelos activos (agendados, en progreso, completados) desde fechaCorte hacia el futuro
      const vuelosActivos = await prisma.vuelo.findMany({
        where: {
          deletedAt: null,
          estado: { not: 'CANCELADO' },
          fechaHora: { gte: fechaCorte },
        },
        select: { id: true, googleEventId: true },
        orderBy: { fechaHora: 'asc' },
      });

      stats.total += vuelosActivos.length;

      for (const v of vuelosActivos) {
        try {
          if (!v.googleEventId) {
            const eventId = await this.syncVueloCreated(v.id);
            if (eventId) {
              stats.creados++;
            } else {
              stats.fallidos++;
            }
          } else {
            await this.syncVueloUpdated(v.id);
            stats.actualizados++;
          }
        } catch {
          stats.fallidos++;
        }
      }

      // 2. Vuelos cancelados o eliminados que aún conservan un googleEventId
      const vuelosCanceladosConEvento = await prisma.vuelo.findMany({
        where: {
          OR: [
            { estado: 'CANCELADO' },
            { deletedAt: { not: null } },
          ],
          googleEventId: { not: null },
        },
        select: { id: true, googleEventId: true },
      });

      for (const v of vuelosCanceladosConEvento) {
        if (v.googleEventId) {
          try {
            await this.syncVueloDeleted(v.id, v.googleEventId);
            stats.eliminados++;
          } catch {
            stats.fallidos++;
          }
        }
      }

      return stats;
    } catch (err: any) {
      console.warn('[GoogleCalendarService] Error en reconciliación de vuelos:', err?.message || err);
      return stats;
    }
  }
}

export const googleCalendarService = new GoogleCalendarService();
