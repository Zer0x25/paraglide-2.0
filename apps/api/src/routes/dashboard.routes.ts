import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../plugins/prisma';
import { toNum } from '../services/money.util';
import { DashboardStatsDTO, aDiaCalendario, dateKeyLocal, fechaHoraLocalToIso } from '@parapente/shared';

const dashboardRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/stats', async (_request, reply) => {
    try {
      // Día civil local (America/Santiago): inicio inclusivo / fin exclusivo
      const hoy = dateKeyLocal();
      const [hy, hm, hd] = hoy.split('-').map(Number);
      const startOfToday = new Date(fechaHoraLocalToIso(hoy, '00:00'));
      const nextDayKey = new Date(Date.UTC(hy, hm - 1, hd + 1)).toISOString().slice(0, 10);
      const endOfToday = new Date(fechaHoraLocalToIso(nextDayKey, '00:00')); // exclusivo
      // excepcionFecha.fecha es date-only (fecha civil en medianoche UTC)
      const hoyDateOnly = new Date(`${hoy}T00:00:00.000Z`);

      const hace30Dias = new Date();
      hace30Dias.setDate(hace30Dias.getDate() - 30);

      const [
        totalPilotos,
        pilotosActivosList,
        pasajeros30dCount,
        vuelosTotalCount,
        vuelosHoyCount,
        vuelosFuturosCount,
        reservasRecientesList,
      ] = await Promise.all([
        // Total pilotos
        prisma.piloto.count({ where: { deletedAt: null } }),

        // Pilotos activos con sus excepciones de hoy
        prisma.piloto.findMany({
          where: { activo: true, deletedAt: null },
          select: {
            id: true,
            disponibilidadTotal: true,
            excepciones: {
              where: { fecha: hoyDateOnly },
              select: { id: true },
            },
          },
        }),

        // Pasajeros en los últimos 30 días
        prisma.pasajero.count({
          where: {
            deletedAt: null,
            createdAt: { gte: hace30Dias },
          },
        }),

        // Total de vuelos
        prisma.vuelo.count({ where: { deletedAt: null } }),

        // Vuelos de hoy
        prisma.vuelo.count({
          where: {
            deletedAt: null,
            fechaHora: { gte: startOfToday, lt: endOfToday },
          },
        }),

        // Vuelos futuros agendados
        prisma.vuelo.count({
          where: {
            deletedAt: null,
            fechaHora: { gte: endOfToday },
            estado: 'AGENDADO',
          },
        }),

        // 5 Reservas más recientes
        prisma.reserva.findMany({
          where: { deletedAt: null },
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            numeroReserva: true,
            nombreTitular: true,
            email: true,
            telefono: true,
            estadoPago: true,
            valorTotal: true,
            abono: true,
            fechaAgenda: true,
            createdAt: true,
            pasajeros: {
              where: { deletedAt: null },
              select: { id: true, nombre: true },
            },
          },
        }),
      ]);

      const pilotosActivosCount = pilotosActivosList.length;
      const pilotosDisponiblesHoyCount = pilotosActivosList.filter(p => {
        const hasEx = p.excepciones.length > 0;
        return p.disponibilidadTotal ? !hasEx : hasEx;
      }).length;

      const promedioDiario = (pasajeros30dCount / 30).toFixed(1);

      const stats: DashboardStatsDTO = {
        pilotos: totalPilotos,
        pilotosActivos: pilotosActivosCount,
        pilotosDisponiblesHoy: pilotosDisponiblesHoyCount,
        pasajeros30d: pasajeros30dCount,
        promedioDiarioPasajeros: promedioDiario,
        vuelosTotal: vuelosTotalCount,
        vuelosHoy: vuelosHoyCount,
        vuelosFuturos: vuelosFuturosCount,
        reservasRecientes: reservasRecientesList.map(r => ({
          id: r.id,
          numeroReserva: r.numeroReserva,
          nombreTitular: r.nombreTitular,
          email: r.email,
          telefono: r.telefono,
          estadoPago: r.estadoPago,
          valorTotal: toNum(r.valorTotal),
          abono: toNum(r.abono),
          fechaAgenda: r.fechaAgenda ? aDiaCalendario(r.fechaAgenda) : null,
          createdAt: r.createdAt.toISOString(),
          totalPasajeros: r.pasajeros.length,
          pasajeros: r.pasajeros,
        })),
      };

      return reply.status(200).send(stats);
    } catch (err) {
      // Nunca responder un dashboard exitoso con estadísticas inventadas.
      console.warn('Advertencia DB en /dashboard/stats:', err);
      return reply.status(503).send({ error: 'Dashboard no disponible temporalmente' });
    }
  });
};

export default dashboardRoutes;
