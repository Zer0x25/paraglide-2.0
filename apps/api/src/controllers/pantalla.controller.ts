import { FastifyRequest, FastifyReply } from 'fastify';
import { pantallaTokensService, PantallaTokenTipo } from '../services/pantallaTokens.service';
import { resolveSafeBaseUrl } from '../utils/url.util';

function buildUrl(req: FastifyRequest, token: string): string {
  const baseUrl = resolveSafeBaseUrl(req);
  return `${baseUrl}/pantalla?token=${token}`;
}

function parseTipo(raw?: string): PantallaTokenTipo | null {
  const tipo = (raw || 'DIARIO').toUpperCase();
  return tipo === 'DIARIO' || tipo === 'TV' ? tipo : null;
}

export class PantallaController {
  async getLink(req: FastifyRequest, reply: FastifyReply) {
    const tipo = parseTipo((req.query as any)?.tipo);
    if (!tipo) {
      return reply.code(400).send({ message: 'tipo debe ser DIARIO o TV' });
    }
    const { token, expiraEn } = await pantallaTokensService.getOrCreate(tipo, req.user.id);
    return reply.send({ tipo, token, expiraEn, url: buildUrl(req, token) });
  }

  async regenerate(req: FastifyRequest, reply: FastifyReply) {
    const tipo = parseTipo((req.query as any)?.tipo);
    if (!tipo) {
      return reply.code(400).send({ message: 'tipo debe ser DIARIO o TV' });
    }
    const { token, expiraEn } = await pantallaTokensService.regenerar(tipo, req.user.id);
    return reply.send({ tipo, token, expiraEn, url: buildUrl(req, token) });
  }
}

export const pantallaController = new PantallaController();
