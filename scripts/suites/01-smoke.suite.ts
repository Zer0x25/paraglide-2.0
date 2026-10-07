/**
 * Suite 01: Smoke & Sanity Testing
 * Valida estado de salud, despliegue, autenticación y navegación básica.
 */

import {
  createSuiteRunner,
  resolveSuiteConfig,
  createApiClient,
  launchBrowserSession,
  loginUi,
  waitForDeployment,
} from '../lib';

export async function runSmokeSuite() {
  const config = resolveSuiteConfig({
    name: '01-Smoke: Sanity & Healthcheck',
    description: 'Verificación de salud de API, commit de despliegue, autenticación y navegación básica',
  });

  const runner = createSuiteRunner(config);
  const client = createApiClient(config);
  let browserSession: Awaited<ReturnType<typeof launchBrowserSession>> | null = null;

  try {
    // 1. Espera de despliegue / Healthcheck
    await runner.step('1. Healthcheck de API pública y verificación de commit', async () => {
      await waitForDeployment(config.targetUrl, config.expectedCommit, config.waitForDeploy ? 300000 : 10000);
      const res = await client.get('/api/public/health', { skipAuth: true });
      if (!res.ok || res.data?.status !== 'ok') {
        throw new Error(`API healthcheck falló con HTTP ${res.status}: ${JSON.stringify(res.data)}`);
      }
      console.log(`   🟢 API Saludable: status=${res.data.status}, commit=${res.data.commit || 'N/A'}`);
    });

    // 2. Autenticación administrativa
    await runner.step('2. Autenticación administrativa (Login API JWT)', async () => {
      const token = await client.getAuthToken(true);
      if (!token || token.length < 20) {
        throw new Error('No se recibió un token JWT válido');
      }
      console.log(`   🔑 Token JWT obtenido correctamente`);
    });

    // 3. Módulos del sistema
    await runner.step('3. Consulta de módulos activos del sistema', async () => {
      const res = await client.get('/api/modules');
      if (!res.ok) {
        throw new Error(`Fallo al consultar módulos: HTTP ${res.status}`);
      }
      const modules = res.data?.modules || [];
      console.log(`   📦 Módulos configurados: ${modules.map((m: any) => m.id).join(', ')}`);
    });

    // 4. Catálogos y entidades core
    await runner.step('4. Validación de contratos core (Pilotos, Reservas y Vuelos)', async () => {
      const [resPilotos, resReservas, resVuelos] = await Promise.all([
        client.get('/api/pilotos?pageSize=5'),
        client.get('/api/reservas?pageSize=5'),
        client.get('/api/vuelos?pageSize=5'),
      ]);

      if (!resPilotos.ok || !resReservas.ok || !resVuelos.ok) {
        throw new Error('Fallo al consultar listados core con envelope ADR 005');
      }

      const pilotos = client.unwrapList(resPilotos);
      const reservas = client.unwrapList(resReservas);
      const vuelos = client.unwrapList(resVuelos);

      console.log(`   📊 Datos iniciales: ${pilotos.length} pilotos, ${reservas.length} reservas, ${vuelos.length} vuelos`);
    });

    // 5. Navegación UI en navegador real
    await runner.step('5. Navegación Web UI con Playwright (Dashboard y Login)', async () => {
      browserSession = await launchBrowserSession(config);
      await loginUi(browserSession, config);

      const { page } = browserSession;
      await page.waitForSelector('text=Panel de Control', { timeout: 10000 });

      // Navegar a calendario
      await page.goto(`${config.targetUrl}/calendario`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('.rbc-calendar, [data-testid="calendario"]', { timeout: 15000 });

      if (browserSession.consoleErrors.length > 0) {
        console.warn(`   ⚠️ Errores de consola detectados en UI:`, browserSession.consoleErrors);
      }
    });

    return runner.conclude();
  } finally {
    if (browserSession) {
      await browserSession.close();
    }
  }
}

// Ejecución directa si se invoca como script
if (process.argv[1]?.endsWith('01-smoke.suite.ts')) {
  runSmokeSuite().then((res) => {
    if (!res.ok) process.exit(1);
  });
}
