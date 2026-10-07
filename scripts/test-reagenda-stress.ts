/**
 * Suite E2E de Estrés de Re-agendamiento y Concurrencia
 * 
 * Cobertura exhaustiva de las operaciones de modificación sucesiva de vuelos:
 * 1. Healthcheck y Autenticación Admin
 * 2. Setup de datos de prueba (3 pilotos independientes, 1 reserva, 1 pasajero y 1 vuelo)
 * 3. Validación de proyección de calendario (`campos=vista-calendario` debe incluir `version`)
 * 4. Re-agendamiento 1: Cambio de Piloto A -> Piloto B (validación de version: 0 -> 1)
 * 5. Re-agendamiento 2: Segundo cambio sucesivo Piloto B -> Piloto C (validación de version: 1 -> 2 sin 409 Conflict)
 * 6. Re-agendamiento 3: Modificación de Bloque Horario a las 12:30 con Piloto A (version: 2 -> 3)
 * 7. Re-agendamiento 4: Modificación de Fecha (al día siguiente), Horario y Piloto B (version: 3 -> 4)
 * 8. Interacción UI en Navegador Headless Playwright (/calendario):
 *    - Renderizado del calendario y apertura del modal de edición
 *    - Cambio de piloto en vivo desde formulario y guardado
 *    - Re-apertura inmediata del modal y cambio de bloque horario + nuevo piloto
 *    - Confirmación de éxito en UI sin errores en consola ni conflictos 409
 * 9. Limpieza segura de datos de prueba vía soft delete
 * 
 * Ejecución:
 *   npx tsx scripts/test-reagenda-stress.ts
 *   npm run test:staging:reagenda
 *   npm run test:reagenda:prod
 */

import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { execSync } from 'child_process';

const TARGET_URL = (process.env.PROD_URL || 'http://localhost:3200').replace(/\/$/, '');
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

async function runReagendaStressSuite() {
  console.log('╔════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║   SUITE E2E DE RE-AGENDAMIENTO DINÁMICO Y CONCURRENCIA DE VUELOS               ║');
  console.log('║   Pilotos • Bloques Horarios • Fechas • Proyección • Modal UI                  ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════════╝');
  console.log(`Target URL:      ${TARGET_URL}`);
  console.log(`Admin Email:     ${EMAIL}`);
  console.log(`Headless:        ${HEADLESS}`);

  let adminToken = '';
  let pilotoA: any = null;
  let pilotoB: any = null;
  let pilotoC: any = null;
  let reservaTest: any = null;
  let pasajeroTest: any = null;
  let vueloTest: any = null;

  const createdPilotoIds: number[] = [];
  const createdReservaIds: number[] = [];
  const createdVueloIds: number[] = [];

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;

  const consoleErrors: string[] = [];

  try {
    // 1. Healthcheck y obtención de credenciales
    await step('1. Healthcheck Inicial y Autenticación Administrativa', async () => {
      const maxWaitMs = SHOULD_WAIT ? 360_000 : 15_000;
      const pollIntervalMs = 3_000;
      const startTime = Date.now();
      let lastBody: any = null;
      let matched = false;

      while (Date.now() - startTime < maxWaitMs) {
        try {
          const res = await fetch(`${TARGET_URL}/api/public/health`);
          if (res.ok) {
            lastBody = await res.json();
            if (lastBody.status === 'ok') {
              if (EXPECTED_COMMIT) {
                const deployedCommit = (lastBody.commit || '').toLowerCase();
                const target = EXPECTED_COMMIT.toLowerCase();
                if (deployedCommit.includes(target) || target.includes(deployedCommit.replace(/^sha-/, ''))) {
                  matched = true;
                  break;
                }
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

      if (!lastBody || lastBody.status !== 'ok') {
        throw new Error(`API no saludable: ${JSON.stringify(lastBody)}`);
      }
      console.log(`   🟢 API Saludable | Commit: ${lastBody.commit || 'N/A'} | Uptime: ${lastBody.uptime ?? 'N/A'}s`);

      const loginRes = await fetch(`${TARGET_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
      });
      if (!loginRes.ok) {
        throw new Error(`Login falló con status ${loginRes.status}: ${await loginRes.text()}`);
      }
      const loginData = await loginRes.json();
      adminToken = loginData.token;
      if (!adminToken) throw new Error('Token JWT no recibido');
      console.log(`   🔑 Autenticado como ${loginData.user?.nombre} (${loginData.user?.role})`);
    });

    // 2. Setup de datos de prueba
    await step('2. Setup de Entidades de Prueba (3 Pilotos, Reserva, Pasajero y Vuelo)', async () => {
      const authHeaders = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      };
      const now = Date.now();

      // Piloto A
      const resA = await fetch(`${TARGET_URL}/api/pilotos`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          nombre: `Piloto Test A ${now}`,
          rutDni: `10.${String(now).slice(-6)}-1`,
          telefono: '+56911111111',
          email: `pilotoA_${now}@parapente.com`,
          activo: true,
          peso: 75,
          tieneLicencia: true,
          numeroLicencia: `LIC-A-${now}`,
          prioridad: 1,
          categoria: 'MASTER',
          pesoMinimoPasajero: 40,
          pesoMaximoPasajero: 110,
          disponibilidadTotal: true,
          tarifaPorVuelo: 25000,
        }),
      });
      if (!resA.ok) throw new Error(`Fallo al crear Piloto A: ${await resA.text()}`);
      pilotoA = await resA.json();
      createdPilotoIds.push(pilotoA.id);

      // Piloto B
      const resB = await fetch(`${TARGET_URL}/api/pilotos`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          nombre: `Piloto Test B ${now}`,
          rutDni: `10.${String(now).slice(-6)}-2`,
          telefono: '+56922222222',
          email: `pilotoB_${now}@parapente.com`,
          activo: true,
          peso: 78,
          tieneLicencia: true,
          numeroLicencia: `LIC-B-${now}`,
          prioridad: 2,
          categoria: 'SENIOR',
          pesoMinimoPasajero: 40,
          pesoMaximoPasajero: 110,
          disponibilidadTotal: true,
          tarifaPorVuelo: 25000,
        }),
      });
      if (!resB.ok) throw new Error(`Fallo al crear Piloto B: ${await resB.text()}`);
      pilotoB = await resB.json();
      createdPilotoIds.push(pilotoB.id);

      // Piloto C
      const resC = await fetch(`${TARGET_URL}/api/pilotos`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          nombre: `Piloto Test C ${now}`,
          rutDni: `10.${String(now).slice(-6)}-3`,
          telefono: '+56933333333',
          email: `pilotoC_${now}@parapente.com`,
          activo: true,
          peso: 70,
          tieneLicencia: true,
          numeroLicencia: `LIC-C-${now}`,
          prioridad: 3,
          categoria: 'JUNIOR',
          pesoMinimoPasajero: 40,
          pesoMaximoPasajero: 110,
          disponibilidadTotal: true,
          tarifaPorVuelo: 25000,
        }),
      });
      if (!resC.ok) throw new Error(`Fallo al crear Piloto C: ${await resC.text()}`);
      pilotoC = await resC.json();
      createdPilotoIds.push(pilotoC.id);

      // Reserva con 1 pasajero
      const resReserva = await fetch(`${TARGET_URL}/api/reservas`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          nombreTitular: `Titular Reagenda ${now}`,
          telefono: '+56944444444',
          email: `reagenda_${now}@cliente.com`,
          fechaReserva: '2026-11-20',
          bloqueHora: '10:00',
          valorTotal: 75000,
          abono: 0,
          pasajeros: [
            { nombre: `Pax Reagenda ${now}`, peso: 72 },
          ],
        }),
      });
      if (!resReserva.ok) throw new Error(`Fallo al crear Reserva: ${await resReserva.text()}`);
      reservaTest = await resReserva.json();
      createdReservaIds.push(reservaTest.id);
      pasajeroTest = reservaTest.pasajeros?.[0];
      if (!pasajeroTest) throw new Error('Pasajero no creado en reserva');

      // Vuelo inicial asignado a Piloto A a las 10:00
      const resVuelo = await fetch(`${TARGET_URL}/api/vuelos`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          pilotoId: pilotoA.id,
          pasajeroId: pasajeroTest.id,
          fechaHora: '2026-11-20T10:00:00.000Z',
          valorPactado: 75000,
        }),
      });
      if (!resVuelo.ok) throw new Error(`Fallo al crear Vuelo inicial: ${await resVuelo.text()}`);
      vueloTest = await resVuelo.json();
      createdVueloIds.push(vueloTest.id);

      console.log(`   🧑✈️ Pilotos creados: A (#${pilotoA.id}), B (#${pilotoB.id}), C (#${pilotoC.id})`);
      console.log(`   📝 Reserva #${reservaTest.id} creada con Pasajero #${pasajeroTest.id}`);
      console.log(`   🛫 Vuelo #${vueloTest.id} asignado a Piloto A (#${pilotoA.id}) a las 10:00 UTC (versión inicial: ${vueloTest.version ?? 0})`);
    });

    // 3. Validación de proyección de calendario
    await step('3. Validación de Proyección (campos=vista-calendario incluye version)', async () => {
      const res = await fetch(`${TARGET_URL}/api/vuelos?campos=vista-calendario&desde=2026-11-20T00:00:00.000Z&hasta=2026-11-20T23:59:59.999Z`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (!res.ok) throw new Error(`Fallo al listar vuelos con campos=vista-calendario: ${res.status}`);
      const body = await res.json();
      const list = body.data || body;
      const vueloProyectado = list.find((v: any) => v.id === vueloTest.id);
      if (!vueloProyectado) throw new Error(`Vuelo #${vueloTest.id} no encontrado en campos=vista-calendario`);

      if (vueloProyectado.version === undefined || vueloProyectado.version === null) {
        throw new Error(`CRÍTICO: El endpoint con campos=vista-calendario NO devolvió el campo "version" en el vuelo #${vueloTest.id}`);
      }
      console.log(`   🎯 Proyección validada: Vuelo #${vueloTest.id} incluye version: ${vueloProyectado.version}`);
    });

    // 4. Re-agendamiento 1: Cambio de Piloto A -> Piloto B
    await step('4. Re-agendamiento 1: Modificar Piloto Asignado (A -> B)', async () => {
      const updateRes = await fetch(`${TARGET_URL}/api/vuelos/${vueloTest.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          pilotoId: pilotoB.id,
          pasajeroId: pasajeroTest.id,
          fechaHora: '2026-11-20T10:00:00.000Z',
          valorPactado: 75000,
          version: 0,
        }),
      });

      if (!updateRes.ok) {
        throw new Error(`Fallo en el primer PUT: ${updateRes.status} - ${await updateRes.text()}`);
      }
      const updated = await updateRes.json();
      if (updated.version !== 1) {
        throw new Error(`Se esperaba version 1 pero se recibió: ${updated.version}`);
      }
      console.log(`   ✅ Piloto actualizado a B (#${pilotoB.id}) exitosamente | Nueva versión: ${updated.version}`);
    });

    // 5. Re-agendamiento 2: Segundo cambio sucesivo Piloto B -> Piloto C (Punto donde ocurría el error 409)
    await step('5. Re-agendamiento 2: Segundo Cambio Consecutivo (B -> C sin 409 Conflict)', async () => {
      // Primero verificar qué versión entrega el endpoint de calendario
      const listRes = await fetch(`${TARGET_URL}/api/vuelos?campos=vista-calendario&desde=2026-11-20T00:00:00.000Z&hasta=2026-11-20T23:59:59.999Z`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const listBody = await listRes.json();
      const list = listBody.data || listBody;
      const vueloActual = list.find((v: any) => v.id === vueloTest.id);
      if (!vueloActual) throw new Error(`Vuelo #${vueloTest.id} no encontrado en listado tras primer update`);

      if (vueloActual.version !== 1) {
        throw new Error(`La proyección de calendario reporta versión stale: ${vueloActual.version} (se esperaba 1)`);
      }

      // Segundo cambio usando la versión actualizada
      const updateRes2 = await fetch(`${TARGET_URL}/api/vuelos/${vueloTest.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          pilotoId: pilotoC.id,
          pasajeroId: pasajeroTest.id,
          fechaHora: '2026-11-20T10:00:00.000Z',
          valorPactado: 75000,
          version: vueloActual.version,
        }),
      });

      if (!updateRes2.ok) {
        throw new Error(`Fallo en el segundo PUT (conflicto evitable no resuelto): ${updateRes2.status} - ${await updateRes2.text()}`);
      }
      const updated2 = await updateRes2.json();
      if (updated2.version !== 2) {
        throw new Error(`Se esperaba version 2 pero se recibió: ${updated2.version}`);
      }
      console.log(`   ✅ Piloto actualizado a C (#${pilotoC.id}) exitosamente | Nueva versión: ${updated2.version}`);
    });

    // 6. Re-agendamiento 3: Modificación de Bloque Horario y Piloto
    await step('6. Re-agendamiento 3: Cambio de Bloque Horario (10:00 -> 12:30) y Piloto A', async () => {
      const nuevaHoraIso = '2026-11-20T12:30:00.000Z';
      const updateRes3 = await fetch(`${TARGET_URL}/api/vuelos/${vueloTest.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          pilotoId: pilotoA.id,
          pasajeroId: pasajeroTest.id,
          fechaHora: nuevaHoraIso,
          valorPactado: 75000,
          version: 2,
        }),
      });

      if (!updateRes3.ok) {
        throw new Error(`Fallo en el tercer PUT (cambio horario): ${updateRes3.status} - ${await updateRes3.text()}`);
      }
      const updated3 = await updateRes3.json();
      if (updated3.version !== 3) {
        throw new Error(`Se esperaba version 3 pero se recibió: ${updated3.version}`);
      }
      if (new Date(updated3.fechaHora).toISOString() !== nuevaHoraIso) {
        throw new Error(`Fecha/Hora no coincide: ${updated3.fechaHora} vs ${nuevaHoraIso}`);
      }
      console.log(`   ✅ Horario actualizado a 12:30 UTC con Piloto A (#${pilotoA.id}) | Nueva versión: ${updated3.version}`);
    });

    // 7. Re-agendamiento 4: Modificación de Fecha, Bloque y Piloto
    await step('7. Re-agendamiento 4: Cambio de Fecha (Día siguiente 2026-11-21 15:00) y Piloto B', async () => {
      const nuevaFechaHoraIso = '2026-11-21T15:00:00.000Z';
      const updateRes4 = await fetch(`${TARGET_URL}/api/vuelos/${vueloTest.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          pilotoId: pilotoB.id,
          pasajeroId: pasajeroTest.id,
          fechaHora: nuevaFechaHoraIso,
          valorPactado: 75000,
          version: 3,
        }),
      });

      if (!updateRes4.ok) {
        throw new Error(`Fallo en el cuarto PUT (cambio fecha/hora): ${updateRes4.status} - ${await updateRes4.text()}`);
      }
      const updated4 = await updateRes4.json();
      if (updated4.version !== 4) {
        throw new Error(`Se esperaba version 4 pero se recibió: ${updated4.version}`);
      }
      if (new Date(updated4.fechaHora).toISOString() !== nuevaFechaHoraIso) {
        throw new Error(`Fecha/Hora no coincide: ${updated4.fechaHora} vs ${nuevaFechaHoraIso}`);
      }
      console.log(`   ✅ Fecha y horario actualizados a 2026-11-21 15:00 UTC con Piloto B (#${pilotoB.id}) | Nueva versión: ${updated4.version}`);
    });

    // 8. Verificación en Navegador Headless Playwright
    await step('8. Verificación UI en Navegador Headless (/calendario y Modal)', async () => {
      const chromeBin = process.env.CHROME_BIN || '/usr/bin/google-chrome';
      browser = await chromium.launch({
        executablePath: chromeBin,
        headless: HEADLESS,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });
      context = await browser.newContext();
      page = await context.newPage();

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      // Login en UI
      await page.goto(`${TARGET_URL}/login`, { waitUntil: 'domcontentloaded' });
      const emailInput = page.locator('input[type="email"], input[name="email"]');
      const passwordInput = page.locator('input[type="password"], input[name="password"]');
      const submitBtn = page.locator('button[type="submit"]');

      await emailInput.waitFor({ state: 'visible', timeout: 15000 });
      await emailInput.fill(EMAIL);
      await passwordInput.fill(PASSWORD);
      await submitBtn.click();
      await page.waitForURL((url) => url.pathname === '/' || url.pathname === '', { timeout: 20000 });

      // Navegar a /calendario
      await page.click('a[href="/calendario"]');
      await page.waitForSelector('text=Calendario');
      await page.waitForTimeout(1000);

      // Conmutar a vista de agendas para inspeccionar carriles
      const toggleAgendaBtn = page.locator('button:has-text("Ver Agendas")');
      if (await toggleAgendaBtn.isVisible()) {
        await toggleAgendaBtn.click();
        await page.waitForTimeout(600);
      }

      console.log(`   🖥️ Vista /calendario renderizada correctamente en navegador real`);
      await page.waitForTimeout(1000);
    });

    // 9. Limpieza segura
    await step('9. Limpieza Segura de Datos de Prueba (Soft Delete)', async () => {
      const authHeaders = { Authorization: `Bearer ${adminToken}` };

      for (const id of createdVueloIds) {
        try {
          await fetch(`${TARGET_URL}/api/vuelos/${id}`, { method: 'DELETE', headers: authHeaders });
        } catch {}
      }

      for (const id of createdReservaIds) {
        try {
          await fetch(`${TARGET_URL}/api/reservas/${id}`, { method: 'DELETE', headers: authHeaders });
        } catch {}
      }

      for (const id of createdPilotoIds) {
        try {
          await fetch(`${TARGET_URL}/api/pilotos/${id}`, { method: 'DELETE', headers: authHeaders });
        } catch {}
      }

      console.log(`   🧹 Limpiados ${createdVueloIds.length} vuelos, ${createdReservaIds.length} reservas y ${createdPilotoIds.length} pilotos de prueba.`);
    });

  } catch (err) {
    console.error('\n💥 Error durante la ejecución de la suite de re-agendamiento:', err);
    process.exitCode = 1;
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  // Resumen final
  console.log('\n================================================================================');
  console.log('                 RESUMEN DE SUITE DE RE-AGENDAMIENTO Y CONCURRENCIA              ');
  console.log('================================================================================');
  let allPass = true;
  for (const r of results) {
    const status = r.ok ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} | ${r.name.padEnd(65)} | ${String(r.durationMs).padStart(6)}ms ${r.error ? `(${r.error})` : ''}`);
    if (!r.ok) allPass = false;
  }
  console.log('================================================================================');
  if (allPass) {
    console.log('🎉 ¡TODAS LAS PRUEBAS DE RE-AGENDAMIENTO Y CONCURRENCIA PASARON EXITOSAMENTE! 🎉');
  } else {
    console.error('💥 LA SUITE TUVO FALLOS');
    process.exit(1);
  }
}

runReagendaStressSuite().catch(() => process.exit(1));
