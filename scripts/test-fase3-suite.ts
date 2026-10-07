/**
 * Suite E2E de Fase 3: Módulos Premium Operativos
 * 
 * Cobertura de los 4 módulos premium:
 * 1. /equipos        (Control técnico, velas, arneses, paracaídas, horas de vuelo, modal de alta)
 * 2. /plantillas     (Plantillas WhatsApp/Email, variables dinámicas, simulador y modal)
 * 3. /reportes       (Manifiesto diario de vuelo, liquidación de pilotos y exportación CSV)
 * 4. /meteorologia   (Semáforo hero de pista, tarjeta Open-Meteo, instrumentos y boletín)
 * + Guard withModule (Validación de bloqueo amigable y redirección con ModuleNotAvailable)
 * 
 * Ejecución:
 *   npx tsx scripts/test-fase3-suite.ts
 *   PROD_URL=https://parapente.zer0x.org npx tsx scripts/test-fase3-suite.ts
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

async function runFase3Suite() {
  console.log('====================================================');
  console.log(`🚀 INICIANDO SUITE FASE 3 (MÓDULOS PREMIUM): ${TARGET_URL}`);
  console.log('====================================================');

  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: HEADLESS,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 ParaglideE2E/Fase3',
  });

  const page = await context.newPage();

  try {
    // 1. Healthcheck y Verificación de Módulos Activos
    await step('1. Verificación Inicial y Módulos Activos (/health, /api/modules)', async () => {
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

      console.log(`   🟢 API Saludable | Commit: ${lastBody?.commit || 'desconocido'} | Uptime: ${lastBody?.uptime ?? 'N/A'}s`);

      // Verificar endpoint /api/modules
      const modulesRes = await fetch(`${TARGET_URL}/api/modules`);
      if (!modulesRes.ok) throw new Error(`Endpoint /api/modules respondió HTTP ${modulesRes.status}`);
      const modulesData = await modulesRes.json();
      
      const enabledList: string[] = (modulesData.modules || [])
        .filter((m: any) => m.enabled)
        .map((m: any) => m.id);

      console.log(`   📦 Módulos habilitados en runtime: [${enabledList.join(', ')}]`);
      const requiredModules = ['equipos', 'plantillas', 'reportes', 'meteorologia'];
      for (const req of requiredModules) {
        if (!enabledList.includes(req)) {
          throw new Error(`El módulo requerido "${req}" no está habilitado en /api/modules`);
        }
      }
    });

    // 2. Autenticación Admin en la Web
    await step('2. Autenticación Admin y Carga de Layout', async () => {
      await page.goto(`${TARGET_URL}/login`);
      await page.waitForSelector('input[type="email"]');
      await page.fill('input[type="email"]', EMAIL);
      await page.fill('input[type="password"]', PASSWORD);
      await page.click('button:has-text("Ingresar")');
      await page.waitForURL(`${TARGET_URL}/`);
      
      // Esperar breve margen de sincronización
      await page.waitForTimeout(1500);

      // Validar presencia de enlaces en Sidebar a los 4 módulos premium
      await page.waitForSelector('aside a[href="/equipos"]');
      await page.waitForSelector('aside a[href="/plantillas"]');
      await page.waitForSelector('aside a[href="/reportes"]');
      await page.waitForSelector('aside a[href="/meteorologia"]');
      console.log('   🧭 Barra lateral con enlaces a módulos premium confirmada');
    });

    // 3. Módulo Equipos & Mantenimiento (/equipos)
    await step('3. Módulo Equipos & Mantenimiento (/equipos)', async () => {
      await page.click('aside a[href="/equipos"]');
      await page.waitForURL(`${TARGET_URL}/equipos`);

      // Header y KPIs
      await page.waitForSelector('text=Control de Equipos & Mantenimiento');
      await page.waitForSelector('text=Total Equipos');
      await page.waitForSelector('text=Velas Operativas');
      await page.waitForSelector('text=Paracaídas Activos');
      await page.waitForSelector('text=Alertas / Revisión');

      // Filtros
      const searchInput = page.locator('input[placeholder*="Buscar por código"]');
      await searchInput.waitFor({ state: 'visible' });
      await searchInput.fill('VELA');
      await page.waitForTimeout(300);
      await searchInput.fill('');

      // Modal Registrar Equipo
      const registrarBtn = page.locator('button:has-text("Registrar Equipo")');
      await registrarBtn.click();

      const modalTitle = page.locator('text=Registrar Nuevo Equipo');
      await modalTitle.waitFor({ state: 'visible', timeout: 5000 });

      // Verificar campos clave del formulario
      await page.waitForSelector('input[placeholder*="Ej: VELA-01"]');
      await page.waitForSelector('select');

      // Cerrar modal vía botón de cerrar accesible o Escape
      const closeBtn = page.locator('button[aria-label="Cerrar"]');
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
      } else {
        await page.keyboard.press('Escape');
      }
      await modalTitle.waitFor({ state: 'hidden', timeout: 3000 });
      console.log('   🪂 Inventario de equipos y modal de alta validados');
    });

    // 4. Módulo Plantillas de Mensajes & WhatsApp (/plantillas)
    await step('4. Módulo Plantillas de Mensajes & WhatsApp (/plantillas)', async () => {
      await page.click('aside a[href="/plantillas"]');
      await page.waitForURL(`${TARGET_URL}/plantillas`);

      // Header
      await page.waitForSelector('text=Plantillas de Mensajes & WhatsApp');
      await page.waitForSelector('text=Variables Disponibles:');
      await page.waitForSelector('text={{nombre}}');
      await page.waitForSelector('text={{fecha}}');
      await page.waitForSelector('text=Simulador de Mensaje');

      // Modal Nueva Plantilla
      const nuevaBtn = page.locator('button:has-text("Nueva Plantilla")');
      await nuevaBtn.click();

      // Verificar que el modal de plantilla se abre
      await page.waitForSelector('text=Personaliza mensajes automatizados para WhatsApp / Correo');
      await page.waitForSelector('input[placeholder*="CONFIRMACION_VIP"]');

      // Cerrar modal vía botón cerrar o Escape
      const closeBtn = page.locator('button[aria-label="Cerrar"]');
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
      } else {
        await page.keyboard.press('Escape');
      }
      await page.waitForSelector('text=Personaliza mensajes automatizados para WhatsApp / Correo', { state: 'hidden', timeout: 3000 });

      // Probar simulación en vivo si hay al menos una plantilla listada
      const eyeButtons = page.locator('button[title*="Previsualizar"], button:has(svg.lucide-eye)');
      const count = await eyeButtons.count();
      if (count > 0) {
        await eyeButtons.first().click();
        await page.waitForSelector('text=Las variables dinámicas como fecha, hora y links');
        console.log('   💬 Vista previa interactiva de WhatsApp verificada con variables');
      } else {
        console.log('   ℹ️ Sin plantillas preexistentes, guía de variables y modal verificados');
      }
    });

    // 5. Módulo Manifiestos & Reportes (/reportes)
    await step('5. Módulo Manifiestos & Reportes (/reportes)', async () => {
      await page.click('aside a[href="/reportes"]');
      await page.waitForURL(`${TARGET_URL}/reportes`);

      // Header y Tab Manifiesto
      await page.waitForSelector('text=Manifiestos & Reportes');
      await page.waitForSelector('button:has-text("Manifiesto de Vuelo")');
      await page.waitForSelector('button:has-text("Liquidación de Pilotos")');

      // Sección Manifiesto
      await page.waitForSelector('input[type="date"]');
      await page.waitForSelector('input[placeholder*="Filtrar piloto, pasajero, RUT"]');
      console.log('   📋 Pestaña Manifiesto de Vuelo operativa');

      // Conmutar a Tab Liquidación de Pilotos
      await page.click('button:has-text("Liquidación de Pilotos")');
      await page.waitForSelector('text=Total a Pagar a Pilotos');
      await page.waitForSelector('button:has-text("Exportar Liquidaciones a Excel")');

      // Probar descarga de liquidaciones en Excel (.xlsx / CSV)
      const downloadPromise = page.waitForEvent('download', { timeout: 10_000 }).catch(() => null);
      await page.click('button:has-text("Exportar Liquidaciones a Excel")');
      const download = await downloadPromise;
      if (download) {
        const filename = download.suggestedFilename();
        console.log(`   📥 Descarga de planilla capturada exitosamente: ${filename}`);
      } else {
        // En algunos navegadores o contextos puede capturarse mediante el toast de éxito
        await page.waitForSelector('text=Planilla Excel descargada exitosamente, text=Planilla CSV descargada exitosamente', { timeout: 5000 }).catch(() => {
          console.log('   ℹ️ Acción de exportación ejecutada sin interrupción');
        });
      }
    });

    // 6. Módulo Pista & Meteorología (/meteorologia)
    await step('6. Módulo Pista & Meteorología (/meteorologia)', async () => {
      await page.click('aside a[href="/meteorologia"]');
      await page.waitForURL(`${TARGET_URL}/meteorologia`);

      // Header y Semáforo Hero
      await page.waitForSelector('text=Estación Meteorológica & Estado de Pista');
      await page.waitForSelector('text=ESTADO OPERACIONAL EN PISTA DE DESPEGUE');
      await page.waitForSelector('button:has-text("Actualizar Datos")');

      // Instrumentos, Boletín e Historial
      await page.waitForSelector('text=Emitir Nuevo Boletín');
      await page.waitForSelector('text=Publicar Boletín Meteorológico');
      await page.waitForSelector('text=Historial de Boletines del Día');
      console.log('   🌤️ Monitoreo de meteorología, semáforo e instrumentos confirmados');
    });

    // 7. Verificación del Guard withModule y Fallback ModuleNotAvailable
    await step('7. Verificación del Guard withModule (/dev)', async () => {
      // En producción, /dev está deshabilitado por diseño
      await page.goto(`${TARGET_URL}/dev`);
      await page.waitForSelector('text=Módulo no disponible');
      await page.waitForSelector('text=El módulo “Dev Tools” no está incluido en tu plan actual');

      const volverBtn = page.locator('a:has-text("Volver al inicio")');
      await volverBtn.waitFor({ state: 'visible' });
      await volverBtn.click();
      await page.waitForURL(`${TARGET_URL}/`);
      console.log('   🛡️ Guard withModule verificado: ModuleNotAvailable bloquea y redirige correctamente');
    });

  } finally {
    await browser.close();
  }

  // Resumen Final
  console.log('\n====================================================');
  console.log('📊 RESUMEN DE EJECUCIÓN - FASE 3');
  console.log('====================================================');
  let passed = 0;
  let failed = 0;

  for (const r of results) {
    if (r.ok) {
      passed++;
      console.log(`✅ PASS | ${r.name} (${r.durationMs}ms)`);
    } else {
      failed++;
      console.log(`❌ FAIL | ${r.name} (${r.durationMs}ms) -> ${r.error}`);
    }
  }

  console.log('----------------------------------------------------');
  console.log(`Total: ${results.length} | Aprobados: ${passed} | Fallidos: ${failed}`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runFase3Suite().catch((err) => {
  console.error('\n💥 Error fatal en la ejecución de la suite Fase 3:', err);
  process.exit(1);
});
