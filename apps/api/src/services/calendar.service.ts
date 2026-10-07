import ical, { ICalCalendarMethod, ICalEventStatus, ICalAlarmType } from 'ical-generator';
import crypto from 'crypto';
import { prisma } from '../plugins/prisma';
import { toNum } from '../services/money.util';
import { config } from '../config';
import { dateKeyLocal, fechaHoraLocalToIso, DEFAULT_TIMEZONE as SHARED_TIMEZONE } from '@parapente/shared';

export interface FeedTokenPayload {
  scope: 'all' | 'piloto';
  pilotoId?: number;
  /** Epoch ms de la emisión vigente del ámbito; cambia solo al regenerar el enlace. */
  emitido: number;
  /** Epoch ms de expiración (emisión + 1 año). */
  exp: number;
}

export interface FeedTokenInfo {
  token: string;
  /** ISO-8601: fecha de expiración del token (emisión + 1 año). */
  expiraEn: string;
}

export type FeedTokenMotivoRechazo = 'FIRMA' | 'EXPIRADO' | 'ROTADO';

// Hallazgo 2a: los tokens de suscripción expiran (1 año desde su emisión) y se
// pueden revocar regenerando el enlace (rotación de `FeedTokenRotacion`).
const FEED_TOKEN_TTL_MS = 365 * 24 * 60 * 60 * 1000;

const DEFAULT_TIMEZONE = process.env.APP_TIMEZONE || SHARED_TIMEZONE;
const DEFAULT_SCHOOL_NAME = process.env.APP_SCHOOL_NAME || 'Parapente School';

export class CalendarService {
  /** Clave de rotación por ámbito: 'all' o 'piloto:<id>'. */
  private feedScopeKey(scope: 'all' | 'piloto', pilotoId?: number): string {
    return scope === 'all' ? 'all' : `piloto:${pilotoId ?? ''}`;
  }

  /**
   * Emisión vigente (epoch ms) de un ámbito. Se crea al primer uso y se rota
   * sola cuando la emisión vigente ya expiró: el enlace muerto nunca se muestra.
   */
  private async getFeedEmision(scope: 'all' | 'piloto', pilotoId?: number): Promise<number> {
    const key = this.feedScopeKey(scope, pilotoId);
    const existente = await prisma.feedTokenRotacion.findUnique({ where: { key } });
    const ahora = Date.now();

    if (existente && existente.rotadoEn.getTime() + FEED_TOKEN_TTL_MS > ahora) {
      return existente.rotadoEn.getTime();
    }

    // Sin registro aún, o con la emisión ya expirada: rotar a «ahora».
    const rotado = await prisma.feedTokenRotacion.upsert({
      where: { key },
      create: { key, rotadoEn: new Date(ahora) },
      update: { rotadoEn: new Date(ahora) },
    });
    return rotado.rotadoEn.getTime();
  }

  private signFeedToken(payload: FeedTokenPayload): FeedTokenInfo {
    const jsonStr = JSON.stringify(payload);
    const dataB64 = Buffer.from(jsonStr).toString('base64url');
    const signature = crypto
      .createHmac('sha256', config.jwtSecret)
      .update(dataB64)
      .digest('base64url');

    return {
      token: `${dataB64}.${signature}`,
      expiraEn: new Date(payload.exp).toISOString(),
    };
  }

  /**
   * Genera el token firmado del feed iCalendar para un ámbito. Es determinista:
   * devuelve el mismo token hasta que se regenera el enlace o vence su expiración.
   */
  async generateFeedToken(scope: 'all' | 'piloto' = 'all', pilotoId?: number): Promise<FeedTokenInfo> {
    const emitido = await this.getFeedEmision(scope, pilotoId);
    return this.signFeedToken({
      scope,
      pilotoId,
      emitido,
      exp: emitido + FEED_TOKEN_TTL_MS,
    });
  }

  /**
   * Regenera el enlace de un ámbito: rota la emisión vigente (invalidando todos
   * los tokens anteriores) y devuelve el token nuevo.
   */
  async regenerateFeedToken(scope: 'all' | 'piloto' = 'all', pilotoId?: number): Promise<FeedTokenInfo> {
    const key = this.feedScopeKey(scope, pilotoId);
    const existente = await prisma.feedTokenRotacion.findUnique({ where: { key } });
    // Monotónico: garantiza que la rotación siempre invalide la emisión
    // anterior, incluso si ocurre en el mismo milisegundo.
    const nuevaEmision = Math.max(Date.now(), (existente?.rotadoEn.getTime() ?? 0) + 1);
    await prisma.feedTokenRotacion.upsert({
      where: { key },
      create: { key, rotadoEn: new Date(nuevaEmision) },
      update: { rotadoEn: new Date(nuevaEmision) },
    });
    return this.generateFeedToken(scope, pilotoId);
  }

  /**
   * Valida un token de feed iCalendar: firma HMAC, expiración y rotación vigente.
   */
  async verifyFeedToken(
    token: string
  ): Promise<{ valid: boolean; payload?: FeedTokenPayload; motivo?: FeedTokenMotivoRechazo }> {
    if (!token || typeof token !== 'string') return { valid: false, motivo: 'FIRMA' };
    const parts = token.split('.');
    if (parts.length !== 2) return { valid: false, motivo: 'FIRMA' };

    try {
      const [dataB64, signature] = parts;
      const expectedSignature = crypto
        .createHmac('sha256', config.jwtSecret)
        .update(dataB64)
        .digest('base64url');

      const sigBuf = Buffer.from(signature);
      const expBuf = Buffer.from(expectedSignature);

      if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
        return { valid: false, motivo: 'FIRMA' };
      }

      const jsonStr = Buffer.from(dataB64, 'base64url').toString('utf-8');
      const payload: FeedTokenPayload = JSON.parse(jsonStr);
      if (typeof payload.emitido !== 'number' || typeof payload.exp !== 'number') {
        // Formato anterior sin expiración/rotación: rechazado (2a).
        return { valid: false, motivo: 'FIRMA' };
      }

      if (Date.now() > payload.exp) {
        return { valid: false, payload, motivo: 'EXPIRADO' };
      }

      const rotacion = await prisma.feedTokenRotacion.findUnique({
        where: { key: this.feedScopeKey(payload.scope, payload.pilotoId) },
      });
      if (!rotacion || rotacion.rotadoEn.getTime() !== payload.emitido) {
        return { valid: false, payload, motivo: 'ROTADO' };
      }

      return { valid: true, payload };
    } catch {
      return { valid: false, motivo: 'FIRMA' };
    }
  }

  /**
   * Genera el feed iCalendar (.ics) para administración o piloto específico
   */
  async generateFeed(
    options: { pilotoId?: number; scope?: 'all' | 'piloto'; schoolName?: string; timezone?: string } = {}
  ): Promise<string> {
    const { pilotoId, scope = 'all' } = options;

    let dbSchoolName: string | undefined;
    try {
      const empresa = await prisma.empresa.findFirst({ select: { nombre: true } });
      if (empresa?.nombre) dbSchoolName = empresa.nombre;
    } catch {
      // fallback silencioso
    }
    const schoolName = options.schoolName || dbSchoolName || DEFAULT_SCHOOL_NAME;
    const timezone = options.timezone || DEFAULT_TIMEZONE;

    let calName = `${schoolName} - Operaciones y Vuelos`;
    let calDescription = `Calendario sincronizado en tiempo real de vuelos y reservas de ${schoolName}.`;

    if (pilotoId) {
      const piloto = await prisma.piloto.findUnique({ where: { id: pilotoId, deletedAt: null } });
      if (piloto) {
        calName = `${schoolName} - Vuelos de ${piloto.nombre}`;
        calDescription = `Calendario operacional personal para el piloto ${piloto.nombre}.`;
      }
    }

    const calendar = ical({
      name: calName,
      description: calDescription,
      prodId: `//${schoolName}//Flight Operations Calendar//ES`,
      method: ICalCalendarMethod.PUBLISH,
      ttl: 60 * 15, // Refresco sugerido cada 15 minutos
    });

    calendar.x('X-WR-CALNAME', calName);
    calendar.x('X-WR-TIMEZONE', timezone);

    const whereClause: any = {
      deletedAt: null,
    };

    if (pilotoId) {
      whereClause.pilotoId = pilotoId;
    }

    const vuelos = await prisma.vuelo.findMany({
      where: whereClause,
      include: {
        piloto: true,
        pasajero: {
          include: {
            reserva: true,
          },
        },
      },
      orderBy: { fechaHora: 'asc' },
      take: 500,
    });

    for (const vuelo of vuelos) {
      const start = new Date(vuelo.fechaHora);
      const end = new Date(start.getTime() + 45 * 60 * 1000); // 45 min duración de bloque estándar

      const pasajeroNombre = vuelo.pasajero?.nombre || 'Pasajero';
      const pilotoNombre = vuelo.piloto?.nombre || 'Sin Asignar';
      const reservaNum = vuelo.pasajero?.reserva?.numeroReserva || `RES-${vuelo.pasajero?.reservaId || 'N/A'}`;
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

      const event = calendar.createEvent({
        id: `vuelo-${vuelo.id}@parapente.app`,
        start,
        end,
        summary: `🪂 Vuelo: ${pasajeroNombre} (${pilotoNombre})`,
        description: descriptionLines.join('\n'),
        location: `Pista de Despegue ${schoolName}`,
        status: estadoVuelo === 'CANCELADO' ? ICalEventStatus.CANCELLED : ICalEventStatus.CONFIRMED,
        created: vuelo.createdAt,
        lastModified: vuelo.updatedAt,
      });

      // Recordatorios automáticos
      event.createAlarm({
        type: ICalAlarmType.display,
        triggerBefore: 60 * 60 * 2, // 2 horas antes
        description: `Recordatorio: Vuelo en parapente de ${pasajeroNombre} en 2 horas`,
      });

      event.createAlarm({
        type: ICalAlarmType.display,
        triggerBefore: 60 * 60 * 24, // 24 horas antes
        description: `Recordatorio: Mañana tienes vuelo programado con ${pasajeroNombre}`,
      });
    }

    return calendar.toString();
  }

  /**
   * Genera el archivo .ics para una reserva específica (para el pasajero / voucher)
   */
  async generateReservaIcs(
    identifier: string,
    options?: { schoolName?: string; timezone?: string }
  ): Promise<string> {
    let dbSchoolName: string | undefined;
    try {
      const empresa = await prisma.empresa.findFirst({ select: { nombre: true } });
      if (empresa?.nombre) dbSchoolName = empresa.nombre;
    } catch {
      // fallback silencioso
    }
    const schoolName = options?.schoolName || dbSchoolName || DEFAULT_SCHOOL_NAME;
    const timezone = options?.timezone || DEFAULT_TIMEZONE;

    // Vistas públicas: solo identificadores no secuenciales (ADR 005). Sin
    // fallback a numeroReserva ni id numérico (evita enumeración de reservas).
    let reserva: any = null;
    if ((prisma.reserva as any).findFirst) {
      reserva = await prisma.reserva.findFirst({
        where: {
          deletedAt: null,
          OR: [
            { tokenPublico: String(identifier) },
            { shortId: String(identifier) },
          ],
        },
        include: {
          pasajeros: {
            where: { deletedAt: null },
            include: {
              vuelos: {
                where: { deletedAt: null },
                include: { piloto: true },
              },
            },
          },
        },
      });
    }

    if (!reserva) {
      throw new Error('Reserva no encontrada');
    }

    const calName = `${schoolName} - Reserva #${reserva.numeroReserva || reserva.id}`;
    const calendar = ical({
      name: calName,
      description: `Ticket y confirmación de vuelo para ${reserva.nombreTitular}.`,
      prodId: `//${schoolName}//Voucher Calendar//ES`,
      method: ICalCalendarMethod.PUBLISH,
    });

    calendar.x('X-WR-CALNAME', calName);
    calendar.x('X-WR-TIMEZONE', timezone);

    for (const pax of reserva.pasajeros) {
      for (const vuelo of pax.vuelos) {
        const start = new Date(vuelo.fechaHora);
        const end = new Date(start.getTime() + 45 * 60 * 1000);
        const pilotoNombre = vuelo.piloto?.nombre || 'Instructor Parapente';

        calendar.createEvent({
          id: `voucher-vuelo-${vuelo.id}@parapente.app`,
          start,
          end,
          summary: `🪂 Tu Vuelo en Parapente - ${pax.nombre}`,
          description: `¡Tu experiencia de vuelo en ${schoolName}!\n\nPasajero: ${pax.nombre}\nPiloto: ${pilotoNombre}\nReserva: #${reserva.numeroReserva || reserva.id}\nLlegar con 15 minutos de anticipación y calzado cómodo.`,
          location: `Pista de Despegue ${schoolName}`,
          status: vuelo.estado === 'CANCELADO' ? ICalEventStatus.CANCELLED : ICalEventStatus.CONFIRMED,
        });
      }
    }

    // Si la reserva aún no tiene vuelos creados (o está sin agendar), agregamos el evento de la reserva
    if (calendar.events().length === 0) {
      let start: Date;
      if (reserva.fechaAgenda) {
        const dateKey = dateKeyLocal(reserva.fechaAgenda);
        const hora = reserva.horaAgenda && reserva.horaAgenda.trim() !== '' ? reserva.horaAgenda : '10:00';
        start = new Date(fechaHoraLocalToIso(dateKey, hora));
      } else {
        start = new Date(reserva.createdAt || Date.now());
      }
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      const isPendiente = !reserva.fechaAgenda;
      calendar.createEvent({
        id: `voucher-reserva-${reserva.id}@parapente.app`,
        start,
        end,
        summary: isPendiente
          ? `🪂 Reserva en Parapente (Pendiente de Agendar) - #${reserva.numeroReserva || reserva.id}`
          : `🪂 Vuelo en Parapente - Reserva #${reserva.numeroReserva || reserva.id}`,
        description: isPendiente
          ? `Reserva para ${reserva.nombreTitular} (${reserva.pasajeros?.length || 1} pasajeros).\nEstado: Pendiente de Agendamiento. Contacta a la escuela para confirmar fecha y horario.`
          : `Reserva para ${reserva.nombreTitular} (${reserva.pasajeros?.length || 1} pasajeros).\nPor favor recuerda completar el deslinde digital antes del vuelo.`,
        location: `Pista de Despegue ${schoolName}`,
        status: ICalEventStatus.CONFIRMED,
      });
    }

    return calendar.toString();
  }
}

export const calendarService = new CalendarService();
