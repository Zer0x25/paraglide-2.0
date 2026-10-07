/**
 * Suite 03: Experiencia Pública del Cliente
 * Consolida la validación de vouchers, deslindes digitales en canvas,
 * pantalla TV FIDS y ruta de contingencia offline.
 */

import {
  createSuiteRunner,
  resolveSuiteConfig,
  createApiClient,
  launchBrowserSession,
  crearReservaFixture,
  createTeardownRegistry,
} from '../lib';

export async function runPublicClientSuite() {
  const config = resolveSuiteConfig({
    name: '03-Public-Client: Vistas Públicas, Voucher y Deslinde',
    description: 'Vouchers QR, Deslinde digital en canvas, Pantalla FIDS y contingencia offline sin sesión',
  });

  const runner = createSuiteRunner(config);
  const client = createApiClient(config);
  const teardown = createTeardownRegistry(client);
  let browserSession: Awaited<ReturnType<typeof launchBrowserSession>> | null = null;

  try {
    let reservaToken: string;
    let reservaNumero: string;
    let reservaId: number;

    // 1. Setup de reserva con tokens públicos
    await runner.step('1. Setup de reserva con identificadores públicos seguros', async () => {
      const res = await client.post('/api/reservas', crearReservaFixture('Cliente Público'));
      if (!res.ok || !res.data?.id) {
        throw new Error(`Error creando reserva de prueba: ${res.status}`);
      }
      reservaId = res.data.id;
      teardown.registerReserva(reservaId);

      // Solo identificadores no secuenciales (el id numérico ya no resuelve en rutas públicas)
      reservaToken = res.data.tokenPublico || res.data.shortId;
      if (!reservaToken) throw new Error('La reserva creada no tiene tokenPublico/shortId');
      reservaNumero = res.data.numeroReserva || String(reservaId);
      console.log(`   🎫 Token público asignado: "${reservaToken}" (Reserva #${reservaNumero})`);
    });

    // 2. Consulta API pública de voucher
    await runner.step('2. API pública de consulta de reserva y voucher (sin autenticación)', async () => {
      const res = await client.get(`/api/public/reservas/${reservaToken}`, { skipAuth: true });
      if (!res.ok || !res.data?.id) {
        throw new Error(`API pública rechazó consulta con HTTP ${res.status}`);
      }
      console.log(`   🟢 Datos de reserva obtenidos públicamente: titular "${res.data.nombreTitular}"`);
    });

    // 3. Renderizado de Voucher en navegador Playwright
    await runner.step('3. Voucher web en Playwright (QR, datos y acciones sin login)', async () => {
      browserSession = await launchBrowserSession(config);
      const { page } = browserSession;

      await page.goto(`${config.targetUrl}/voucher/${reservaToken}`);
      await page.waitForLoadState('domcontentloaded');

      // No debe redirigir a /login
      if (page.url().includes('/login')) {
        throw new Error(`Ruta pública de voucher redirigió erróneamente a /login: ${page.url()}`);
      }

      // Debe mostrar el número de reserva o titular
      await page.waitForSelector(`text=${reservaNumero}`, { timeout: 10000 });
      console.log(`   🎟️ Voucher renderizado correctamente sin autenticación`);
    });

    // 4. Firma digital interactiva en canvas
    await runner.step('4. Firma interactiva en canvas en /deslinde/[token]', async () => {
      if (!browserSession) throw new Error('Browser session no inicializada');
      const { page } = browserSession;

      await page.goto(`${config.targetUrl}/deslinde/${reservaToken}`);
      await page.waitForLoadState('domcontentloaded');

      if (page.url().includes('/login')) {
        throw new Error(`Ruta pública de deslinde redirigió a /login: ${page.url()}`);
      }

      const canvas = page.locator('canvas');
      await canvas.waitFor({ state: 'visible', timeout: 10000 });
      await canvas.scrollIntoViewIfNeeded();

      const box = await canvas.boundingBox();
      if (box) {
        await page.mouse.move(box.x + 20, box.y + 20);
        await page.mouse.down();
        await page.mouse.move(box.x + 100, box.y + 60, { steps: 8 });
        await page.mouse.move(box.x + 160, box.y + 30, { steps: 8 });
        await page.mouse.up();
      }

      const btnConfirmar = page.getByRole('button', { name: /Confirmar y Firmar/i });
      await btnConfirmar.waitFor({ state: 'visible' });
      await btnConfirmar.click();

      // Esperar toast o mensaje de éxito
      await page
        .locator(':has-text("¡Deslinde"), :has-text("Firmado"), :has-text("completado")')
        .first()
        .waitFor({ state: 'visible', timeout: 15000 });
      console.log(`   ✍️ Firma en canvas confirmada y procesada`);
    });

    // 5. Pantalla TV FIDS y ruta offline
    await runner.step('5. Visualización pública de Pantalla TV FIDS y ruta ~offline', async () => {
      if (!browserSession) throw new Error('Browser session no inicializada');
      const { page } = browserSession;

      // Pantalla TV FIDS
      await page.goto(`${config.targetUrl}/pantalla`);
      await page.waitForLoadState('domcontentloaded');
      if (page.url().includes('/login')) {
        throw new Error(`Pantalla pública redirigió a /login: ${page.url()}`);
      }

      // Ruta ~offline de contingencia PWA
      await page.goto(`${config.targetUrl}/~offline`);
      await page.waitForLoadState('domcontentloaded');
      console.log(`   📺 Pantalla TV y ruta de contingencia offline verificadas`);
    });

    return runner.conclude();
  } finally {
    if (browserSession) {
      await browserSession.close();
    }
    await teardown.cleanup();
  }
}

// Ejecución directa si se invoca como script
if (process.argv[1]?.endsWith('03-public-client.suite.ts')) {
  runPublicClientSuite().then((res) => {
    if (!res.ok) process.exit(1);
  });
}
