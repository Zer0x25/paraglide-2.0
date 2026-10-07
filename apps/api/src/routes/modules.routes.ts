import { FastifyInstance } from 'fastify';
import { getModuleStatus, setEnabledModules } from '../services/modules.service';

export function modulesRoutes(app: FastifyInstance) {
  // Público: el web lo usa para inicializar su estado de módulos al arrancar.
  app.get('/modules', async () => {
    return { modules: getModuleStatus() };
  });

  // Admin: listar estado actual.
  app.get(
    '/admin/modules',
    { preHandler: app.authorize(['ADMIN']) },
    async () => {
      return { modules: getModuleStatus() };
    },
  );

  // Admin: actualizar módulos habilitados (toggle en caliente).
  app.put(
    '/admin/modules',
    { preHandler: app.authorize(['ADMIN']) },
    async (request, reply) => {
      const body = request.body as { enabled?: string[] };
      if (!Array.isArray(body?.enabled)) {
        return reply.code(400).send({ error: 'enabled debe ser un arreglo de IDs' });
      }
      return { modules: setEnabledModules(body.enabled) };
    },
  );
}
