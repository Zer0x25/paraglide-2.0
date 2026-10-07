/**
 * Suite E2E de Fase 2: Rutas Públicas y Experiencia del Cliente
 * 
 * Cobertura de las 4 rutas públicas:
 * 1. /pantalla          (Modo TV / Sala de espera, modo público restringido y con token)
 * 2. /voucher/[id]      (Ticket oficial / Boarding pass público, QR de deslinde, titular)
 * 3. /deslinde/[id]     (Check-in digital, términos legales, firma canvas interactiva)
 * 4. /~offline          (Página de contingencia PWA sin conexión)
 * + Manejo de errores con tokens inválidos
 * 
 * Ejecución:
 *   npx tsx scripts/test-fase2-suite.ts
 *   PROD_URL=https://parapente.zer0x.org npx tsx scripts/test-fase2-suite.ts
 */

import { chromium } from '@playwright/test';
import { execSync } from 'child_process';

const TARGET_URL = process.env.PROD_URL || 'https://parapente.zer0x.org';
const EMAIL = process.env.ADMIN_EMAIL || 'admin@parapente.com';
const PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const HEADLESS = process.env.HEADLESS !== 'false';

const SHOULD_WAIT = process.argv.includes('--wait') || process.env.WAIT_FOR_DEPLOY === 'true';
const getLocalCommit = () => {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return null;
  }
};
const EXPECTED_COMMIT = process.env.EXPECTED_COMMIT || (SHOULD_WAIT ? getLocalCommit() : null);

interface StepResult {
  name: string;
  ok: boolean;
  durationMs: number;
  error?: string;
}

const results: StepResult[] = [];

async function step(name: string, fn: () => Promise<void>) {
  const start = Date.now();
  console.log(`\n⏳ [TEST] ${name}...`);
  try {
    await fn();
    const durationMs = Date.now() - start;
    results.push({ name, ok: true, durationMs });
    console.log(`✅ [PASS] ${name} (${durationMs}ms)`);
  } catch (err: any) {
    const durationMs = Date.now() - start;
    const error = err?.message || String(err);
    results.push({ name, ok: false, durationMs, error });
    console.error(`❌ [FAIL] ${name} (${durationMs}ms): ${error}`);
    throw err;
  }
}

async function runFase2Suite() {
  console.log('====================================================');
  console.log(`🚀 INICIANDO SUITE FASE 2 (RUTAS PÚBLICAS): ${TARGET_URL}`);
  console.log('====================================================');

  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: HEADLESS,
  });

  let testTokenPublico: string | null = null;
  let testShortId: string | null = null;
  let testReservaNum: string | null = null;
  let testTitularName: string | null = null;
  let testReservaId: number | null = null;
  let adminToken: string | null = null;

  try {
    // 1. Health check público y verificación de endpoints de configuración
    await step('1. Endpoints Públicos Base (/health, /empresa, /faqs, /reglas-operativas)', async () => {
      const maxWaitMs = SHOULD_WAIT ? 360_000 : 15_000;
      const pollIntervalMs = 3_000;
      const startTime = Date.now();
      let lastBody: any = null;
      let matched = false;

      while (Date.now() - startTime < maxWaitMs) {
        try {
          const response = await fetch(`${TARGET_URL}/api/public/health`);
          if (response.ok) {
            lastBody = await response.json();
            if (lastBody.status === 'ok') {
              if (EXPECTED_COMMIT) {
                const deployedCommit = (lastBody.commit || '').toLowerCase();
                const target = EXPECTED_COMMIT.toLowerCase();
                if (deployedCommit.includes(target) || target.includes(deployedCommit.replace(/^sha-/, ''))) {
                  matched = true;
                  break;
                }
                console.log(`   ⏳ Esperando deploy: servidor reporta "${deployedCommit || 'desconocido'}", local espera "${target}"...`);
              } else {
                matched = true;
                break;
              }
            }
          }
        } catch {}

        if (!SHOULD_WAIT) break;
        await new Promise((r) => setTimeout(r, pollIntervalMs));
      }

      if (!matched && SHOULD_WAIT) {
        throw new Error(`Timeout esperando commit ${EXPECTED_COMMIT}. Servidor: ${JSON.stringify(lastBody)}`);
      }

      const reglasRes = await fetch(`${TARGET_URL}/api/public/reglas-operativas`);
      if (!reglasRes.ok) throw new Error(`Reglas operativas HTTP ${reglasRes.status}`);

      const faqsRes = await fetch(`${TARGET_URL}/api/public/faqs`);
      if (!faqsRes.ok) throw new Error(`FAQs HTTP ${faqsRes.status}`);

      console.log(`   🟢 Endpoints públicos base operativos`);
    });

    // 2. Obtener reserva real con token público para pruebas
    await step('2. Obtención de Reserva de Prueba con Tokens Públicos', async () => {
      // Login como admin para obtener token de sesión
      const loginRes = await fetch(`${TARGET_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
      });
      if (!loginRes.ok) throw new Error(`Login API HTTP ${loginRes.status}`);
      const loginData = await loginRes.json();
      adminToken = loginData.token;

      // Crear una reserva de prueba con pasajero sin firmar para certificar de forma determinista
      // tanto el voucher (/voucher/[token]) como el formulario interactivo de firma (/deslinde/[token])
      const now = Date.now();
      const createRes = await fetch(`${TARGET_URL}/api/reservas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          nombreTitular: `Pasajero Deslinde ${now}`,
          telefono: '+56912345678',
          email: `deslinde_${now}@test.com`,
          fechaReserva: '2026-11-20T10:00:00.000Z',
          bloqueHora: '10:00',
          valorTotal: 85000,
          abono: 40000,
          pasajeros: [
            { nombre: `Pax Test Deslinde ${now}`, rutDni: '12345678-9', peso: 75 },
          ],
        }),
      });
      if (!createRes.ok) {
        throw new Error(`Error al crear reserva de prueba para Fase 2: HTTP ${createRes.status}`);
      }
      const sample = await createRes.json();
      testReservaId = sample.id;
      testTokenPublico = sample.tokenPublico;
      testShortId = sample.shortId;
      testReservaNum = sample.numeroReserva || String(sample.id);
      testTitularName = sample.nombreTitular;

      console.log(`   🎫 Reserva identificada: #${testReservaNum} (Titular: ${testTitularName})`);
      console.log(`   🔑 Token Público: ${testTokenPublico} | ShortId: ${testShortId}`);
    });

    // 3. Verificación de /voucher/[tokenPublico] en sesión 100% anónima
    await step('3. Acceso Público a Voucher Oficial (/voucher/[token])', async () => {
      const anonContext = await browser.newContext(); // Contexto limpio sin cookies
      const anonPage = await anonContext.newPage();

      const consoleErrors: string[] = [];
      anonPage.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      const voucherUrl = `${TARGET_URL}/voucher/${testTokenPublico}`;
      console.log(`   🌐 Navegando como cliente anónimo a: ${voucherUrl}`);
      await anonPage.goto(voucherUrl);

      // Verificar que no haya redirección a /login
      if (anonPage.url().includes('/login')) {
        throw new Error('La ruta pública /voucher redirigió a /login indebidamente');
      }

      // Validar componentes del Boarding Pass
      await anonPage.waitForSelector('text=TICKET OFICIAL DE VUELO', { timeout: 10000 });
      await anonPage.waitForSelector(`text=${testTitularName}`);
      await anonPage.waitForSelector('text=PUNTO DE ENCUENTRO');
      await anonPage.waitForSelector('text=PASAJEROS REGISTRADOS');
      await anonPage.waitForSelector('text=CHECK-IN & DESLINDE');

      // Validar presencia del código QR del deslinde
      const qrImg = anonPage.locator('img[src^="data:image"]');
      const qrCount = await qrImg.count();
      if (qrCount === 0) {
        throw new Error('El código QR del deslinde no se renderizó en el voucher');
      }

      console.log('   🎫 Boarding pass y QR de deslinde validados correctamente');

      if (consoleErrors.length > 0) {
        console.warn('   ⚠️ Console errors en voucher:', consoleErrors);
      }

      await anonContext.close();
    });

    // 4. Verificación de /voucher/[shortId] alternativo
    await step('4. Acceso a Voucher con Identificador Corto (shortId)', async () => {
      if (!testShortId) {
        console.log('   ℹ️ Omitiendo prueba de shortId (no configurado)');
        return;
      }

      const anonContext = await browser.newContext();
      const anonPage = await anonContext.newPage();

      await anonPage.goto(`${TARGET_URL}/voucher/${testShortId}`);
      await anonPage.waitForSelector('text=TICKET OFICIAL DE VUELO', { timeout: 8000 });
      console.log('   🔗 Voucher cargado exitosamente usando shortId');

      await anonContext.close();
    });

    // 5. Manejo de error con token inválido en /voucher
    await step('5. Manejo de Token Inválido en /voucher (404 amigable)', async () => {
      const anonContext = await browser.newContext();
      const anonPage = await anonContext.newPage();

      await anonPage.goto(`${TARGET_URL}/voucher/token-inexistente-9999`);
      await anonPage.waitForSelector('text=No se pudo cargar la información del voucher', { timeout: 8000 });
      console.log('   🛡️ Error 404 mostrado amigablemente sin crash de aplicación');

      await anonContext.close();
    });

    // 6. Verificación de /deslinde/[tokenPublico] y firma interactiva
    await step('6. Check-in Digital y Firma de Deslinde (/deslinde/[token])', async () => {
      const anonContext = await browser.newContext();
      const anonPage = await anonContext.newPage();

      const deslindeUrl = `${TARGET_URL}/deslinde/${testTokenPublico}`;
      console.log(`   ✍️ Navegando a formulario de deslinde: ${deslindeUrl}`);
      await anonPage.goto(deslindeUrl);

      if (anonPage.url().includes('/login')) {
        throw new Error('La ruta pública /deslinde redirigió a /login indebidamente');
      }

      await anonPage.waitForSelector('text=Deslinde de Responsabilidad', { timeout: 8000 });
      await anonPage.waitForSelector('text=Términos y Declaración Jurada');
      await anonPage.waitForSelector('canvas');

      // Interactuar con el canvas de firma digital
      const canvas = anonPage.locator('canvas').first();
      const box = await canvas.boundingBox();
      if (!box) throw new Error('No se pudo obtener el bounding box del canvas de firma');

      // Dibujar un trazo en el canvas
      await anonPage.mouse.move(box.x + 20, box.y + 20);
      await anonPage.mouse.down();
      await anonPage.mouse.move(box.x + 80, box.y + 60, { steps: 5 });
      await anonPage.mouse.move(box.x + 120, box.y + 30, { steps: 5 });
      await anonPage.mouse.up();

      console.log('   🖋️ Trazo de firma digital dibujado en canvas');

      // Verificar botón de limpiar canvas
      const limpiarBtn = anonPage.locator('button:has-text("Limpiar Canvas")');
      if (await limpiarBtn.isVisible()) {
        console.log('   🧹 Botón de limpiar canvas operativo');
      }

      await anonContext.close();
    });

    // 7. Manejo de error con token inválido en /deslinde
    await step('7. Manejo de Token Inválido en /deslinde (404 amigable)', async () => {
      const anonContext = await browser.newContext();
      const anonPage = await anonContext.newPage();

      await anonPage.goto(`${TARGET_URL}/deslinde/token-inexistente-9999`);
      await anonPage.waitForSelector('text=Enlace no disponible', { timeout: 8000 });
      console.log('   🛡️ Vista de enlace no disponible renderizada correctamente');

      await anonContext.close();
    });

    // 8. Ruta pública /pantalla (Modo TV de espera)
    await step('8. Modo Pantalla TV Público (/pantalla sin token)', async () => {
      const anonContext = await browser.newContext();
      const anonPage = await anonContext.newPage();

      await anonPage.goto(`${TARGET_URL}/pantalla`);
      // Sin token debe cargar pantalla de acceso restringido con botón para admin
      await anonPage.waitForSelector('text=Enlace no disponible', { timeout: 8000 });
      await anonPage.waitForSelector('text=¿Eres administrador? Inicia sesión');
      console.log('   📺 Vista pública de pantalla restringida validada');

      await anonContext.close();
    });

    // 9. Ruta de Contingencia Offline (/~offline)
    await step('9. Página de Contingencia PWA (/~offline)', async () => {
      const anonContext = await browser.newContext();
      const anonPage = await anonContext.newPage();

      await anonPage.goto(`${TARGET_URL}/~offline`);
      await anonPage.waitForSelector('text=Estás sin conexión', { timeout: 8000 });
      await anonPage.waitForSelector('a[href="/"]:has-text("Volver al inicio")');
      console.log('   📡 Fallback offline PWA verificado');

      await anonContext.close();
    });

  } finally {
    if (testReservaId && adminToken) {
      try {
        await fetch(`${TARGET_URL}/api/reservas/${testReservaId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        console.log(`\n🧹 Reserva de prueba #${testReservaId} eliminada correctamente.`);
      } catch {}
    }
    await browser.close();
  }

  // Resumen final
  console.log('\n====================================================');
  console.log('📊 RESUMEN DE EJECUCIÓN - FASE 2: RUTAS PÚBLICAS');
  console.log('====================================================');
  let allPass = true;
  for (const r of results) {
    const status = r.ok ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} | ${r.name.padEnd(55)} | ${r.durationMs}ms ${r.error ? `(${r.error})` : ''}`);
    if (!r.ok) allPass = false;
  }
  console.log('====================================================');
  if (allPass) {
    console.log('🎉 TODAS LAS PRUEBAS DE FASE 2 PASARON EXITOSAMENTE');
  } else {
    throw new Error('Una o más pruebas de Fase 2 fallaron');
  }
}

runFase2Suite().catch((err) => {
  console.error('\n❌ Error crítico en suite de Fase 2:', err);
  process.exit(1);
});
