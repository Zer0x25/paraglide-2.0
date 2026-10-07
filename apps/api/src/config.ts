import dotenv from 'dotenv';
import path from 'path';

// Carga robusta de .env: `npm run dev` puede tener cwd = repo root o apps/api
// según se lance vía `concurrently` o `--workspace`. Probamos todos los
// candidatos; dotenv no sobrescribe por defecto, así que el orden es seguro.
for (const p of [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../../.env'),
  path.resolve(process.cwd(), 'apps/api/.env'),
  path.resolve(__dirname, '../../../.env'),
]) {
  dotenv.config({ path: p });
}

const nodeEnv = process.env.NODE_ENV ?? 'development';

const jwtSecret = required('JWT_SECRET', nodeEnv === 'test' ? 'test-only-jwt-secret' : undefined);
// Defensa en profundidad: en producción nunca aceptar secretos por defecto
// conocidos (p. ej. el fallback de docker-compose) ni secretos triviales.
if (
  nodeEnv === 'production' &&
  (['change-me-in-production', 'test-only-jwt-secret', 'secret'].includes(jwtSecret) || jwtSecret.length < 16)
) {
  throw new Error('JWT_SECRET inválido en producción: define un secreto fuerte en el .env (sin valores por defecto)');
}

function required(name: string, testFallback?: string): string {
  const value = process.env[name] ?? testFallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function port(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error(`Invalid ${name}: ${process.env[name]}`);
  }
  return value;
}

export const config = {
  nodeEnv,
  host: process.env.HOST ?? '0.0.0.0',
  port: port('PORT', 3001),
  webUrl: process.env.PUBLIC_WEB_URL || 'http://localhost:3000',
  databaseUrl: required(
    'DATABASE_URL',
    nodeEnv === 'test' ? 'postgresql://localhost:5432/test' : undefined,
  ),
  jwtSecret,
  sentryDsn: process.env.SENTRY_DSN ?? '',
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  // Ubicación del centro de vuelo (Iquique / Alto Hospicio, Chile por defecto).
  // Usada por el módulo de meteorología para consultar Open-Meteo.
  centroLat: Number(process.env.CENTRO_LAT?.trim() || '-20.27'),
  centroLon: Number(process.env.CENTRO_LON?.trim() || '-70.13'),
  // Clave de servicio para agentes IA y servidores satélite (MCP).
  // En desarrollo se provee una clave fija si no está definida en .env.
  serviceApiKey: process.env.SERVICE_API_KEY || process.env.PARAPENTE_API_KEY || (nodeEnv === 'development' ? 'dev-mcp-service-key-12345' : undefined),
  // OAuth Google
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
  // Google Calendar API (Service Account)
  googleCalendarId: process.env.GOOGLE_CALENDAR_ID ?? '',
  googleCalendarClientEmail: process.env.GOOGLE_CALENDAR_CLIENT_EMAIL ?? '',
  googleCalendarPrivateKey: (process.env.GOOGLE_CALENDAR_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
};
