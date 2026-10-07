import { FastifyPluginAsync } from 'fastify';
import { calendarController } from '../controllers/calendar.controller';

export const calendarProtectedRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/sync-info', calendarController.getSyncInfo);
  fastify.post('/reconcile', calendarController.reconcileCalendar);
  // 2a: rotación de tokens de suscripción — invalida los enlaces anteriores.
  fastify.post('/feed-token/regenerate', calendarController.regenerateFeedToken);
};

export const calendarPublicRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/feed.ics', calendarController.getFeed);
  fastify.get('/reserva/:id.ics', calendarController.getVoucherIcs);
};

export default calendarProtectedRoutes;
