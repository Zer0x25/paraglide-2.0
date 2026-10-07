import { FastifyRequest, FastifyReply } from 'fastify';
import { calendarService } from '../services/calendar.service';
import { googleCalendarService } from '../services/google-calendar.service';
import { prisma } from '../plugins/prisma';
import { config } from '../config';

export class CalendarController {
  /**
   * Endpoint público para suscripción iCalendar (.ics / webcal://)
   * GET /api/public/calendar/feed.ics?token=...&pilotoId=...
   */
  async getFeed(
    req: FastifyRequest<{ Querystring: { token?: string; pilotoId?: string } }>,
    reply: FastifyReply
  ) {
    const { token, pilotoId } = req.query;

    if (!token) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Se requiere un token de suscripción de calendario válido (?token=...).'
      });
    }

    const { valid, payload, motivo } = await calendarService.verifyFeedToken(token);
    if (!valid || !payload) {
      const message =
        motivo === 'EXPIRADO'
          ? 'El token de suscripción de calendario ha expirado. Regenera el enlace desde la aplicación.'
          : motivo === 'ROTADO'
            ? 'El token de suscripción de calendario fue revocado. Regenera el enlace desde la aplicación.'
            : 'El token de sincronización de calendario no es válido o ha sido revocado.';
      return reply.status(401).send({
        error: 'Unauthorized',
        message
      });
    }

    let targetPilotoId: number | undefined;
    if (payload.scope === 'piloto') {
      targetPilotoId = payload.pilotoId;
    } else if (pilotoId) {
      targetPilotoId = Number(pilotoId);
    }

    try {
      const icsData = await calendarService.generateFeed({
        scope: payload.scope,
        pilotoId: targetPilotoId,
      });

      return reply
        .header('Content-Type', 'text/calendar; charset=utf-8')
        .header('Content-Disposition', 'inline; filename="parapente-vuelos.ics"')
        .header('Cache-Control', 'public, max-age=900, must-revalidate')
        .header('Access-Control-Allow-Origin', '*')
        .send(icsData);
    } catch (error: any) {
      req.log.error(error);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'No se pudo generar el feed de calendario.'
      });
    }
  }

  /**
   * Endpoint público para descargar archivo .ics de una reserva / voucher
   * GET /api/public/calendar/reserva/:id.ics
   */
  async getVoucherIcs(
    req: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const identifier = req.params.id;
    if (!identifier) {
      return reply.status(400).send({ error: 'Identificador de reserva inválido' });
    }

    try {
      const icsData = await calendarService.generateReservaIcs(identifier);
      return reply
        .header('Content-Type', 'text/calendar; charset=utf-8')
        .header('Content-Disposition', `inline; filename="reserva-${identifier}.ics"`)
        .header('Cache-Control', 'public, max-age=900, must-revalidate')
        .header('Access-Control-Allow-Origin', '*')
        .send(icsData);
    } catch (error: any) {
      return reply.status(404).send({
        error: 'Not Found',
        message: error.message || 'Reserva no encontrada'
      });
    }
  }

  /**
   * Endpoint protegido para obtener URLs y tokens de sincronización para el frontend
   * GET /api/calendar/sync-info
   */
  async getSyncInfo(req: FastifyRequest, reply: FastifyReply) {
    const forwardedHost = (req.headers['x-forwarded-host'] as string | undefined)?.split(',')[0]?.trim();
    const forwardedProto = (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0]?.trim();
    const rawHost = (req.headers['host'] as string | undefined) || 'localhost:3001';
    const effectiveHost = forwardedHost || rawHost;
    const protocol = forwardedProto || (req.headers['x-forwarded-proto'] as string | undefined) || 'http';

    let baseUrl: string;
    if (effectiveHost && !effectiveHost.startsWith('api:') && !effectiveHost.startsWith('db:') && !effectiveHost.startsWith('web:')) {
      baseUrl = `${protocol}://${effectiveHost}`;
    } else if (config.webUrl) {
      baseUrl = config.webUrl;
    } else {
      baseUrl = `${protocol}://${rawHost}`;
    }

    // Token universal para el panel de administración (todos los vuelos)
    const universalTokenInfo = await calendarService.generateFeedToken('all');
    const universalToken = universalTokenInfo.token;
    const universalHttpUrl = `${baseUrl}/api/public/calendar/feed.ics?token=${universalToken}`;
    const universalWebcalUrl = universalHttpUrl.replace(/^https?:\/\//i, 'webcal://');

    // Obtener pilotos activos para generar sus feeds personalizados
    const pilotos = await prisma.piloto.findMany({
      where: { activo: true, deletedAt: null },
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true, categoria: true },
    });

    const pilotosFeeds = await Promise.all(
      pilotos.map(async (p) => {
        const pTokenInfo = await calendarService.generateFeedToken('piloto', p.id);
        const pToken = pTokenInfo.token;
        const httpUrl = `${baseUrl}/api/public/calendar/feed.ics?token=${pToken}`;
        const webcalUrl = httpUrl.replace(/^https?:\/\//i, 'webcal://');
        return {
          id: p.id,
          nombre: p.nombre,
          categoria: p.categoria,
          token: pToken,
          expiraEn: pTokenInfo.expiraEn,
          httpUrl,
          webcalUrl,
        };
      })
    );

    const hasOfficialGoogleCalendar = Boolean(
      config.googleCalendarId &&
      config.googleCalendarClientEmail &&
      config.googleCalendarPrivateKey
    );

    const googleCalendarUrl = hasOfficialGoogleCalendar
      ? `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(config.googleCalendarId)}`
      : `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(universalWebcalUrl)}`;

    return reply.send({
      universal: {
        token: universalToken,
        expiraEn: universalTokenInfo.expiraEn,
        httpUrl: universalHttpUrl,
        webcalUrl: universalWebcalUrl,
        googleCalendarUrl,
      },
      pilotos: pilotosFeeds,
      googleCalendar: {
        enabled: hasOfficialGoogleCalendar,
        calendarId: config.googleCalendarId || null,
        oneClickSubscribeUrl: hasOfficialGoogleCalendar ? googleCalendarUrl : null,
      },
    });
  }

  /**
   * Endpoint protegido para forzar la reconciliación de vuelos con Google Calendar
   * POST /api/calendar/reconcile
   */
  async reconcileCalendar(req: FastifyRequest, reply: FastifyReply) {
    if (!googleCalendarService.isEnabled()) {
      return reply.status(400).send({
        success: false,
        message: 'Google Calendar no está configurado o le faltan credenciales',
      });
    }

    const stats = await googleCalendarService.reconcileVuelos();
    return reply.send({
      success: true,
      data: stats,
      message: `Sincronización completada: ${stats.creados} creados, ${stats.actualizados} actualizados, ${stats.eliminados} eliminados.`,
    });
  }

  /**
   * Endpoint protegido para regenerar el enlace de suscripción de un ámbito.
   * Rota la emisión vigente: los tokens anteriores dejan de ser válidos (2a).
   * POST /api/calendar/feed-token/regenerate  body: { scope: 'all' | 'piloto', pilotoId?: number }
   */
  async regenerateFeedToken(
    req: FastifyRequest<{ Body: { scope?: 'all' | 'piloto'; pilotoId?: number } }>,
    reply: FastifyReply
  ) {
    const scope = req.body?.scope ?? 'all';
    const pilotoId = req.body?.pilotoId;

    if (scope !== 'all' && scope !== 'piloto') {
      return reply.status(400).send({ success: false, message: 'scope debe ser "all" o "piloto".' });
    }
    if (scope === 'piloto' && !pilotoId) {
      return reply.status(400).send({ success: false, message: 'pilotoId es requerido para el scope "piloto".' });
    }
    if (scope === 'piloto') {
      const piloto = await prisma.piloto.findUnique({ where: { id: Number(pilotoId), deletedAt: null } });
      if (!piloto) {
        return reply.status(404).send({ success: false, message: 'Piloto no encontrado.' });
      }
    }

    const tokenInfo = await calendarService.regenerateFeedToken(scope, scope === 'piloto' ? Number(pilotoId) : undefined);
    return reply.send({
      success: true,
      data: tokenInfo,
      message: 'Enlace regenerado. Los enlaces anteriores dejaron de funcionar.',
    });
  }
}

export const calendarController = new CalendarController();
