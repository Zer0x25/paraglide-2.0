import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('config - validación de JWT_SECRET en producción', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('permite iniciar en modo test si JWT_SECRET está definido', async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-secret';
    const { config } = await import('../../config.js');
    expect(config.jwtSecret).toBe('test-secret');
  });

  it('falla en producción si JWT_SECRET tiene menos de 32 caracteres (RFC 7518)', async () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'secreto-corto-de-20-caracter';
    await expect(import('../../config.js')).rejects.toThrow(
      'JWT_SECRET inválido en producción: define un secreto fuerte en el .env (sin valores por defecto)',
    );
  });

  it('falla en producción si JWT_SECRET es uno de los valores por defecto conocidos', async () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'change-me-in-production';
    await expect(import('../../config.js')).rejects.toThrow(
      'JWT_SECRET inválido en producción: define un secreto fuerte en el .env (sin valores por defecto)',
    );
  });

  it('permite iniciar en producción si JWT_SECRET tiene 32 o más caracteres seguros', async () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'un-secreto-muy-seguro-de-mas-de-32-caracteres-para-produccion';
    const { config } = await import('../../config.js');
    expect(config.jwtSecret).toBe('un-secreto-muy-seguro-de-mas-de-32-caracteres-para-produccion');
  });
});
