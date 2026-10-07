import dotenv from 'dotenv';
import path from 'path';

// Cargar variables de entorno desde la raíz del monorepo y desde apps/mcp
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'apps/mcp/.env') });

const isProduction = process.env.NODE_ENV === 'production';
// La clave de desarrollo jamás debe salir de desarrollo: en producción se exige
// la variable explícita (fail-fast al arrancar, sin fallbacks públicos).
if (isProduction && !process.env.PARAPENTE_API_KEY && !process.env.SERVICE_API_KEY) {
  throw new Error('PARAPENTE_API_KEY (o SERVICE_API_KEY) es obligatorio en producción');
}

export const mcpConfig = {
  apiUrl: process.env.PARAPENTE_API_URL || process.env.API_URL || 'http://localhost:3001/api',
  apiKey:
    process.env.PARAPENTE_API_KEY ||
    process.env.SERVICE_API_KEY ||
    (isProduction ? '' : 'dev-mcp-service-key-12345'),
  webUrl: process.env.PUBLIC_WEB_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  serverName: 'paraglide-mcp',
  serverVersion: '1.0.0',
};
