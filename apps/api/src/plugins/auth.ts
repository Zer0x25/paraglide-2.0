import fp from 'fastify-plugin';
import crypto from 'crypto';
import fastifyJwt, { FastifyJWTOptions } from '@fastify/jwt';
import { FastifyRequest, FastifyReply } from 'fastify';
import { Role } from '@parapente/shared';
import { config } from '../config';

/** Comparación timing-safe de la API key de servicio (evita ataques de timing). */
function apiKeyMatches(apiKey: string, expected: string): boolean {
  const a = Buffer.from(apiKey, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authorize: (roles: Role[]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      id: number;
      email: string;
      nombre: string;
      role: Role;
      pilotoId?: number | null;
      sv: number;
    };
    user: {
      id: number;
      email: string;
      nombre: string;
      role: Role;
      pilotoId?: number | null;
      sv: number;
    };
  }
}

// ADR 013: valida que el claim `sv` del JWT coincida con sessionVersion del
// usuario. Si no coincide (sesión revocada por un login más reciente), 401.
async function assertSessionValida(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<boolean> {
  const decoded = request.user;
  // Agente MCP / Service token: no tiene registro efímero en tabla User
  if (decoded?.id === 0) return true;

  const user = await request.server.prisma.user.findUnique({
    where: { id: decoded.id, deletedAt: null },
  });
  if (!user || user.sessionVersion !== decoded.sv) {
    reply.status(401).send({
      statusCode: 401,
      code: 'SESSION_REVOKED',
      message: 'Sesión cerrada en otro dispositivo',
    });
    return false;
  }
  return true;
}

function extractApiKey(request: FastifyRequest): string | null {
  const apiKeyHeader = request.headers['x-api-key'];
  if (typeof apiKeyHeader === 'string' && apiKeyHeader.trim()) return apiKeyHeader.trim();
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith('ApiKey ')) {
    return authHeader.slice(7).trim();
  }
  return null;
}

function setMcpUser(request: FastifyRequest) {
  request.user = {
    id: 0,
    email: 'agente-mcp@parapente.com',
    nombre: 'Agente MCP',
    role: 'RECEPCION',
    sv: 0,
  };
}

export default fp(async (fastify) => {
  fastify.register(fastifyJwt, {
    secret: config.jwtSecret,
  });

  fastify.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
    const apiKey = extractApiKey(request);
    if (apiKey && config.serviceApiKey && apiKeyMatches(apiKey, config.serviceApiKey)) {
      setMcpUser(request);
      return;
    }

    try {
      await request.jwtVerify();
    } catch (err) {
      return reply.send(err);
    }
    if (!(await assertSessionValida(request, reply))) return;
  });

  fastify.decorate('authorize', function (roles: Role[]) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const apiKey = extractApiKey(request);
      if (apiKey && config.serviceApiKey && apiKeyMatches(apiKey, config.serviceApiKey)) {
        setMcpUser(request);
        if (!roles.includes(request.user.role)) {
          return reply.status(403).send({
            statusCode: 403,
            error: 'Forbidden',
            message: 'No tienes permisos para acceder a este recurso'
          });
        }
        return;
      }

      try {
        await request.jwtVerify();
      } catch (err) {
        return reply.send(err);
      }
      if (!roles.includes(request.user.role)) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'No tienes permisos para acceder a este recurso'
        });
      }
      if (!(await assertSessionValida(request, reply))) return;
    };
  });
});
