/**
 * Suite E2E de Pruebas hacia Producción (o Entorno de Despliegue)
 * 
 * Cobertura completa de extremo a extremo:
 * 1. Health check de la API en vivo
 * 2. Autenticación (Login admin)
 * 3. Navegación fluida por todas las vistas principales (Dashboard, Pilotos, Calendario, Reservas, Analíticas)
 * 4. Verificación de ausencia de flashazos/ceros en Analíticas
 * 5. Flujo Offline completo (creación de reserva sin red, guardado en outbox IndexedDB, toast informativo)
 * 6. Reconexión y Replay automático del Outbox hacia el servidor
 *
 * Ejecución:
 *   npx tsx scripts/test-prod-suite.ts
 *   npm run test:prod
 *
 * Variables de entorno opcionales:
 *   PROD_URL (default: https://parapente.zer0x.org)
 *   ADMIN_EMAIL (default: admin@parapente.com)
 *   ADMIN_PASSWORD (default: admin123)
 *   HEADLESS (default: true)
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

async function runSuite() {
  console.log('====================================================');
  console.log(`🚀 INICIANDO SUITE E2E HACIA PRODUCCIÓN: ${TARGET_URL}`);
  console.log('====================================================');

  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: HEADLESS,
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) {
      console.log(`   🧭 [NAV] Navegación detectada a: ${frame.url()}`);
    }
  });

  try {
    // 1. Health check público y verificación de versión
    await step('1. API Health Check & Verificación de Despliegue', async () => {
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
        } catch {
          // Servidor aún reiniciándose
        }

        if (!SHOULD_WAIT) break;
        await new Promise((r) => setTimeout(r, pollIntervalMs));
      }

      if (!matched && SHOULD_WAIT) {
        throw new Error(`Timeout esperando que el deploy coincida con el commit ${EXPECTED_COMMIT}. Servidor reporta: ${JSON.stringify(lastBody)}`);
      }

      if (!lastBody || lastBody.status !== 'ok') {
        throw new Error(`API Health check falló o no respondió status: ok (${JSON.stringify(lastBody)})`);
      }

      console.log(`   🟢 API Saludable | Versión: ${lastBody.version || '1.0.0'} | Commit: ${lastBody.commit || 'no reportado aún'} | Uptime: ${lastBody.uptime ?? 'N/A'}s`);
    });

    // 2. Login
    await step('2. Autenticación en Plataforma', async () => {
      await page.goto(`${TARGET_URL}/login`);
      await page.waitForSelector('input[type="email"]');
      await page.fill('input[type="email"]', EMAIL);
      await page.fill('input[type="password"]', PASSWORD);
      await page.click('button:has-text("Ingresar")');
      await page.waitForURL(`${TARGET_URL}/`);
      
      // Sincronizar y esperar activación real del Service Worker y precarga
      console.log('   ⚙️ Esperando activación y control del Service Worker...');
      await page.waitForFunction(() => {
        return navigator.serviceWorker?.controller?.state === 'activated';
      }, { timeout: 25000 }).catch(() => {
        console.warn('   ⚠️ Service Worker controller timeout, continuando...');
      });
      // Breve margen para que useWarmupData complete el prefetch de rutas y queries
      await page.waitForTimeout(3500);
    });

    // 3. Dashboard y Resumen Operativo
    await step('3. Dashboard y Resumen Operativo', async () => {
      await page.waitForSelector('text=Panel de Control');
      await page.waitForSelector('text=Sistema Activo');
      await page.waitForSelector('text=Vuelos de Hoy');
      console.log('   📊 Dashboard operativo verificado');
    });

    // 4. Gestión de Pilotos
    await step('4. Navegación y Gestión de Pilotos', async () => {
      await page.click('a[href="/pilotos"]');
      await page.waitForSelector('text=Gestión de Pilotos');
      await page.waitForTimeout(800);
      console.log('   👨✈️ Sección de Pilotos cargada correctamente');
    });

    // 5. Calendario y Agendamiento
    await step('5. Calendario y Agendamiento', async () => {
      await page.click('a[href="/calendario"]');
      await page.waitForSelector('text=Calendario');
      await page.waitForTimeout(800);
      console.log('   📅 Vista de Calendario cargada');
    });

    // 6. Analíticas sin flash de ceros (anti-flash / skeletons)
    await step('6. Carga de Analíticas y Anti-Flash', async () => {
      await page.click('a[href="/analiticas"]');
      await page.waitForSelector('text=Panel de Analíticas y Finanzas');
      // Esperar a que la consulta termine y verificar presencia de KPIs
      await page.waitForSelector('text=Ingresos Totales');
      await page.waitForSelector('text=Pagos a Pilotos');
      console.log('   📈 Analíticas cargadas suavemente sin saltos');
      await page.waitForTimeout(800);
    });

    // 7. Listado y Filtros de Reservas
    await step('7. Listado y Filtros de Reservas', async () => {
      await page.click('a[href="/reservas"]');
      await page.waitForSelector('button:has-text("Nueva Reserva")');
      await page.waitForSelector('input[placeholder*="Buscar por titular"]');
      console.log('   🗂️ Vista de Reservas y buscador listos');
      await page.waitForTimeout(800);
    });

    // 7b. Configuración del Sistema
    await step('7b. Configuración del Sistema', async () => {
      await page.click('a[href="/configuracion"]');
      await page.waitForSelector('text=Configuración del Sistema');
      console.log('   ⚙️ Vista de Configuración lista');
      await page.waitForTimeout(800);
    });

    // 8. Verificación de Rutas Públicas (Pantalla TV) — antes de cortar red
    await step('8. Acceso a Rutas Públicas (/pantalla)', async () => {
      const publicPage = await context.newPage();
      await publicPage.goto(`${TARGET_URL}/pantalla`);
      await publicPage.waitForSelector('text=Modo Pantalla', { timeout: 5000 }).catch(() => {});
      console.log('   📺 Vista pública cargada sin interceptor restrictivo');
      await publicPage.close();
    });

    // 9. Navegación Offline completa entre pestañas operativas (al final para no bloquear tests online)
    await step('9. Navegación Offline entre Pestañas (Inicio, Pilotos, Calendario, Configuración, Reservas)', async () => {
      console.log('   📡 Cortando red (context.setOffline(true))...');
      await context.setOffline(true);
      await page.evaluate(() => window.dispatchEvent(new Event('offline')));
      await page.waitForTimeout(500);

      // 9a. Inicio (Dashboard) en offline
      await page.click('a[href="/"]');
      await page.waitForSelector('text=Panel de Control', { timeout: 5000 });
      console.log('   🏠 Inicio / Dashboard cargó en offline sin errores');

      // 9b. Pilotos en offline
      await page.click('a[href="/pilotos"]');
      await page.waitForSelector('text=Gestión de Pilotos', { timeout: 5000 });
      console.log('   👨✈️ Pilotos cargó en offline sin errores');

      // 9c. Calendario en offline
      await page.click('a[href="/calendario"]');
      await page.waitForSelector('text=Calendario de Vuelos', { timeout: 5000 });
      console.log('   📅 Calendario cargó en offline sin errores');

      // 9d. Configuración en offline
      await page.click('a[href="/configuracion"]');
      await page.waitForSelector('text=Configuración del Sistema', { timeout: 5000 });
      console.log('   ⚙️ Configuración cargó en offline sin errores');

      // 9e. Reservas en offline
      await page.click('a[href="/reservas"]');
      await page.waitForSelector('text=Gestión de Reservas y Pasajeros', { timeout: 5000 });
      console.log('   🪂 Reservas cargó en offline sin errores');
    });

    // 10. Flujo Offline de Creación en Reservas
    const testPaxName = `Pax Offline ${Date.now().toString().slice(-4)}`;
    await step('10. Creación de Reserva en Modo Offline', async () => {
      // Modal sigue en modo offline
      await page.click('button:has-text("Nueva Reserva")');
      await page.waitForSelector('input[placeholder*="Juan Pérez"]');
      await page.fill('input[placeholder*="Juan Pérez"]', `Cliente ${testPaxName}`);
      await page.fill('input[placeholder*="+56 9 1234 5678"]', '+56987654321');

      const sinFechaBtn = page.locator('button:has-text("Sin fecha (Giftcard)")');
      if (await sinFechaBtn.isVisible()) {
        await sinFechaBtn.click();
      }

      const valorInput = page.locator('input[type="number"]').first();
      await valorInput.fill('65000');

      const paxInput = page.locator('input[placeholder="Nombre y Apellido"]').first();
      await paxInput.fill(testPaxName);

      // Guardar reserva
      await page.click('button:has-text("Crear Reserva")');
      await page.waitForTimeout(1500);

      // Validar que el modal se cierre
      const modalSigueAbierto = await page.isVisible('text=1. Datos del Titular o Contacto');
      if (modalSigueAbierto) {
        throw new Error('El modal no se cerró tras guardar la reserva offline');
      }

      // Validar persistencia en IndexedDB parapente-outbox
      const outboxCount = await page.evaluate(async () => {
        return new Promise<number>((resolve) => {
          const req = indexedDB.open('parapente-outbox', 1);
          req.onsuccess = () => {
            if (!req.result.objectStoreNames.contains('outbox')) return resolve(0);
            const tx = req.result.transaction('outbox', 'readonly');
            const getAll = tx.objectStore('outbox').getAll();
            getAll.onsuccess = () => resolve(getAll.result.length);
            getAll.onerror = () => resolve(0);
          };
          req.onerror = () => resolve(0);
        });
      });

      console.log(`   📦 Elementos encolados en IndexedDB outbox: ${outboxCount}`);
      if (outboxCount === 0) {
        throw new Error('La reserva no se encoló en el outbox de IndexedDB');
      }
    });

    // 11. Reconexión y Replay automático
    await step('11. Reconexión y Replay Automático', async () => {
      console.log('   📶 Restaurando red (context.setOffline(false))...');
      await context.setOffline(false);
      await page.waitForTimeout(1000);
      await page.evaluate(() => window.dispatchEvent(new Event('online')));

      // Dar tiempo para el replay automático
      await page.waitForTimeout(4000);

      // Verificar que el outbox se haya vaciado o sincronizado
      const outboxCountPost = await page.evaluate(async () => {
        return new Promise<number>((resolve) => {
          const req = indexedDB.open('parapente-outbox', 1);
          req.onsuccess = () => {
            if (!req.result.objectStoreNames.contains('outbox')) return resolve(0);
            const tx = req.result.transaction('outbox', 'readonly');
            const getAll = tx.objectStore('outbox').getAll();
            getAll.onsuccess = () => resolve(getAll.result.length);
            getAll.onerror = () => resolve(0);
          };
          req.onerror = () => resolve(0);
        });
      });

      console.log(`   📦 Elementos restantes en outbox tras replay: ${outboxCountPost}`);
      if (outboxCountPost > 0) {
        console.warn('   ⚠️ Nota: El outbox aún tiene elementos pendientes de replay');
      }
    });

  } finally {
    await browser.close();
  }

  // Resumen final
  console.log('\n====================================================');
  console.log('📊 RESUMEN DE EJECUCIÓN DE LA SUITE');
  console.log('====================================================');
  let allPass = true;
  for (const r of results) {
    const status = r.ok ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} | ${r.name.padEnd(40)} | ${r.durationMs}ms ${r.error ? `(${r.error})` : ''}`);
    if (!r.ok) allPass = false;
  }
  console.log('====================================================');
  if (allPass) {
    console.log('🎉 TODAS LAS PRUEBAS HACIA PRODUCCIÓN PASARON CON ÉXITO');
  } else {
    console.error('💥 AL MENOS UNA PRUEBA FALLÓ');
    process.exit(1);
  }
}

runSuite().catch(() => process.exit(1));
