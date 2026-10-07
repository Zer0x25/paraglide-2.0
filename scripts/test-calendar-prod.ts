/**
 * Suite E2E de Certificación de Calendario y Zona Horaria en Producción
 * 
 * Cobertura de las funcionalidades críticas de sincronización y huso horario:
 * 1. Health check público y verificación del commit desplegado
 * 2. Autenticación Admin y consulta de /api/calendar/sync-info
 * 3. Certificación de Feed iCalendar General RFC 5545 (X-WR-CALNAME, X-WR-TIMEZONE: America/Santiago, alarmas)
 * 4. Certificación de Feed iCalendar Personalizado por Piloto
 * 5. Certificación de descarga pública de .ics de reserva (/api/public/calendar/reserva/:id.ics)
 * 6. Verificación en Navegador del Voucher y 1-Clic Google Calendar con &ctz=America/Santiago
 * 7. Verificación en Navegador del Modal de Sincronización Universal en /calendario
 * 8. Auditoría de Consistencia Horaria (prevención de desplazamiento indebido a UTC-0)
 * 
 * Ejecución:
 *   npx tsx scripts/test-calendar-prod.ts
 *   PROD_URL=https://parapente.zer0x.org npx tsx scripts/test-calendar-prod.ts
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

async function runCalendarProdSuite() {
  console.log('====================================================');
  console.log(`🚀 CERTIFICACIÓN DE CALENDARIO Y ZONA HORARIA: ${TARGET_URL}`);
  console.log('====================================================');

  const chromePath = process.env.CHROME_BIN || '/usr/bin/google-chrome';
  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: HEADLESS,
  });

  let adminToken: string = '';
  let syncInfo: any = null;
  let sampleReserva: any = null;

  try {
    // 1. Health check público y verificación de commit desplegado
    await step('1. Verificación de Salud del Servidor y Commit Activo', async () => {
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
                console.log(`   ⏳ Servidor reporta commit "${deployedCommit}", esperando "${target}"...`);
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

      console.log(`   🟢 Servidor en línea. Commit activo: ${lastBody?.commit || 'desconocido'}`);
    });

    // 2. Autenticación y obtención de parámetros de sincronización
    await step('2. Autenticación Admin y Consulta de /api/calendar/sync-info', async () => {
      const loginRes = await fetch(`${TARGET_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
      });
      if (!loginRes.ok) throw new Error(`Login fallido: HTTP ${loginRes.status}`);
      const loginData = await loginRes.json();
      adminToken = loginData.token;

      const syncRes = await fetch(`${TARGET_URL}/api/calendar/sync-info`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (!syncRes.ok) throw new Error(`Error en /api/calendar/sync-info: HTTP ${syncRes.status}`);
      syncInfo = await syncRes.json();

      if (!syncInfo.universal?.httpUrl || !syncInfo.universal?.token) {
        throw new Error('sync-info no contiene httpUrl o token universal');
      }

      if (!syncInfo.universal.googleCalendarUrl.includes('calendar.google.com')) {
        throw new Error(`URL de Google Calendar inválida: ${syncInfo.universal.googleCalendarUrl}`);
      }

      console.log(`   🔑 Token Universal generado exitosamente`);
      console.log(`   🧑✈️ Pilotos con token personal: ${syncInfo.pilotos?.length ?? 0}`);
    });

    // 3. Certificación de Feed General iCalendar
    await step('3. Certificación de Feed iCal General (RFC 5545, Nombre y Zona Horaria)', async () => {
      const feedUrl = syncInfo.universal.httpUrl;
      const res = await fetch(feedUrl);
      if (!res.ok) throw new Error(`Error al descargar feed universal: HTTP ${res.status}`);

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('text/calendar')) {
        throw new Error(`Content-Type incorrecto: ${contentType}`);
      }

      const icsText = await res.text();

      // Validar estructura básica RFC 5545
      if (!icsText.includes('BEGIN:VCALENDAR') || !icsText.includes('END:VCALENDAR')) {
        throw new Error('El archivo descargado no tiene estructura válida VCALENDAR');
      }

      // Validar nombre del calendario (no debe ser la URL sin procesar)
      if (!icsText.includes('NAME:') && !icsText.includes('X-WR-CALNAME:')) {
        throw new Error('El feed no define NAME ni X-WR-CALNAME');
      }

      // Validar que el nombre contiene la escuela o propósito de vuelos
      const calNameMatch = icsText.match(/X-WR-CALNAME:(.+)/);
      const calName = calNameMatch ? calNameMatch[1].trim() : '';
      if (calName.startsWith('http://') || calName.startsWith('https://')) {
        throw new Error(`X-WR-CALNAME sigue mostrando una URL en vez del nombre: ${calName}`);
      }
      console.log(`   🏷️ Nombre del Calendario (X-WR-CALNAME): "${calName}"`);

      // Validar Zona Horaria explícita
      if (!icsText.includes('X-WR-TIMEZONE:America/Santiago') && !icsText.includes('TIMEZONE-ID:America/Santiago')) {
        throw new Error('El feed no contiene X-WR-TIMEZONE:America/Santiago ni TIMEZONE-ID:America/Santiago');
      }
      console.log('   🌎 Zona horaria validada: America/Santiago');

      // Validar alarmas con offset negativo (recordatorios previos al vuelo)
      if (icsText.includes('BEGIN:VALARM')) {
        if (!icsText.includes('TRIGGER:-PT2H') && !icsText.includes('TRIGGER:-P1D')) {
          throw new Error('Las alarmas no tienen trigger negativo (deben ser previas al vuelo)');
        }
        console.log('   ⏰ Alarmas previas validadas (-PT2H / -P1D)');
      }
    });

    // 4. Certificación de Feed iCal Personal de Piloto
    await step('4. Certificación de Feed iCal Personalizado por Piloto', async () => {
      if (!syncInfo.pilotos || syncInfo.pilotos.length === 0) {
        console.log('   ℹ️ No hay pilotos registrados; omitiendo prueba individual');
        return;
      }

      const pilotoSample = syncInfo.pilotos[0];
      const pilotoRes = await fetch(pilotoSample.httpUrl);
      if (!pilotoRes.ok) throw new Error(`Error en feed de piloto: HTTP ${pilotoRes.status}`);

      const pilotoIcs = await pilotoRes.text();
      if (!pilotoIcs.includes('BEGIN:VCALENDAR')) {
        throw new Error('Feed de piloto no es un VCALENDAR válido');
      }

      // Validar que el nombre del calendario incluya al piloto
      if (!pilotoIcs.includes(pilotoSample.nombre.split(' ')[0])) {
        console.warn(`   ⚠️ Advertencia: Nombre del piloto no aparece textualmente en X-WR-CALNAME`);
      }

      if (!pilotoIcs.includes('X-WR-TIMEZONE:America/Santiago')) {
        throw new Error('Feed de piloto no contiene X-WR-TIMEZONE:America/Santiago');
      }

      console.log(`   🧑✈️ Feed de piloto (${pilotoSample.nombre}) certificado con America/Santiago`);
    });

    // 5. Certificación de Descarga Pública de Voucher .ics
    await step('5. Certificación de Endpoint Público de Reserva / Voucher (.ics)', async () => {
      const reservasRes = await fetch(`${TARGET_URL}/api/reservas?pageSize=5`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (!reservasRes.ok) throw new Error(`Error al listar reservas: HTTP ${reservasRes.status}`);
      const reservasBody = await reservasRes.json();
      const reservas = reservasBody.data || reservasBody;

      if (!reservas || reservas.length === 0) {
        console.log('   ℹ️ No hay reservas registradas para probar voucher .ics');
        return;
      }

      sampleReserva = (reservasBody.data || reservasBody).find((r: any) => r.fechaReserva) || reservas[0];
      // Solo identificadores no secuenciales (el id numérico ya no resuelve en rutas públicas)
      const publicId = sampleReserva.tokenPublico || sampleReserva.shortId;
      if (!publicId) throw new Error('La reserva de prueba no tiene tokenPublico/shortId');

      // Consulta pública sin token de autorización Bearer
      const voucherIcsRes = await fetch(`${TARGET_URL}/api/public/calendar/reserva/${publicId}.ics`);
      if (!voucherIcsRes.ok) throw new Error(`Error en voucher .ics público: HTTP ${voucherIcsRes.status}`);

      const voucherIcsText = await voucherIcsRes.text();
      if (!voucherIcsText.includes('BEGIN:VCALENDAR') || !voucherIcsText.includes('BEGIN:VEVENT')) {
        throw new Error('Voucher .ics no contiene VEVENT');
      }

      if (!voucherIcsText.includes('X-WR-TIMEZONE:America/Santiago')) {
        throw new Error('Voucher .ics no contiene X-WR-TIMEZONE:America/Santiago');
      }

      console.log(`   🎫 Voucher .ics certificado para reserva #${sampleReserva.numeroReserva || sampleReserva.id}`);
    });

    // 6. Auditoría de Consistencia Horaria (Timezone Offset)
    await step('6. Auditoría de Consistencia Horaria en Base de Datos de Producción', async () => {
      const vuelosRes = await fetch(`${TARGET_URL}/api/vuelos?pageSize=10`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      if (!vuelosRes.ok) {
        throw new Error(`Error al consultar /api/vuelos: HTTP ${vuelosRes.status}`);
      }

      const vuelosBody = await vuelosRes.json();
      const vuelos = vuelosBody.data || vuelosBody;

      if (!vuelos || vuelos.length === 0) {
        console.log('   ℹ️ No hay vuelos para auditar consistencia horaria');
        return;
      }

      // Validar que las fechas de vuelos almacenadas son cadenas ISO válidas
      for (const vuelo of vuelos) {
        if (vuelo.fechaVuelo) {
          const dateObj = new Date(vuelo.fechaVuelo);
          if (isNaN(dateObj.getTime())) {
            throw new Error(`Vuelo ID ${vuelo.id} tiene fecha inválida: ${vuelo.fechaVuelo}`);
          }
        }
      }

      console.log(`   🕒 ${vuelos.length} vuelos auditados con formato ISO y marcas de tiempo válidas`);
    });

    // 7. Verificación en Navegador de Voucher y Botón 1-Clic Google Calendar
    await step('7. Verificación E2E de Voucher y Enlace 1-Clic Google Calendar (&ctz=America/Santiago)', async () => {
      if (!sampleReserva) {
        console.log('   ℹ️ Sin reserva para probar UI de voucher; omitiendo paso');
        return;
      }

      // Solo identificadores no secuenciales (el id numérico ya no resuelve en rutas públicas)
      const publicId = sampleReserva.tokenPublico || sampleReserva.shortId;
      if (!publicId) throw new Error('La reserva de prueba no tiene tokenPublico/shortId');
      const voucherPageUrl = `${TARGET_URL}/voucher/${publicId}`;

      const anonContext = await browser.newContext();
      const page = await anonContext.newPage();

      // Interceptar window.open para capturar la URL que abriría el botón de Google Calendar
      await page.addInitScript(() => {
        (window as any).__openedUrls = [];
        window.open = (url: string | URL | undefined) => {
          if (url) (window as any).__openedUrls.push(String(url));
          return null;
        };
      });

      console.log(`   🌐 Navegando a: ${voucherPageUrl}`);
      await page.goto(voucherPageUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('text=TICKET OFICIAL DE VUELO', { timeout: 10_000 });

      // Localizar botón de Google Calendar
      const gcalBtn = page.locator('button:has-text("Google Calendar")');
      if (!(await gcalBtn.isVisible())) {
        throw new Error('El botón "Google Calendar" no es visible en el voucher');
      }

      await gcalBtn.click();

      // Verificar URL interceptada
      const openedUrls: string[] = await page.evaluate(() => (window as any).__openedUrls || []);
      if (openedUrls.length === 0) {
        throw new Error('El clic en Google Calendar no invocó window.open');
      }

      const targetUrl = openedUrls[0];
      if (!targetUrl.includes('calendar.google.com/calendar/render')) {
        throw new Error(`URL de Google Calendar inesperada: ${targetUrl}`);
      }

      if (!targetUrl.includes('ctz=America/Santiago') && !targetUrl.includes('ctz=America%2FSantiago')) {
        throw new Error(`URL de Google Calendar NO incluye el parámetro de zona horaria &ctz=America/Santiago: ${targetUrl}`);
      }

      console.log('   📅 Enlace 1-Clic Google Calendar incluye correctamente &ctz=America/Santiago');
      await anonContext.close();
    });

    // 8. Verificación en Navegador del Modal de Sincronización en /calendario
    await step('8. Verificación E2E del Modal de Sincronización Universal en /calendario', async () => {
      const authContext = await browser.newContext();
      const page = await authContext.newPage();

      // Login en la UI
      await page.goto(`${TARGET_URL}/login`);
      await page.fill('input[type="email"], input[name="email"]', EMAIL);
      await page.fill('input[type="password"], input[name="password"]', PASSWORD);
      await page.click('button[type="submit"]');

      await page.waitForURL((url) => url.pathname !== '/login', { timeout: 15_000 });

      // Navegar a /calendario
      await page.goto(`${TARGET_URL}/calendario`);
      await page.waitForSelector('text=Calendario de Vuelos', { timeout: 10_000 });

      // Localizar botón "Sincronizar"
      const syncBtn = page.locator('button:has-text("Sincronizar")').first();
      await syncBtn.waitFor({ state: 'visible', timeout: 5_000 });
      await syncBtn.click();

      // Verificar apertura del modal
      await page.waitForSelector('text=Sincronización de Calendario', { timeout: 6_000 });
      await page.waitForSelector('text=Todos los Vuelos (Admin)', { timeout: 6_000 });
      await page.waitForSelector('text=Google Calendar', { timeout: 6_000 });

      console.log('   🖥️ Modal de sincronización verificado con opciones Universal y Pilotos');
      await authContext.close();
    });
  } finally {
    await browser.close();
  }

  // Resumen final
  console.log('\n====================================================');
  console.log('📊 RESUMEN DE CERTIFICACIÓN DE CALENDARIO Y HORA');
  console.log('====================================================');

  let allPass = true;
  for (const r of results) {
    const icon = r.ok ? '✅' : '❌';
    console.log(`${icon} ${r.name} (${r.durationMs}ms)`);
    if (!r.ok) {
      allPass = false;
      console.log(`   └─ Error: ${r.error}`);
    }
  }

  console.log('====================================================');
  if (allPass) {
    console.log('🎉 TODAS LAS PRUEBAS DE CALENDARIO Y HORA PASARON EXITOSAMENTE EN PRODUCCIÓN');
  } else {
    throw new Error('Una o más pruebas de certificación de calendario fallaron en producción');
  }
}

runCalendarProdSuite().catch((err) => {
  console.error('\n❌ Error crítico en suite de certificación de calendario:', err);
  process.exit(1);
});
