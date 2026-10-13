import type { FastifyRequest } from 'fastify';
import { config } from '../config';

function extractHost(urlOrOrigin: string): string | null {
  try {
    const parsed = new URL(urlOrOrigin.includes('://') ? urlOrOrigin : `http://${urlOrOrigin}`);
    return parsed.host.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Resuelve la URL base pública de forma segura evitando ataques de Host Header Injection
 * al generar enlaces que contienen tokens sensibles (?token=...).
 *
 * - Ignora hosts internos de Docker (api:*, db:*, web:*).
 * - Rechaza cabeceras con caracteres inválidos o rutas inyectadas.
 * - En producción, valida que el host recibido pertenezca a PUBLIC_WEB_URL o ALLOWED_ORIGINS;
 *   si no coincide, utiliza config.webUrl como fallback canónico seguro.
 */
export function resolveSafeBaseUrl(req: FastifyRequest): string {
  const canonicalBase = (config.webUrl || 'http://localhost:3000').replace(/\/+$/, '');
  const forwardedHost = (req.headers['x-forwarded-host'] as string | undefined)
    ?.split(',')[0]
    ?.trim();
  const forwardedProto = (req.headers['x-forwarded-proto'] as string | undefined)
    ?.split(',')[0]
    ?.trim();
  const rawHost = (req.headers['host'] as string | undefined)?.trim();

  const candidateHost = (forwardedHost || rawHost || '').toLowerCase();
  const rawProto = (forwardedProto || req.protocol || 'http').toLowerCase();
  const protocol = rawProto === 'https' ? 'https' : 'http';

  if (
    !candidateHost ||
    !/^[a-z0-9.\-:[\]]+$/.test(candidateHost) ||
    candidateHost.startsWith('api:') ||
    candidateHost.startsWith('db:') ||
    candidateHost.startsWith('web:')
  ) {
    return canonicalBase;
  }

  const isLocalHost =
    candidateHost === 'localhost' ||
    candidateHost.startsWith('localhost:') ||
    candidateHost === '127.0.0.1' ||
    candidateHost.startsWith('127.0.0.1:');

  if (config.nodeEnv !== 'production' && isLocalHost) {
    return `${protocol}://${candidateHost}`;
  }

  const trustedHosts = new Set<string>();
  const webHost = extractHost(canonicalBase);
  if (webHost) trustedHosts.add(webHost);
  for (const origin of config.allowedOrigins) {
    const h = extractHost(origin);
    if (h) trustedHosts.add(h);
  }

  if (trustedHosts.has(candidateHost)) {
    return `${protocol}://${candidateHost}`;
  }

  // Si en producción el Host no está en la lista blanca configurada, usar siempre PUBLIC_WEB_URL
  return canonicalBase;
}
