import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveSafeBaseUrl } from '../url.util';
import type { FastifyRequest } from 'fastify';

vi.mock('../../config', () => ({
  config: {
    webUrl: 'https://parapente.cl',
    allowedOrigins: ['https://app.parapente.cl', 'https://admin.parapente.cl'],
    nodeEnv: 'test',
  },
}));

import { config } from '../../config';

function mockRequest(
  headers: Record<string, string | undefined> = {},
  protocol = 'http',
): FastifyRequest {
  return {
    headers,
    protocol,
  } as unknown as FastifyRequest;
}

describe('resolveSafeBaseUrl', () => {
  beforeEach(() => {
    (config as any).nodeEnv = 'test';
  });

  it('permite localhost y 127.0.0.1 fuera de producción', () => {
    const req = mockRequest({ host: 'localhost:3000' }, 'http');
    expect(resolveSafeBaseUrl(req)).toBe('http://localhost:3000');

    const reqHttps = mockRequest({
      'x-forwarded-host': '127.0.0.1:3000',
      'x-forwarded-proto': 'https',
    });
    expect(resolveSafeBaseUrl(reqHttps)).toBe('https://127.0.0.1:3000');
  });

  it('rechaza nombres de contenedores internos de Docker y retorna canonicalBase', () => {
    const reqApi = mockRequest({ host: 'api:3001' });
    expect(resolveSafeBaseUrl(reqApi)).toBe('https://parapente.cl');

    const reqDb = mockRequest({ host: 'db:5432' });
    expect(resolveSafeBaseUrl(reqDb)).toBe('https://parapente.cl');

    const reqWeb = mockRequest({ host: 'web:3000' });
    expect(resolveSafeBaseUrl(reqWeb)).toBe('https://parapente.cl');
  });

  it('rechaza caracteres inválidos o inyecciones de ruta en el host', () => {
    const reqInjected = mockRequest({ host: 'evil.com/path' });
    expect(resolveSafeBaseUrl(reqInjected)).toBe('https://parapente.cl');

    const reqSpace = mockRequest({ host: 'evil .com' });
    expect(resolveSafeBaseUrl(reqSpace)).toBe('https://parapente.cl');
  });

  it('resuelve hosts configurados en allowedOrigins', () => {
    (config as any).nodeEnv = 'production';
    const req = mockRequest({
      'x-forwarded-host': 'app.parapente.cl',
      'x-forwarded-proto': 'https',
    });
    expect(resolveSafeBaseUrl(req)).toBe('https://app.parapente.cl');
  });

  it('en producción, bloquea hosts no autorizados y usa canonicalBase', () => {
    (config as any).nodeEnv = 'production';
    const req = mockRequest({
      'x-forwarded-host': 'attacker-site.com',
      'x-forwarded-proto': 'https',
    });
    expect(resolveSafeBaseUrl(req)).toBe('https://parapente.cl');
  });
});
