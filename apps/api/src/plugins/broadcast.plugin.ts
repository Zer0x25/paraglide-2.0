import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { broadcastDatos } from '../services/eventos.service';
import type { Entidad, AccionMutacion } from '@parapente/shared';

/**
 * Plugin de broadcast automático (Pilar 6, ADR 007).
 *
 * Intercepta respuestas de mutación (POST/PUT/PATCH/DELETE con 2xx) y emite
 * un evento SSE `datos-cambios` basado en el prefijo de ruta. Los controllers
 * ya no necesitan llamar `broadcast()` manualmente.
 *
 * Mapeo declarativo: el prefijo de ruta más largo que matchee gana.
 * Excluidas: rutas públicas, auth, dev, eventos, modules (tiene su propio broadcast).
 */

interface RouteEntityEntry {
  prefix: string;
  entidad: Entidad;
  secundarias?: Entidad[];
}

/** Mapeo de prefijo de ruta → entidad SSE. El orden no importa; matcheamos el más largo. */
const ROUTE_ENTITY_MAP: RouteEntityEntry[] = [
  { prefix: '/api/vuelos', entidad: 'vuelo', secundarias: ['reserva', 'piloto'] },
  { prefix: '/api/reservas', entidad: 'reserva', secundarias: ['vuelo'] },
  { prefix: '/api/pilotos', entidad: 'piloto', secundarias: ['vuelo'] },
  { prefix: '/api/pasajeros', entidad: 'pasajero', secundarias: ['reserva', 'vuelo'] },
  { prefix: '/api/equipos', entidad: 'equipo' },
  { prefix: '/api/gastos', entidad: 'gasto' },
  { prefix: '/api/meteorologia', entidad: 'meteorologia' },
  { prefix: '/api/configuracion-bloques', entidad: 'configuracion-bloques', secundarias: ['vuelo', 'piloto'] },
  { prefix: '/api/plantillas', entidad: 'plantilla' },
  // Módulo Configuración
  { prefix: '/api/tarifas', entidad: 'tarifa' },
  { prefix: '/api/promociones', entidad: 'promocion' },
  { prefix: '/api/faqs', entidad: 'faq' },
  { prefix: '/api/deslindes', entidad: 'deslinde' },
  { prefix: '/api/reglas-operativas', entidad: 'regla-operativa' },
  { prefix: '/api/users', entidad: 'usuario' },
];

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Rutas POST de cálculo/consulta que no deben emitir eventos de mutación. */
const EXCLUDED_PATHS = [
  '/api/vuelos/asignacion-automatica',
  '/api/reservas/calcular-valor',
  '/api/pilotos/matching',
  '/api/pilotos/sugerir',
];

/** Inferir la acción a partir del método HTTP. */
function accionFromMethod(method: string): AccionMutacion {
  switch (method) {
    case 'POST': return 'crear';
    case 'DELETE': return 'eliminar';
    default: return 'actualizar'; // PUT, PATCH
  }
}

const broadcastPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onResponse', (request, reply, done) => {
    // Solo mutaciones exitosas (2xx)
    if (
      !MUTATION_METHODS.has(request.method) ||
      reply.statusCode < 200 ||
      reply.statusCode >= 300
    ) {
      return done();
    }

    const url = request.url;

    // Excluir endpoints de cálculo que usan POST
    if (EXCLUDED_PATHS.some((p) => url.startsWith(p))) {
      return done();
    }

    // Buscar el prefijo más largo que matchee
    let bestMatch: RouteEntityEntry | undefined;
    for (const entry of ROUTE_ENTITY_MAP) {
      if (url.startsWith(entry.prefix)) {
        if (!bestMatch || entry.prefix.length > bestMatch.prefix.length) {
          bestMatch = entry;
        }
      }
    }

    if (bestMatch) {
      broadcastDatos(bestMatch.entidad, accionFromMethod(request.method));
      if (bestMatch.secundarias) {
        for (const sec of bestMatch.secundarias) {
          broadcastDatos(sec, 'actualizar');
        }
      }
    }

    done();
  });
};

export default fp(broadcastPlugin, {
  name: 'broadcast-plugin',
  fastify: '5.x',
});
