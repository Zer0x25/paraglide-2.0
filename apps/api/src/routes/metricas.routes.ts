import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../plugins/prisma';
import { toNum } from '../services/money.util';
import {
  MetricasQuerySchema,
  MetricasFinancierasDTO,
  dateKeyLocal,
  fechaHoraLocalToIso,
} from '@parapente/shared';

const metricasRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/financiero', async (request, reply) => {
    try {
      const query = MetricasQuerySchema.parse(request.query || {});
      // Mes/año por defecto según el día civil local (America/Santiago)
      const [hoyYear, hoyMonth] = dateKeyLocal().split('-').map(Number);
      const targetMonth = query.mes !== undefined ? query.mes : hoyMonth - 1;
      const targetYear = query.year !== undefined ? query.year : hoyYear;

      const firstDayKey = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-01`;
      const nextMonthFirstDayKey = new Date(Date.UTC(targetYear, targetMonth + 1, 1)).toISOString().slice(0, 10);
      // fechaHora son instantes UTC: mes civil local, inicio inclusivo / fin exclusivo
      const startDate = new Date(fechaHoraLocalToIso(firstDayKey, '00:00'));
      const endDate = new Date(fechaHoraLocalToIso(nextMonthFirstDayKey, '00:00'));
      // gasto.fecha es date-only (fecha civil en medianoche UTC): sus bordes van
      // en esa convención, no en medianoche local (si no se cae el día 1 y se
      // cuela el día 1 del mes siguiente).
      const startDateOnly = new Date(`${firstDayKey}T00:00:00.000Z`);
      const endDateOnly = new Date(`${nextMonthFirstDayKey}T00:00:00.000Z`);
      const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();

      // Pilar 4.1: agregación pushdown — Postgres agrega (GROUP BY), la app
      // solo arma el envelope. Antes se traían todas las filas del mes y se
      // agregaba con forEach en JS.
      const [
        estadoCounts,
        completados,
        gastosAgrupados,
        gastosTotal,
        vuelosPorDia,
        pilotosTopRaw,
      ] = await Promise.all([
        prisma.vuelo.groupBy({
          by: ['estado'],
          where: { fechaHora: { gte: startDate, lt: endDate } },
          _count: { _all: true },
        }),

        prisma.vuelo.aggregate({
          where: { estado: 'COMPLETADO', fechaHora: { gte: startDate, lt: endDate } },
          _count: { _all: true },
          _sum: { valorPactado: true, pagoPiloto: true },
        }),

        prisma.gasto.groupBy({
          by: ['categoria'],
          where: { fecha: { gte: startDateOnly, lt: endDateOnly } },
          _sum: { monto: true },
        }),

        prisma.gasto.aggregate({
          where: { fecha: { gte: startDateOnly, lt: endDateOnly } },
          _sum: { monto: true },
        }),

        // "fechaHora" es TIMESTAMP naive con wall-time UTC: el doble
        // AT TIME ZONE lo convierte al día civil local (America/Santiago) y se
        // devuelve como timestamptz (medianoche local) para que el bucket con
        // dateKeyLocal no dependa de la TZ del servidor.
        prisma.$queryRaw<{ dia: Date; estado: string; cnt: number }[]>`
          SELECT date_trunc('day', "fechaHora" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Santiago') AT TIME ZONE 'America/Santiago' AS dia, "estado"::text AS estado, COUNT(*)::int AS cnt
          FROM "Vuelo"
          WHERE "deletedAt" IS NULL AND "fechaHora" >= ${startDate} AND "fechaHora" < ${endDate}
          GROUP BY 1, 2
        `,

        // ⚡ Bolt: Moved pilotosTopRaw query into Promise.all to run concurrently,
        // avoiding a sequential wait and N+1 execution pattern.
        prisma.vuelo.groupBy({
          by: ['pilotoId'],
          where: { estado: 'COMPLETADO', fechaHora: { gte: startDate, lt: endDate } },
          _count: { _all: true },
          _sum: { valorPactado: true, pagoPiloto: true },
        }),
      ]);

      const pilotosNombres = await prisma.piloto.findMany({
        where: { id: { in: pilotosTopRaw.map((p) => p.pilotoId) } },
        select: { id: true, nombre: true },
      });
      const nombreMap = new Map(pilotosNombres.map((p) => [p.id, p.nombre]));

      const totalPorEstado: Record<string, number> = {};
      estadoCounts.forEach((e) => {
        totalPorEstado[e.estado] = e._count._all;
      });
      const totalAgendados = totalPorEstado['AGENDADO'] ?? 0;
      const totalCompletados = totalPorEstado['COMPLETADO'] ?? 0;
      const totalCancelados = totalPorEstado['CANCELADO'] ?? 0;
      const ingresosTotales = toNum(completados._sum.valorPactado);
      const pagosPilotos = toNum(completados._sum.pagoPiloto);
      const gastosOperativos = toNum(gastosTotal._sum.monto);

      const gastosPorCategoria = gastosAgrupados
        .map((g) => ({
          categoria: g.categoria,
          monto: toNum(g._sum.monto),
          porcentaje: gastosOperativos > 0
            ? Number(((toNum(g._sum.monto) / gastosOperativos) * 100).toFixed(1))
            : 0,
        }))
        .sort((a, b) => b.monto - a.monto);

      const pilotosTop = pilotosTopRaw
        .map((p) => ({
          id: p.pilotoId,
          nombre: nombreMap.get(p.pilotoId) ?? `Piloto ${p.pilotoId}`,
          vuelos: p._count._all,
          ingresos: toNum(p._sum.valorPactado),
          comisiones: toNum(p._sum.pagoPiloto),
        }))
        .sort((a, b) => b.vuelos - a.vuelos || b.ingresos - a.ingresos);

      const demandaPorDia: Record<number, { agendados: number; completados: number; cancelados: number }> = {};
      vuelosPorDia.forEach((row) => {
        // Bucket por día civil local (dia = medianoche America/Santiago)
        const dia = Number(dateKeyLocal(row.dia).slice(8, 10));
        if (!demandaPorDia[dia]) {
          demandaPorDia[dia] = { agendados: 0, completados: 0, cancelados: 0 };
        }
        if (row.estado === 'COMPLETADO') demandaPorDia[dia].completados += row.cnt;
        else if (row.estado === 'CANCELADO') demandaPorDia[dia].cancelados += row.cnt;
        else demandaPorDia[dia].agendados += row.cnt;
      });

      const demandaMensual = Array.from({ length: daysInMonth }, (_, i) => {
        const d = demandaPorDia[i + 1] || { agendados: 0, completados: 0, cancelados: 0 };
        return { dia: `Día ${i + 1}`, ...d };
      });

      const responseData: MetricasFinancierasDTO = {
        mes: targetMonth,
        year: targetYear,
        totalAgendados,
        totalCompletados,
        totalCancelados,
        ingresosTotales,
        pagosPilotos,
        gastosOperativos,
        pagoEscuela: ingresosTotales - pagosPilotos - gastosOperativos,
        margenNetoPorcentaje: ingresosTotales > 0
          ? Number((((ingresosTotales - pagosPilotos - gastosOperativos) / ingresosTotales) * 100).toFixed(1))
          : 0,
        pilotosTop,
        demandaMensual,
        gastosPorCategoria,
      };

      return reply.status(200).send(responseData);
    } catch (err) {
      // Nunca responder un mes exitoso con finanzas inventadas en cero.
      console.warn('Advertencia DB en /metricas/financiero:', err);
      return reply.status(503).send({ error: 'Métricas no disponibles temporalmente' });
    }
  });
};

export default metricasRoutes;