import { FastifyInstance } from 'fastify';
import { AuthService } from '../services/auth.service';
import { LoginPayloadSchema, LoginPayload, AuthResponse, GoogleLoginPayloadSchema, GoogleLoginPayload } from '@parapente/shared';
import { config } from '../config';

export default async function authRoutes(fastify: FastifyInstance) {
  const authService = new AuthService(fastify);

  fastify.get(
    '/config',
    async (_request, reply) => {
      return reply.send({
        googleClientId: config.googleClientId || '',
      });
    }
  );

  fastify.post<{ Body: LoginPayload, Reply: AuthResponse }>(
    '/login',
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      // Validate manually since we are not using the ZodTypeProvider here
      const parsedBody = LoginPayloadSchema.parse(request.body);
      
      const response = await authService.login(parsedBody);
      return reply.send(response);
    }
  );

  fastify.post<{ Body: GoogleLoginPayload, Reply: AuthResponse }>(
    '/google',
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      const parsedBody = GoogleLoginPayloadSchema.parse(request.body);
      const response = await authService.loginGoogle(parsedBody);
      return reply.send(response);
    }
  );
}
