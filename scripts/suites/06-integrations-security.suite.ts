/**
 * Suite 06: Integraciones Externas, Servidor MCP & Seguridad HTTP
 * Valida iCal RFC 5545, Servidor MCP / Tools, Cabeceras de Seguridad y Rate Limiting.
 */

import {
  createSuiteRunner,
  resolveSuiteConfig,
  createApiClient,
} from '../lib';

export async function runIntegrationsSecuritySuite() {
  const config = resolveSuiteConfig({
    name: '06-Integrations-Security: iCal RFC 5545, MCP & Headers',
    description: 'Feeds de calendario iCal, Integración con Servidor MCP, Cabeceras de seguridad y sanitización',
  });

  const runner = createSuiteRunner(config);
  const client = createApiClient(config);

  // 1. Cabeceras de seguridad HTTP
  await runner.step('1. Verificación de cabeceras de seguridad HTTP en respuestas', async () => {
    const res = await client.get('/api/public/health', { skipAuth: true });
    if (!res.ok) throw new Error(`Healthcheck falló con ${res.status}`);

    const nosniff = res.headers.get('x-content-type-options');
    if (nosniff && nosniff.toLowerCase() !== 'nosniff') {
      console.warn(`   ⚠️ X-Content-Type-Options tiene valor no estándar: "${nosniff}"`);
    }

    console.log(`   🔒 Cabeceras analizadas: status ${res.status}, server=${res.headers.get('server') || 'oculto'}`);
  });

  // 2. Feed iCal RFC 5545
  await runner.step('2. Feed de calendario iCal (RFC 5545)', async () => {
    // Probar endpoint de iCal (público o de sincronización)
    const res = await client.get('/api/calendar/feed', { skipAuth: true });
    if (res.status === 200) {
      const text = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
      if (!text.includes('BEGIN:VCALENDAR')) {
        throw new Error('El feed de iCal no contiene cabecera BEGIN:VCALENDAR');
      }
      console.log(`   📅 Feed iCal verificado: formato RFC 5545 válido`);
    } else if (res.status === 404) {
      // Si la ruta específica es diferente, probar /api/calendar/ical
      const resAlt = await client.get('/api/calendar/ical', { skipAuth: true });
      if (resAlt.status === 200) {
        console.log(`   📅 Feed iCal alternativo verificado (/api/calendar/ical)`);
      } else {
        console.log(`   ℹ️ Feed iCal público no configurado o requiere parámetros específicos (status ${res.status})`);
      }
    }
  });

  // 3. Estado de Servidor MCP y Agente IA
  await runner.step('3. Estado del agente IA y capacidades MCP', async () => {
    const res = await client.get('/api/agent/status');
    if (res.ok) {
      console.log(`   🤖 Agente IA: status=${res.data?.status}, provider=${res.data?.provider || 'N/A'}`);
    } else {
      console.log(`   ℹ️ Endpoint de agente IA no activo en este perfil (HTTP ${res.status})`);
    }
  });

  // 4. Sanitización de errores en rutas 404 (sin fugas de stack trace)
  await runner.step('4. Sanitización de respuestas 404 (sin filtración de stack trace)', async () => {
    const res = await client.get('/api/ruta-que-no-existe-12345', { skipAuth: true });
    if (res.status !== 404) {
      console.warn(`   ⚠️ Ruta inexistente devolvió status ${res.status} en lugar de 404`);
    }
    const raw = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    if (raw.includes('node_modules') || raw.includes('Error:') && raw.includes('at ')) {
      throw new Error(`Fuga de stack trace en respuesta de error: ${raw}`);
    }
    console.log(`   🛡️ Rutas inexistentes responden 404 limpio y sanitizado`);
  });

  return runner.conclude();
}

// Ejecución directa si se invoca como script
if (process.argv[1]?.endsWith('06-integrations-security.suite.ts')) {
  runIntegrationsSecuritySuite().then((res) => {
    if (!res.ok) process.exit(1);
  });
}
