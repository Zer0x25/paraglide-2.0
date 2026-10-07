import fp from 'fastify-plugin';
import { Prisma, PrismaClient } from '@prisma/client';
import { config } from '../config';

const SOFT_DELETE_MODELS = [
  'User',
  'Piloto',
  'Reserva',
  'Pasajero',
  'Vuelo',
  'Pago',
  'Devolucion',
  'Equipo',
  'MantenimientoEquipo',
  'CondicionPista',
  'PlantillaMensaje',
  'Gasto',
  'ConfiguracionBloque',
  'HorarioBloque',
] as const;

const softDeleteExtension = Prisma.defineExtension((client) => {
  return client.$extends({
    query: {
      $allOperations({ model, operation, args, query }) {
        if (!model || !(SOFT_DELETE_MODELS as readonly string[]).includes(model)) {
          return query(args);
        }
        if (['findMany', 'findFirst', 'count', 'aggregate', 'groupBy'].includes(operation)) {
          const a = args as any;
          if (!a.where) a.where = {};
          if (a.where.deletedAt === undefined) {
            a.where.deletedAt = null;
          }
        }
        return query(args);
      },
    },
  });
});

const prismaBase = new PrismaClient({
  datasources: {
    db: {
      url: config.databaseUrl,
    },
  },
});

export const prisma = prismaBase.$extends(softDeleteExtension) as unknown as PrismaClient;

export default fp(async (server) => {
  server.decorate('prisma', prisma);
  server.addHook('onClose', async (server) => {
    await server.prisma.$disconnect();
  });
});

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}