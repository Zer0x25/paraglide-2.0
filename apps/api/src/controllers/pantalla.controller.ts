import { FastifyRequest, FastifyReply } from 'fastify';
import { pantallaTokensService, PantallaTokenTipo } from '../services/pantallaTokens.service';
import { config } from '../config';

function buildUrl(req: FastifyRequest, token: string): string {
  // Deducir la URL base del request (Host + protocolo reenviados por Caddy/Cloudflare),
  // en lugar de fijar PUBLIC_WEB_URL. Así funciona en prod, dev y test.prod sin config.
  const protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
  const host =
    (req.headers['x-forwarded-host'] as string) ||
    (req.headers.host as string) ||
    config.webUrl.replace(/^https?:\/\//, '');
  return `${protocol}://${host}/pantalla?token=${token}`;
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
