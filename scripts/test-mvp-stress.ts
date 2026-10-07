/**
 * Suite E2E de Estrés y Casos Borde del MVP
 * 
 * Cobertura combinada y agresiva de los 4 módulos esenciales para el lanzamiento:
 * 1. Healthcheck y Autenticación Administrativa (Headless + API, compatible con ADR 013)
 * 2. 🧑✈️ Pilotos:
 *    - Validación estricta de esquemas (rechazo de email inválido HTTP 400)
 *    - Creación de piloto con parámetros completos y rangos de peso
 *    - Disponibilidad y franjas horarias
 *    - ⚡ COMBINACIÓN: Rechazo de pasajero que excede el límite de peso de seguridad (120kg > 115kg)
 *    - Desactivación con vuelos asignados y auditoría de renderizado en UI sin crashes
 * 3. 📝 Reservas:
 *    - Creación de reserva multi-pasajero
 *    - Prevención de abono mayor al total o monto negativo (regla financiera inmutable ADR 008)
 *    - Idempotencia en pagos concurrentes (replay de outbox con X-Client-Id UUID v4)
 *    - ⚡ COMBINACIÓN: Ciclo de vida completo de vuelos (AGENDADO → COMPLETADO) con transición
 *      automática de la reserva a COMPLETADA al finalizar todos sus pasajeros
 *    - ⚡ COMBINACIÓN: Bloqueo de transición ilegal desde estado terminal (COMPLETADO → AGENDADO)
 *    - Concurrencia optimista en cancelación (rechazo de versión stale HTTP 409 Conflict)
 *    - Ciclo de cancelación formal con motivo y devoluciones controladas
 *    - Resiliencia offline PWA en navegador headless
 * 4. 📅 Calendario:
 *    - ⚡ COMBINACIÓN: Carrera crítica (Race Condition) por la misma franja de piloto en paralelo
 *      (Promise.all atómico: 1 aprobada y 1 rechazada con conflicto)
 *    - ⚡ COMBINACIÓN: Agendamiento en grupo con asignación automática de pilotos por pool y peso
 *    - Bloqueos operativos de franjas horarias y resolver de disponibilidad
 * 5. ⚙️ Configuración, Seguridad RBAC y Vistas Públicas:
 *    - Consulta y mutación de tarifas con control decimal
 *    - Promociones: validación de reglas borde (descuento > 100%, fechas invertidas)
 *    - Barrera RBAC: rol RECEPCION bloqueado en API (HTTP 403) y UI (/configuracion)
 *    - ⚡ COMBINACIÓN: Voucher público y firma de deslinde digital en cliente no autenticado
 * 6. 🖥️ Estrés de Interacción UI en Navegador Headless (vistas de calendario y filtros reactivos)
 * 7. 🛡️ Auditoría Global de Errores de Consola/Hidratación y Limpieza Segura (Soft Delete)
 * 
 * Ejecución:
 *   npx tsx scripts/test-mvp-stress.ts
 *   npm run test:staging:mvp
 *   npm run test:mvp:prod
 */

import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { execSync } from 'child_process';
import crypto from 'crypto';

const TARGET_URL = process.env.PROD_URL || 'http://localhost:3200';
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

async function runMvpStressSuite() {
  console.log('╔════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║   SUITE E2E DE ESTRÉS Y COMBINACIONES DE USO (MVP LAUNCH)                      ║');
  console.log('║   Pilotos • Reservas • Calendario • Configuración • RBAC • Vouchers • PWA      ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════════╝');
  console.log(`Target URL:      ${TARGET_URL}`);
  console.log(`Admin Email:     ${EMAIL}`);
  console.log(`Headless:        ${HEADLESS}`);

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;

  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  let isSimulatingOffline = false;

  let adminToken = '';

  // Arreglos de IDs para soft delete seguro y confiable al finalizar
  const createdPilotoIds: number[] = [];
  const createdReservaIds: number[] = [];
  const createdVueloIds: number[] = [];
  const createdTarifaIds: number[] = [];
  const createdPromoIds: number[] = [];
  const createdUserIds: number[] = [];
  const createdBloqueIds: number[] = [];

  try {
    // 1. Healthcheck Inicial y Sesión Headless (conforme a ADR 013 Single-Session)
    await step('1. Healthcheck Inicial y Apertura de Sesión Headless', async () => {
      const maxWaitMs = SHOULD_WAIT ? 360_000 : 15_000;
      const startTime = Date.now();
      let lastBody: any = null;

      while (Date.now() - startTime < maxWaitMs) {
        try {
          const res = await fetch(`${TARGET_URL}/api/public/health`);
          if (res.ok) {
            lastBody = await res.json();
            if (lastBody.status === 'ok') break;
          }
        } catch {}
        if (!SHOULD_WAIT) break;
        await new Promise((r) => setTimeout(r, 2000));
      }

      if (!lastBody || lastBody.status !== 'ok') {
        throw new Error(`Healthcheck falló: ${JSON.stringify(lastBody)}`);
      }
      console.log(`   🟢 Servidor en línea | Commit: ${lastBody.commit || 'N/A'} | Uptime: ${lastBody.uptime ?? 0}s`);

      // Lanzar navegador Playwright
      const chromePath = process.env.CHROME_BIN || '/usr/bin/google-chrome';
      try {
        browser = await chromium.launch({ executablePath: chromePath, headless: HEADLESS });
      } catch {
        browser = await chromium.launch({ headless: HEADLESS });
      }

      context = await browser.newContext();
      page = await context.newPage();

      // Monitor de errores en consola
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          const text = msg.text();
          // Ignorar ruidos menores de extensiones o códigos esperados de prueba
          if (
            text.includes('favicon.ico') ||
            text.includes('status of 400') ||
            text.includes('status of 403') ||
            text.includes('status of 409') ||
            (isSimulatingOffline && (text.includes('net::ERR_FAILED') || text.includes('Network Error')))
          ) {
            return;
          }
          consoleErrors.push(text);
        }
      });

      page.on('pageerror', (err) => {
        pageErrors.push(err.message);
      });

      // Login en UI
      await page.goto(`${TARGET_URL}/login`);
      await page.waitForSelector('input[type="email"]');
      await page.fill('input[type="email"]', EMAIL);
      await page.fill('input[type="password"]', PASSWORD);
      await page.click('button:has-text("Ingresar")');
      await page.waitForURL(`${TARGET_URL}/`, { timeout: 15_000 });

      // Extraer token de las cookies del navegador para sincronizar sesión con API (ADR 013 Single-Session)
      const cookies = await context.cookies();
      adminToken = cookies.find((c) => c.name === 'token')?.value || '';
      if (!adminToken) throw new Error('Token administrativo no encontrado en cookies tras login en UI');
      console.log(`   🔑 Token administrativo sincronizado con la sesión UI (ADR 013)`);

      await page.locator('h1:has-text("Panel de Control")').first().waitFor({ state: 'visible', timeout: 15_000 });
      console.log(`   🖥️ Sesión administrativa autenticada en navegador`);

      // Sincronizar y esperar activación real del Service Worker y precarga
      await page.waitForFunction(() => {
        return navigator.serviceWorker?.controller?.state === 'activated';
      }, { timeout: 25000 }).catch(() => {});
      await page.waitForTimeout(3000);
    });

    // 2. 🧑✈️ Pilotos: Validación, Alta, Reglas de Seguridad de Pasajeros y Desactivación
    await step('2. Pilotos: Validaciones, Límites de Seguridad y Desactivación con Vuelos', async () => {
      const timestamp = Date.now();

      // 2.1 Validación estricta de esquemas (rechazar email inválido)
      const invalidRes = await fetch(`${TARGET_URL}/api/pilotos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          nombre: `Piloto Invalido ${timestamp}`,
          email: 'correo-no-valido',
          peso: 75,
        }),
      });
      if (invalidRes.status !== 400) {
        throw new Error(`Se esperaba HTTP 400 ante email inválido de piloto, recibido: ${invalidRes.status}`);
      }
      console.log(`   🛡️ Validación de esquema de piloto correcta (HTTP 400 ante email inválido)`);

      // 2.2 Alta válida de piloto Master con límites de peso configurados
      const createRes = await fetch(`${TARGET_URL}/api/pilotos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          nombre: `Piloto Stress MVP ${timestamp}`,
          rutDni: '12345678-9',
          email: `piloto.mvp.${timestamp}@test.com`,
          telefono: '+56911223344',
          activo: true,
          peso: 75,
          tieneLicencia: true,
          numeroLicencia: `LIC-MVP-${timestamp.toString().slice(-4)}`,
          prioridad: 1,
          categoria: 'MASTER',
          pesoMinimoPasajero: 40,
          pesoMaximoPasajero: 105,
          disponibilidadTotal: true,
          tarifaPorVuelo: 25000,
        }),
      });
      if (!createRes.ok) throw new Error(`Fallo al crear piloto: HTTP ${createRes.status}`);
      const piloto = await createRes.json();
      const testPilotoId = piloto.id;
      createdPilotoIds.push(testPilotoId);
      console.log(`   🧑✈️ Piloto #${testPilotoId} ("${piloto.nombre}") creado exitosamente`);

      // 2.3 Disponibilidad y franjas
      const dispRes = await fetch(`${TARGET_URL}/api/pilotos/${testPilotoId}/disponibilidad`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (!dispRes.ok) throw new Error(`Fallo al consultar disponibilidad: HTTP ${dispRes.status}`);
      console.log(`   📅 Matriz de disponibilidad verificada para piloto #${testPilotoId}`);

      // 2.4 COMBINACIÓN DE SEGURIDAD: Rechazo de Pasajero con Sobrepeso (> 115kg)
      const fechaManana = new Date(Date.now() + 86400000);
      fechaManana.setHours(11, 0, 0, 0);
      const fechaHoraIso = fechaManana.toISOString();

      const reservaPesadaRes = await fetch(`${TARGET_URL}/api/reservas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          nombreTitular: `Titular Pesado ${timestamp}`,
          email: `pesado.${timestamp}@test.com`,
          telefono: '+56988776655',
          cantidadPasajeros: 1,
          valorTotal: 60000,
          abono: 60000,
          metodoPago: 'EFECTIVO',
          fechaReserva: fechaHoraIso,
          pasajeros: [{ nombre: `Pasajero 120kg ${timestamp}`, peso: 120 }], // Excede 115kg
        }),
      });
      const reservaPesada = await reservaPesadaRes.json();
      createdReservaIds.push(reservaPesada.id);
      const paxPesadoId = reservaPesada.pasajeros?.[0]?.id;

      // Intentar agendar vuelo con pasajero de 120kg -> Debe ser bloqueado por regla de seguridad (HTTP 400)
      const intentoVueloPesado = await fetch(`${TARGET_URL}/api/vuelos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          reservaId: reservaPesada.id,
          pasajeroId: paxPesadoId,
          pilotoId: testPilotoId,
          fechaHora: fechaHoraIso,
          valorPactado: 25000,
          estado: 'AGENDADO',
        }),
      });
      if (intentoVueloPesado.status !== 400) {
        throw new Error(`Se esperaba HTTP 400 al agendar pasajero con sobrepeso (>115kg), recibido: ${intentoVueloPesado.status}`);
      }
      const errPesado = await intentoVueloPesado.json();
      console.log(`   🛡️ Límite de seguridad de peso certificado: rechazado con HTTP 400 ("${errPesado.message || errPesado.error}")`);

      // 2.5 Crear reserva con pasajero normal (70kg) y agendar vuelo exitosamente
      const reservaOkRes = await fetch(`${TARGET_URL}/api/reservas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          nombreTitular: `Titular Normal ${timestamp}`,
          email: `normal.${timestamp}@test.com`,
          telefono: '+56988776655',
          cantidadPasajeros: 1,
          valorTotal: 60000,
          abono: 60000,
          metodoPago: 'EFECTIVO',
          fechaReserva: fechaHoraIso,
          pasajeros: [{ nombre: `Pasajero 70kg ${timestamp}`, peso: 70 }],
        }),
      });
      const reservaOk = await reservaOkRes.json();
      createdReservaIds.push(reservaOk.id);
      const paxNormalId = reservaOk.pasajeros?.[0]?.id;

      const vueloOkRes = await fetch(`${TARGET_URL}/api/vuelos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          reservaId: reservaOk.id,
          pasajeroId: paxNormalId,
          pilotoId: testPilotoId,
          fechaHora: fechaHoraIso,
          valorPactado: 25000,
          estado: 'AGENDADO',
        }),
      });
      if (!vueloOkRes.ok) throw new Error(`Fallo al agendar vuelo con pasajero normal: HTTP ${vueloOkRes.status}`);
      const vueloOk = await vueloOkRes.json();
      createdVueloIds.push(vueloOk.id);
      console.log(`   🛫 Vuelo #${vueloOk.id} asignado exitosamente al piloto #${testPilotoId}`);

      // 2.6 Desactivar al piloto teniendo vuelo futuro programado (PATCH)
      const deactRes = await fetch(`${TARGET_URL}/api/pilotos/${testPilotoId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ activo: false }),
      });
      if (!deactRes.ok) throw new Error(`Fallo al desactivar piloto: HTTP ${deactRes.status}`);
      console.log(`   ⚠️ Piloto #${testPilotoId} desactivado teniendo un vuelo futuro programado`);

      // Verificar que /calendario y /pilotos en UI no colapsen
      if (page) {
        await page.goto(`${TARGET_URL}/calendario`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('text=Calendario', { timeout: 8000 });
        console.log(`   🖥️ Vista /calendario renderizó limpiamente sin error ante piloto inactivo`);

        await page.goto(`${TARGET_URL}/pilotos`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('table, [data-pilotos-list]', { timeout: 8000 });
        console.log(`   🖥️ Vista /pilotos renderizó correctamente el listado`);
      }
    });

    // 3. 📝 Reservas: Idempotencia, Ciclo de Vida Completo de Vuelos y Concurrencia
    await step('3. Reservas: Idempotencia, Ciclo de Vida y Transición de Estados', async () => {
      const timestamp = Date.now();

      // 3.1 Crear reserva multi-pasajero con abono inicial 0 (Total: $120.000, Abono: $0)
      const resReserva = await fetch(`${TARGET_URL}/api/reservas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          nombreTitular: `Cliente MultiPax ${timestamp}`,
          email: `multipax.${timestamp}@test.com`,
          telefono: '+56999887766',
          cantidadPasajeros: 2,
          valorTotal: 120000,
          abono: 0,
          metodoPago: 'TRANSFERENCIA',
          fechaReserva: new Date().toISOString(),
          pasajeros: [
            { nombre: `Pax A ${timestamp}`, peso: 65 },
            { nombre: `Pax B ${timestamp}`, peso: 80 },
          ],
        }),
      });
      if (!resReserva.ok) throw new Error(`Fallo al crear reserva: HTTP ${resReserva.status}`);
      const reservaLifecycle = await resReserva.json();
      const reservaLifecycleId = reservaLifecycle.id;
      createdReservaIds.push(reservaLifecycleId);
      console.log(`   📝 Reserva #${reservaLifecycleId} creada (Total: $120.000, Abono: $0, Estado: ${reservaLifecycle.estado})`);

      // 3.2 Intento de Pago con Monto Negativo (Regla Financiera Inmutable ADR 008)
      const montoNegativoRes = await fetch(`${TARGET_URL}/api/reservas/${reservaLifecycleId}/pagos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          monto: -5000,
          metodoPago: 'EFECTIVO',
          notas: 'Intento de pago negativo ilegal',
        }),
      });
      if (montoNegativoRes.status !== 400) {
        throw new Error(`Se esperaba HTTP 400 ante monto negativo, recibido: ${montoNegativoRes.status}`);
      }
      console.log(`   🛡️ Pago inválido bloqueado correctamente por regla financiera (HTTP 400)`);

      // 3.3 Idempotencia en Pagos (ADR 009: Replay de Outbox con X-Client-Id UUID)
      const clientId = crypto.randomUUID();
      const pago1 = await fetch(`${TARGET_URL}/api/reservas/${reservaLifecycleId}/pagos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Id': clientId,
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          monto: 40000,
          metodoPago: 'TRANSFERENCIA',
          notas: 'Abono outbox original',
        }),
      });
      if (!pago1.ok) throw new Error(`Fallo en 1er pago: HTTP ${pago1.status}`);

      // Replay idéntico
      const pago2 = await fetch(`${TARGET_URL}/api/reservas/${reservaLifecycleId}/pagos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Id': clientId,
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          monto: 40000,
          metodoPago: 'TRANSFERENCIA',
          notas: 'Abono outbox duplicado',
        }),
      });
      if (!pago2.ok) throw new Error(`Fallo en 2do pago idempotente: HTTP ${pago2.status}`);

      // Consultar reserva: el abono debe ser exactamente $40.000 sin duplicarse
      const checkRes = await fetch(`${TARGET_URL}/api/reservas/${reservaLifecycleId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const updatedReserva = await checkRes.json();
      if (Number(updatedReserva.abono) !== 40000) {
        throw new Error(`Fallo de idempotencia: el abono esperado era $40.000 pero se registró $${updatedReserva.abono}`);
      }
      console.log(`   ⚡ Idempotencia de pagos certificada: exactamente $40.000 acumulados sin doble cobro en replay`);

      // Segundo abono legítimo con nuevo UUID para saldar el 100% ($120.000) y pasar a PAGADO
      const pago2Nuevo = await fetch(`${TARGET_URL}/api/reservas/${reservaLifecycleId}/pagos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Id': crypto.randomUUID(),
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          monto: 80000,
          metodoPago: 'TRANSFERENCIA',
          notas: 'Pago de saldo total',
        }),
      });
      if (!pago2Nuevo.ok) throw new Error(`Fallo en segundo abono: HTTP ${pago2Nuevo.status}`);
      console.log(`   💵 Saldo total saldado: total acumulado $120.000 (PAGADO)`);

      // 3.4 COMBINACIÓN DE CICLO DE VIDA: Vuelos AGENDADO → COMPLETADO y Auto-Completado de Reserva
      // Crear piloto activo para agendar estos vuelos
      const pilotoCicloRes = await fetch(`${TARGET_URL}/api/pilotos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          nombre: `Piloto Ciclo ${timestamp}`,
          email: `piloto.ciclo.${timestamp}@test.com`,
          telefono: '+56944556677',
          activo: true,
          peso: 70,
          tieneLicencia: true,
          categoria: 'SENIOR',
          disponibilidadTotal: true,
        }),
      });
      const pilotoCiclo = await pilotoCicloRes.json();
      createdPilotoIds.push(pilotoCiclo.id);

      const paxAId = reservaLifecycle.pasajeros[0].id;
      const paxBId = reservaLifecycle.pasajeros[1].id;

      const fHora1 = new Date(Date.now() + 100000000).toISOString();
      const fHora2 = new Date(Date.now() + 103600000).toISOString();

      const vueloARes = await fetch(`${TARGET_URL}/api/vuelos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          reservaId: reservaLifecycleId,
          pasajeroId: paxAId,
          pilotoId: pilotoCiclo.id,
          fechaHora: fHora1,
          valorPactado: 40000,
          estado: 'AGENDADO',
        }),
      });
      const vueloA = await vueloARes.json();
      createdVueloIds.push(vueloA.id);

      const vueloBRes = await fetch(`${TARGET_URL}/api/vuelos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          reservaId: reservaLifecycleId,
          pasajeroId: paxBId,
          pilotoId: pilotoCiclo.id,
          fechaHora: fHora2,
          valorPactado: 40000,
          estado: 'AGENDADO',
        }),
      });
      const vueloB = await vueloBRes.json();
      createdVueloIds.push(vueloB.id);

      console.log(`   🛫 Vuelos #${vueloA.id} y #${vueloB.id} agendados para la reserva #${reservaLifecycleId}`);

      // Marcar Vuelo A como COMPLETADO
      const updateVueloA = await fetch(`${TARGET_URL}/api/vuelos/${vueloA.id}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ estado: 'COMPLETADO' }),
      });
      if (!updateVueloA.ok) throw new Error(`Fallo al completar vuelo A: HTTP ${updateVueloA.status}`);

      // Consultar reserva: aún no debe estar COMPLETADA porque falta Vuelo B
      const resCheck1 = await (await fetch(`${TARGET_URL}/api/reservas/${reservaLifecycleId}`, { headers: { Authorization: `Bearer ${adminToken}` } })).json();
      if (resCheck1.estado === 'COMPLETADA') {
        throw new Error(`La reserva se marcó prematuramente como COMPLETADA teniendo vuelos pendientes`);
      }
      console.log(`   ⏳ Vuelo A completado; reserva #${reservaLifecycleId} se mantiene activa (Estado: ${resCheck1.estado})`);

      // Marcar Vuelo B como COMPLETADO
      const updateVueloB = await fetch(`${TARGET_URL}/api/vuelos/${vueloB.id}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ estado: 'COMPLETADO' }),
      });
      if (!updateVueloB.ok) throw new Error(`Fallo al completar vuelo B: HTTP ${updateVueloB.status}`);

      // Consultar reserva: ahora al estar todos sus vuelos completados, la reserva DEBE transicionar a COMPLETADA
      const resCheck2 = await (await fetch(`${TARGET_URL}/api/reservas/${reservaLifecycleId}`, { headers: { Authorization: `Bearer ${adminToken}` } })).json();
      if (resCheck2.estado !== 'COMPLETADA') {
        throw new Error(`La reserva debió transicionar automáticamente a COMPLETADA tras completar todos los vuelos. Estado actual: ${resCheck2.estado}`);
      }
      console.log(`   🏁 Transición reactiva confirmada: Reserva #${reservaLifecycleId} pasó automáticamente a COMPLETADA`);

      // Intentar retroceder estado terminal de Vuelo A (COMPLETADO → AGENDADO) -> Debe ser rechazado (HTTP 400)
      const retroVuelo = await fetch(`${TARGET_URL}/api/vuelos/${vueloA.id}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ estado: 'AGENDADO' }),
      });
      if (retroVuelo.status !== 400) {
        throw new Error(`Se esperaba HTTP 400 ante reversión de estado terminal en vuelo, recibido: ${retroVuelo.status}`);
      }
      console.log(`   🛡️ Inmutabilidad de estado terminal en vuelos certificada (HTTP 400 ante reversión ilegal)`);

      // 3.5 Ciclo de Cancelación Formal y Concurrencia Optimista (en reserva secundaria)
      const reservaCancelRes = await fetch(`${TARGET_URL}/api/reservas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          nombreTitular: `Cliente Para Cancelar ${timestamp}`,
          email: `cancel.${timestamp}@test.com`,
          telefono: '+56911223344',
          cantidadPasajeros: 1,
          valorTotal: 50000,
          abono: 50000,
          metodoPago: 'EFECTIVO',
          fechaReserva: new Date().toISOString(),
          pasajeros: [{ nombre: `Pax Cancelar ${timestamp}`, peso: 70 }],
        }),
      });
      const resCancelar = await reservaCancelRes.json();
      createdReservaIds.push(resCancelar.id);

      // Intento de cancelación con versión desfasada (HTTP 409)
      const cancelStale = await fetch(`${TARGET_URL}/api/reservas/${resCancelar.id}/cancelar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          motivo: 'Intento con versión desfasada',
          version: resCancelar.version - 1,
        }),
      });
      if (cancelStale.status !== 409) {
        throw new Error(`Se esperaba HTTP 409 ante versión desfasada, recibido: ${cancelStale.status}`);
      }
      console.log(`   🛡️ Concurrencia optimista certificada: versión desfasada rechazada con HTTP 409 Conflict`);

      // Cancelar formalmente con versión correcta
      const cancelOk = await fetch(`${TARGET_URL}/api/reservas/${resCancelar.id}/cancelar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          motivo: 'Fuerza mayor clima',
          version: resCancelar.version,
        }),
      });
      if (!cancelOk.ok) throw new Error(`Fallo al cancelar formalmente: HTTP ${cancelOk.status}`);
      const resCanceladaData = await cancelOk.json();
      console.log(`   🚫 Reserva #${resCancelar.id} cancelada formalmente (Estado: ${resCanceladaData.estado})`);

      // Intentar devolver monto superior al abono ($60.000 > $50.000) -> HTTP 400
      const sobreDev = await fetch(`${TARGET_URL}/api/reservas/${resCancelar.id}/devoluciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          monto: 60000,
          metodoPago: 'EFECTIVO',
          notas: 'Devolución ilegal mayor al abono',
          version: resCanceladaData.version,
        }),
      });
      if (sobreDev.status !== 400) {
        throw new Error(`Se esperaba HTTP 400 ante devolución mayor al abono, recibido: ${sobreDev.status}`);
      }
      console.log(`   🛡️ Devolución superior al abono bloqueada (HTTP 400)`);

      // Devolución válida de los $50.000
      const validDev = await fetch(`${TARGET_URL}/api/reservas/${resCancelar.id}/devoluciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          monto: 50000,
          metodoPago: 'EFECTIVO',
          notas: 'Devolución total',
          version: resCanceladaData.version,
        }),
      });
      if (!validDev.ok) throw new Error(`Fallo en devolución válida: HTTP ${validDev.status}`);
      console.log(`   💵 Devolución total registrada exitosamente`);

      // 3.6 Resiliencia offline PWA en navegador headless
      if (page && context) {
        await page.goto(`${TARGET_URL}/reservas`, { waitUntil: 'domcontentloaded' });
        isSimulatingOffline = true;
        try {
          await context.setOffline(true);
          await page.evaluate(() => window.dispatchEvent(new Event('offline')));
          await page.waitForTimeout(500);
          console.log(`   📶 Navegador puesto en modo Offline (simulando corte de red)`);

          await page.click('a[href="/calendario"]');
          await page.waitForSelector('text=Calendario', { timeout: 10000 });
          console.log(`   📶 PWA gestionó navegación offline sin crashear`);
        } finally {
          await context.setOffline(false);
          await page.waitForLoadState('domcontentloaded').catch(() => {});
          await page.evaluate(() => window.dispatchEvent(new Event('online'))).catch(() => {});
          isSimulatingOffline = false;
          console.log(`   📶 Conectividad de red restaurada`);
        }
      }
    });

    // 4. 📅 Calendario: Carrera Crítica (Race Condition) y Agendamiento en Grupo
    await step('4. Calendario: Carrera Crítica de Colisión y Agendamiento en Grupo', async () => {
      const timestamp = Date.now();
      const fechaColision = new Date(Date.now() + 172800000); // Pasado mañana
      fechaColision.setHours(16, 0, 0, 0);
      const fechaHoraColision = fechaColision.toISOString();

      // Crear piloto para prueba de colisión concurrente
      const pilRes = await fetch(`${TARGET_URL}/api/pilotos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          nombre: `Piloto Carrera ${timestamp}`,
          email: `carrera.${timestamp}@test.com`,
          telefono: '+56944332211',
          activo: true,
          peso: 72,
          tieneLicencia: true,
          categoria: 'SENIOR',
          disponibilidadTotal: true,
        }),
      });
      const pilotoCarrera = await pilRes.json();
      const carreraPilotoId = pilotoCarrera.id;
      createdPilotoIds.push(carreraPilotoId);

      // Crear dos reservas con un pasajero cada una
      const resA = await (await fetch(`${TARGET_URL}/api/reservas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          nombreTitular: `Carrera A ${timestamp}`,
          email: `carrera.a.${timestamp}@test.com`,
          telefono: '+56911112222',
          cantidadPasajeros: 1,
          valorTotal: 50000,
          abono: 50000,
          metodoPago: 'EFECTIVO',
          fechaReserva: fechaHoraColision,
          pasajeros: [{ nombre: `Pax Carrera A ${timestamp}`, peso: 68 }],
        }),
      })).json();
      createdReservaIds.push(resA.id);

      const resB = await (await fetch(`${TARGET_URL}/api/reservas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          nombreTitular: `Carrera B ${timestamp}`,
          email: `carrera.b.${timestamp}@test.com`,
          telefono: '+56933334444',
          cantidadPasajeros: 1,
          valorTotal: 50000,
          abono: 50000,
          metodoPago: 'EFECTIVO',
          fechaReserva: fechaHoraColision,
          pasajeros: [{ nombre: `Pax Carrera B ${timestamp}`, peso: 74 }],
        }),
      })).json();
      createdReservaIds.push(resB.id);

      // 4.1 COMBINACIÓN DE CONCURRENCIA: Disparo Simultáneo Paralelo (Promise.all)
      console.log(`   ⚡ Disparando 2 agendamientos paralelos simultáneos para el mismo piloto a las 16:00...`);
      const payloadBase = {
        pilotoId: carreraPilotoId,
        fechaHora: fechaHoraColision,
        valorPactado: 25000,
        estado: 'AGENDADO',
      };

      const [resul1, resul2] = await Promise.all([
        fetch(`${TARGET_URL}/api/vuelos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
          body: JSON.stringify({ ...payloadBase, reservaId: resA.id, pasajeroId: resA.pasajeros[0].id }),
        }),
        fetch(`${TARGET_URL}/api/vuelos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
          body: JSON.stringify({ ...payloadBase, reservaId: resB.id, pasajeroId: resB.pasajeros[0].id }),
        }),
      ]);

      const status1 = resul1.status;
      const status2 = resul2.status;
      console.log(`   📊 Respuestas de carrera: Petición 1 = HTTP ${status1} | Petición 2 = HTTP ${status2}`);

      // Una debe haber ganado (201) y la otra debe haber sido rechazada con conflicto (400)
      const passedCount = (status1 === 201 ? 1 : 0) + (status2 === 201 ? 1 : 0);
      const blockedCount = (status1 === 400 ? 1 : 0) + (status2 === 400 ? 1 : 0);

      if (passedCount !== 1 || blockedCount !== 1) {
        throw new Error(`Fallo en control de colisión concurrente: se esperaba 1 aprobada (201) y 1 rechazada (400), pero se obtuvo ${passedCount} y ${blockedCount}`);
      }

      const exitoBody = status1 === 201 ? await resul1.json() : await resul2.json();
      createdVueloIds.push(exitoBody.id);
      console.log(`   🛡️ Aislamiento atómico certificado: 1 vuelo agendado (#${exitoBody.id}) y el concurrente bloqueado por colisión horaria`);

      // 4.2 COMBINACIÓN: Agendamiento en Grupo con Asignación Automática de Pool
      // Crear segundo piloto disponible para la misma hora
      const pil2Res = await fetch(`${TARGET_URL}/api/pilotos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          nombre: `Piloto Pool B ${timestamp}`,
          email: `pool.b.${timestamp}@test.com`,
          telefono: '+56988887777',
          activo: true,
          peso: 75,
          tieneLicencia: true,
          categoria: 'MASTER',
          prioridad: 1,
          disponibilidadTotal: true,
        }),
      });
      if (!pil2Res.ok) throw new Error(`Fallo creando Piloto Pool B: HTTP ${pil2Res.status} - ${await pil2Res.text()}`);
      const pilotoPoolB = await pil2Res.json();
      createdPilotoIds.push(pilotoPoolB.id);

      // Crear piloto C
      const pil3Res = await fetch(`${TARGET_URL}/api/pilotos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          nombre: `Piloto Pool C ${timestamp}`,
          email: `pool.c.${timestamp}@test.com`,
          telefono: '+56988886666',
          activo: true,
          peso: 78,
          tieneLicencia: true,
          categoria: 'SENIOR',
          prioridad: 2,
          disponibilidadTotal: true,
        }),
      });
      if (!pil3Res.ok) throw new Error(`Fallo creando Piloto Pool C: HTTP ${pil3Res.status} - ${await pil3Res.text()}`);
      const pilotoPoolC = await pil3Res.json();
      createdPilotoIds.push(pilotoPoolC.id);

      const fechaGrupo = new Date(Date.now() + 259200000); // 3 días después
      fechaGrupo.setHours(10, 0, 0, 0);
      const fechaHoraGrupo = fechaGrupo.toISOString();

      const resGrupo = await (await fetch(`${TARGET_URL}/api/reservas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          nombreTitular: `Grupo AutoAssign ${timestamp}`,
          email: `grupo.${timestamp}@test.com`,
          telefono: '+56955554444',
          cantidadPasajeros: 2,
          valorTotal: 120000,
          abono: 120000,
          metodoPago: 'EFECTIVO',
          fechaReserva: fechaHoraGrupo,
          pasajeros: [
            { nombre: `Pax Auto 1 ${timestamp}`, peso: 65 },
            { nombre: `Pax Auto 2 ${timestamp}`, peso: 80 },
          ],
        }),
      })).json();
      createdReservaIds.push(resGrupo.id);

      // Invocar agendamiento de grupo automático sin pasar 'asignaciones'
      const autoGrupoRes = await fetch(`${TARGET_URL}/api/vuelos/agendamiento-grupo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          reservaId: resGrupo.id,
          fechaHora: fechaHoraGrupo,
          valorPactadoPorPasajero: 60000,
        }),
      });
      if (!autoGrupoRes.ok) {
        const errBody = await autoGrupoRes.text();
        throw new Error(`Fallo en agendamiento en grupo: HTTP ${autoGrupoRes.status} - ${errBody}`);
      }
      const autoGrupoData = await autoGrupoRes.json();
      if (!autoGrupoData.vuelos || autoGrupoData.vuelos.length !== 2) {
        throw new Error(`Se esperaban 2 vuelos auto-asignados, recibido: ${autoGrupoData.vuelos?.length}`);
      }
      for (const v of autoGrupoData.vuelos) createdVueloIds.push(v.id);
      console.log(`   ✨ Agendamiento en grupo exitoso: 2 vuelos asignados automáticamente por el algoritmo de pool`);

      // 4.3 Bloqueo Operativo de Franja Horaria
      const diasOffset = 15 + Math.floor((timestamp % 1000) / 10);
      const fechaBloqueo = new Date(Date.now() + diasOffset * 86400000);
      const fechaBloqueoStr = fechaBloqueo.toISOString().split('T')[0];
      const bloqueRes = await fetch(`${TARGET_URL}/api/configuracion-bloques`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          nombre: `Bloqueo Pista ${timestamp}`,
          fechaExacta: fechaBloqueoStr,
          bloqueado: true,
          horarios: [{ horaInicio: '15:00', horaFin: '16:00' }],
        }),
      });
      if (!bloqueRes.ok) {
        const errBody = await bloqueRes.text();
        throw new Error(`Fallo al registrar bloqueo operativo: HTTP ${bloqueRes.status} - ${errBody}`);
      }
      const bloque = await bloqueRes.json();
      createdBloqueIds.push(bloque.id);
      console.log(`   🚫 Franja 15:00-16:00 bloqueada operativamente para ${fechaBloqueoStr}`);

      // Consultar resolver de disponibilidad
      const resolverRes = await fetch(`${TARGET_URL}/api/configuracion-bloques/resolver?desde=${fechaBloqueoStr}&hasta=${fechaBloqueoStr}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (!resolverRes.ok) throw new Error(`Fallo al consultar resolver de disponibilidad: HTTP ${resolverRes.status}`);
      console.log(`   ⚙️ Resolver de disponibilidad operativo validado`);
    });

    // 5. ⚙️ Configuración, Seguridad RBAC y Vistas Públicas (Vouchers y Deslindes)
    await step('5. Configuración: Tarifas, Promociones, RBAC y Vistas Públicas', async () => {
      const timestamp = Date.now();

      // 5.1 Tarifas: Crear y validar formato
      const tarifaRes = await fetch(`${TARGET_URL}/api/tarifas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          nombre: `Tarifa Sunset MVP ${timestamp}`,
          descripcion: 'Tarifa especial para vuelos de atardecer',
          precio: 95000,
          activo: true,
        }),
      });
      if (!tarifaRes.ok) throw new Error(`Fallo al crear tarifa: HTTP ${tarifaRes.status}`);
      const tarifa = await tarifaRes.json();
      createdTarifaIds.push(tarifa.id);
      console.log(`   💰 Tarifa #${tarifa.id} ("${tarifa.nombre}") creada a $${tarifa.precio}`);

      // 5.2 Promociones: Casos Borde de Validación
      const promoInvalida1 = await fetch(`${TARGET_URL}/api/promociones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          nombre: `Promo Ilegal ${timestamp}`,
          tipoDescuento: 'PORCENTAJE',
          valor: 150, // Más de 100%
        }),
      });
      if (promoInvalida1.status !== 400) {
        throw new Error(`Se esperaba HTTP 400 ante porcentaje > 100%, recibido: ${promoInvalida1.status}`);
      }
      console.log(`   🛡️ Promoción con porcentaje > 100% correctamente rechazada (HTTP 400)`);

      const promoInvalida2 = await fetch(`${TARGET_URL}/api/promociones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          nombre: `Promo Fechas Invertidas ${timestamp}`,
          tipoDescuento: 'MONTO_FIJO',
          valor: 10000,
          fechaInicio: '2026-10-15',
          fechaFin: '2026-10-10', // Fin anterior a inicio
        }),
      });
      if (promoInvalida2.status !== 400) {
        throw new Error(`Se esperaba HTTP 400 ante fechas invertidas, recibido: ${promoInvalida2.status}`);
      }
      console.log(`   🛡️ Promoción con fechas invertidas correctamente rechazada (HTTP 400)`);

      const promoValida = await (await fetch(`${TARGET_URL}/api/promociones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          nombre: `PROMO-MVP-20 ${timestamp}`,
          descripcion: 'Descuento lanzamiento',
          tipoDescuento: 'PORCENTAJE',
          valor: 20,
          activa: true,
        }),
      })).json();
      createdPromoIds.push(promoValida.id);
      console.log(`   🏷️ Promoción #${promoValida.id} creada exitosamente`);

      // 5.3 Barrera de Seguridad RBAC: Usuario RECEPCION
      const userRes = await (await fetch(`${TARGET_URL}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          nombre: `Operador Recepcion ${timestamp}`,
          email: `recepcion.${timestamp}@test.com`,
          password: 'Password123!',
          role: 'RECEPCION',
        }),
      })).json();
      createdUserIds.push(userRes.id);

      const loginRecep = await (await fetch(`${TARGET_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: `recepcion.${timestamp}@test.com`, password: 'Password123!' }),
      })).json();

      // Consultar tarifas siendo RECEPCION -> HTTP 403 Forbidden
      const rbacTarifas = await fetch(`${TARGET_URL}/api/tarifas`, {
        headers: { Authorization: `Bearer ${loginRecep.token}` },
      });
      if (rbacTarifas.status !== 403) {
        throw new Error(`Se esperaba HTTP 403 Forbidden para rol RECEPCION en tarifas, recibido: ${rbacTarifas.status}`);
      }
      console.log(`   🔒 API RBAC: Rol RECEPCION bloqueado con HTTP 403 en endpoints administrativos`);

      if (browser) {
        const recepContext = await browser.newContext();
        const recepPage = await recepContext.newPage();
        await recepPage.goto(`${TARGET_URL}/login`);
        await recepPage.waitForSelector('input[type="email"]');
        await recepPage.fill('input[type="email"]', `recepcion.${timestamp}@test.com`);
        await recepPage.fill('input[type="password"]', 'Password123!');
        await recepPage.click('button:has-text("Ingresar")');
        await recepPage.waitForURL(`${TARGET_URL}/`, { timeout: 15_000 });

        await recepPage.goto(`${TARGET_URL}/configuracion`);
        await recepPage.waitForSelector('text=Acceso restringido', { timeout: 8000 });
        console.log(`   🔒 UI RBAC: Vista /configuracion bloqueada visualmente para RECEPCION`);
        await recepContext.close();
      }

      // 5.4 COMBINACIÓN: Voucher Público y Firma de Deslinde Digital en Contexto Anónimo
      // Crear reserva con pasajero para deslinde
      const resVoucher = await (await fetch(`${TARGET_URL}/api/reservas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          nombreTitular: `Pasajero Deslinde ${timestamp}`,
          email: `deslinde.${timestamp}@test.com`,
          telefono: '+56977778888',
          cantidadPasajeros: 1,
          valorTotal: 70000,
          abono: 70000,
          metodoPago: 'TRANSFERENCIA',
          fechaReserva: new Date().toISOString(),
          pasajeros: [{ nombre: `Pasajero Firma ${timestamp}`, peso: 72 }],
        }),
      })).json();
      createdReservaIds.push(resVoucher.id);

      // Obtener datos públicos de la reserva para extraer tokens no correlativos
      const publicIdVoucher = resVoucher.tokenPublico || resVoucher.shortId;
      if (!publicIdVoucher) throw new Error('La reserva creada no tiene tokenPublico/shortId');
      const pubReservaRes = await fetch(`${TARGET_URL}/api/public/reservas/${publicIdVoucher}`);
      if (!pubReservaRes.ok) throw new Error(`Fallo al consultar reserva pública: HTTP ${pubReservaRes.status}`);
      const pubData = await pubReservaRes.json();
      const tokenPublicoReserva = pubData.tokenPublico;
      const paxPublico = pubData.pasajeros?.[0];
      const tokenPublicoPax = paxPublico?.tokenPublico || paxPublico?.shortId;

      if (!tokenPublicoReserva || !tokenPublicoPax) {
        throw new Error(`No se generaron tokens públicos para la reserva o el pasajero`);
      }
      console.log(`   🎟️ Tokens públicos generados: Reserva = ${tokenPublicoReserva.slice(0, 10)}... | Pasajero = ${String(tokenPublicoPax).slice(0, 10)}...`);

      // Abrir navegador en contexto anónimo (sin cookies) y visitar el Voucher Público
      if (browser) {
        const anonContext = await browser.newContext();
        const anonPage = await anonContext.newPage();

        // 1) Visitar /voucher/[tokenPublico]
        await anonPage.goto(`${TARGET_URL}/voucher/${tokenPublicoReserva}`, { waitUntil: 'domcontentloaded' });
        await anonPage.locator('h1, h2, [data-voucher], div:has-text("Vuelo"), div:has-text("Reserva")').first().waitFor({ state: 'visible', timeout: 8000 });
        console.log(`   🖥️ Vista pública /voucher/[token] renderizó exitosamente sin autenticación`);

        // 2) Visitar /deslinde/[tokenPublico]
        await anonPage.goto(`${TARGET_URL}/deslinde/${tokenPublicoReserva}`, { waitUntil: 'domcontentloaded' });
        await anonPage.locator('form, h1, h2, div:has-text("Deslinde"), div:has-text("Términos")').first().waitFor({ state: 'visible', timeout: 8000 });
        console.log(`   🖥️ Formulario público /deslinde/[token] renderizó correctamente`);
        await anonContext.close();
      }

      // 3) Firmar deslinde digital vía API pública
      const firmaRes = await fetch(`${TARGET_URL}/api/public/pasajeros/${tokenPublicoPax}/firma`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firmaBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          rutDni: '18.765.432-1',
          contactoEmergencia: 'Contacto Familiar',
          telefonoEmergencia: '+56911223344',
          condicionFisica: 'Excelente',
          pesoVerificado: 73,
        }),
      });
      if (!firmaRes.ok) throw new Error(`Fallo al enviar firma de deslinde pública: HTTP ${firmaRes.status}`);
      const firmaData = await firmaRes.json();
      if (!firmaData.pasajero?.firmaDeslinde) {
        throw new Error(`El campo firmaDeslinde no se registró como true tras firmar`);
      }
      console.log(`   ✍️ Firma de deslinde digital registrada exitosamente para pasajero #${firmaData.pasajero.id}`);

      // Comprobar que la reserva pública refleja la firma
      const checkFirma = await (await fetch(`${TARGET_URL}/api/public/reservas/${tokenPublicoReserva}`)).json();
      if (!checkFirma.pasajeros?.[0]?.firmaDeslinde) {
        throw new Error(`La firma de deslinde no se refleja en la consulta pública de la reserva`);
      }
      console.log(`   ✅ Estado de firma sincronizado y visible en el comprobante público`);
    });

    // 6. 🖥️ Estrés de Interacción UI en Navegador Headless
    await step('6. Estrés de Navegación Interactiva UI en Headless Browser', async () => {
      if (page) {
        console.log(`   🖱️ Probando navegación rápida en /calendario (Mes, Semana, Día, Hoy)...`);
        await page.goto(`${TARGET_URL}/calendario`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('text=Calendario', { timeout: 8000 });

        // Conmutar vistas si están disponibles en la barra de herramientas
        const weekBtn = page.locator('button:has-text("Semana"), .rbc-btn-group button:nth-child(3)');
        if (await weekBtn.count() > 0) {
          await weekBtn.first().click();
          await page.waitForTimeout(300);
        }

        const dayBtn = page.locator('button:has-text("Día"), .rbc-btn-group button:nth-child(4)');
        if (await dayBtn.count() > 0) {
          await dayBtn.first().click();
          await page.waitForTimeout(300);
        }

        const monthBtn = page.locator('button:has-text("Mes"), .rbc-btn-group button:nth-child(2)');
        if (await monthBtn.count() > 0) {
          await monthBtn.first().click();
          await page.waitForTimeout(300);
        }

        console.log(`   🖱️ Probando filtrado reactivo en /reservas...`);
        await page.goto(`${TARGET_URL}/reservas`, { waitUntil: 'domcontentloaded' });
        const searchInput = page.locator('input[type="text"], input[placeholder*="Buscar"]').first();
        if (await searchInput.count() > 0) {
          await searchInput.fill('MultiPax');
          await page.waitForTimeout(400);
          await searchInput.fill('');
          await page.waitForTimeout(300);
        }

        console.log(`   🖱️ Comprobando renderizado en /pilotos...`);
        await page.goto(`${TARGET_URL}/pilotos`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('table, [data-pilotos-list], h1:has-text("Pilotos")', { timeout: 8000 });
      }

      // Verificación de estabilidad y consola limpia
      if (pageErrors.length > 0) {
        throw new Error(`Se detectaron excepciones de JavaScript no controladas (pageerror): ${pageErrors.join(' | ')}`);
      }
      if (consoleErrors.length > 0) {
        console.warn(`   ⚠️ Advertencias en consola detectadas (${consoleErrors.length}):`, consoleErrors.slice(0, 3));
      } else {
        console.log(`   🟢 Consola del navegador 100% limpia de errores severos`);
      }
    });

    // 7. 🧹 Limpieza Segura de Datos de Prueba (Soft Delete)
    await step('7. Limpieza Segura de Datos de Prueba (Soft Delete)', async () => {
      console.log(`   🧹 Limpiando ${createdVueloIds.length} vuelos creados...`);
      for (const id of createdVueloIds) {
        try {
          await fetch(`${TARGET_URL}/api/vuelos/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${adminToken}` } });
        } catch {}
      }

      console.log(`   🧹 Limpiando ${createdReservaIds.length} reservas creadas...`);
      for (const id of createdReservaIds) {
        try {
          await fetch(`${TARGET_URL}/api/reservas/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${adminToken}` } });
        } catch {}
      }

      console.log(`   🧹 Limpiando ${createdPilotoIds.length} pilotos creados...`);
      for (const id of createdPilotoIds) {
        try {
          await fetch(`${TARGET_URL}/api/pilotos/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${adminToken}` } });
        } catch {}
      }

      console.log(`   🧹 Limpiando tarifas, promociones, bloques y usuarios RBAC...`);
      for (const id of createdTarifaIds) {
        try {
          await fetch(`${TARGET_URL}/api/tarifas/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${adminToken}` } });
        } catch {}
      }
      for (const id of createdPromoIds) {
        try {
          await fetch(`${TARGET_URL}/api/promociones/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${adminToken}` } });
        } catch {}
      }
      for (const id of createdBloqueIds) {
        try {
          await fetch(`${TARGET_URL}/api/configuracion-bloques/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${adminToken}` } });
        } catch {}
      }
      for (const id of createdUserIds) {
        try {
          await fetch(`${TARGET_URL}/api/users/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${adminToken}` } });
        } catch {}
      }
      console.log(`   ✨ Limpieza de datos de prueba completada sin afectar registros productivos`);
    });

  } catch (err) {
    console.error('\n💥 Error fatal en la suite de estrés del MVP:', err);
    process.exitCode = 1;
  } finally {
    // Limpieza de seguridad en caso de fallo prematuro
    if (adminToken && (createdVueloIds.length > 0 || createdReservaIds.length > 0 || createdPilotoIds.length > 0)) {
      for (const id of createdVueloIds) {
        try { await fetch(`${TARGET_URL}/api/vuelos/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${adminToken}` } }); } catch {}
      }
      for (const id of createdReservaIds) {
        try { await fetch(`${TARGET_URL}/api/reservas/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${adminToken}` } }); } catch {}
      }
      for (const id of createdPilotoIds) {
        try { await fetch(`${TARGET_URL}/api/pilotos/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${adminToken}` } }); } catch {}
      }
      for (const id of createdTarifaIds) {
        try { await fetch(`${TARGET_URL}/api/tarifas/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${adminToken}` } }); } catch {}
      }
      for (const id of createdPromoIds) {
        try { await fetch(`${TARGET_URL}/api/promociones/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${adminToken}` } }); } catch {}
      }
      for (const id of createdBloqueIds) {
        try { await fetch(`${TARGET_URL}/api/configuracion-bloques/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${adminToken}` } }); } catch {}
      }
      for (const id of createdUserIds) {
        try { await fetch(`${TARGET_URL}/api/users/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${adminToken}` } }); } catch {}
      }
    }

    if (browser) {
      await browser.close();
    }

    console.log('\n================================================================================');
    console.log('                 RESUMEN DE EJECUCIÓN - ESTRÉS MVP (STAGING)                     ');
    console.log('================================================================================');
    for (const r of results) {
      const statusIcon = r.ok ? '✅ PASS' : '❌ FAIL';
      const duration = `${r.durationMs}ms`.padStart(8);
      console.log(`${statusIcon} | ${r.name.padEnd(70)} | ${duration}`);
      if (r.error) {
        console.log(`         └─ Error: ${r.error}`);
      }
    }
    console.log('================================================================================');

    const totalPassed = results.filter((r) => r.ok).length;
    if (totalPassed === results.length && results.length > 0) {
      console.log('🎉 ¡SUITE DE ESTRÉS Y COMBINACIONES MVP COMPLETADA CON 100% DE ÉXITO EN STAGING! 🎉\n');
    } else {
      console.log(`⚠️ SUITE INCOMPLETA: ${totalPassed}/${results.length} etapas aprobadas.\n`);
      process.exitCode = 1;
    }
  }
}

runMvpStressSuite();
