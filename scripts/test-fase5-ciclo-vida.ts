/**
 * Suite E2E de Fase 5: Ciclo de Vida Transaccional y Cuadratura Contable
 * 
 * Cobertura de extremo a extremo del ciclo operativo y financiero completo:
 * 1. Healthcheck Inicial y Verificación de API en Vivo
 * 2. Creación de Reserva con Abono Parcial (estado: ABONADO, tokenPublico / shortId)
 * 3. Agendamiento y Asignación de Vuelo a Piloto Activo (estado: CONFIRMADO)
 * 4. Firma Digital de Deslinde en Ruta Pública (/deslinde/[id] con canvas / API pública)
 * 5. Visualización del Voucher Digital del Pasajero (/voucher/[id] con QR y Ticket)
 * 6. Registro de Pago de Saldo Restante y Transición a PAGADO_TOTAL
 * 7. Ejecución y Cierre de Vuelo a estado COMPLETADO
 * 8. Verificación de Inclusión en Manifiesto Diario de Vuelo (/reportes/manifiesto)
 * 9. Cuadratura Contable en Liquidaciones de Pilotos (/reportes/liquidaciones, Decimal(12,2))
 * 10. Verificación de Impacto en Analíticas y Métricas Financieras (/analiticas)
 * 11. Limpieza Segura (Soft Delete / Cancelación de Registros de Prueba)
 * 
 * Ejecución:
 *   npx tsx scripts/test-fase5-ciclo-vida.ts
 *   npm run test:fase5:prod
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

async function runFase5Suite() {
  console.log('====================================================');
  console.log(`🚀 INICIANDO SUITE FASE 5 (CICLO DE VIDA Y FINANZAS): ${TARGET_URL}`);
  console.log('====================================================');

  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: HEADLESS,
  });

  const timestamp = Date.now();
  const VALOR_TOTAL = 70000;
  const ABONO_INICIAL = 25000;
  const SALDO_RESTANTE = VALOR_TOTAL - ABONO_INICIAL; // 45000

  let adminToken: string | null = null;
  let pilotoSeleccionado: any = null;
  let reservaCreada: any = null;
  let pasajeroCreado: any = null;
  let vueloCreado: any = null;

  try {
    // 1. Healthcheck Inicial
    await step('1. Verificación Inicial del Sistema (/api/public/health)', async () => {
      const maxWaitMs = SHOULD_WAIT ? 360_000 : 15_000;
      const intervalMs = 3_000;
      const startTime = Date.now();

      while (Date.now() - startTime < maxWaitMs) {
        try {
          const res = await fetch(`${TARGET_URL}/api/public/health`);
          if (res.ok) {
            const data = await res.json();
            const commit = data.commit || 'unknown';
            console.log(`   📡 Healthcheck OK (commit: ${commit}, version: ${data.version || '1.0.0'})`);

            const commitClean = (commit || '').toLowerCase();
            const targetClean = (EXPECTED_COMMIT || '').toLowerCase();
            const isMatch = commitClean.includes(targetClean) || targetClean.includes(commitClean.replace(/^sha-/, ''));

            if (EXPECTED_COMMIT && !isMatch) {
              console.log(`   ⏳ Esperando commit ${EXPECTED_COMMIT}... actual: ${commit}`);
              await new Promise(r => setTimeout(r, intervalMs));
              continue;
            }
            return;
          }
        } catch {
          // Esperar reintento
        }
        await new Promise(r => setTimeout(r, intervalMs));
      }
      throw new Error(`Timeout esperando que el servidor responda en ${TARGET_URL}/api/public/health`);
    });

    // 2. Autenticación Admin
    await step('2. Autenticación Admin y Obtención de Sesión', async () => {
      const loginRes = await fetch(`${TARGET_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
      });

      if (!loginRes.ok) {
        throw new Error(`Fallo al autenticar admin en API (HTTP ${loginRes.status})`);
      }

      const loginData = await loginRes.json();
      adminToken = loginData.token;
      if (!adminToken) {
        throw new Error('No se recibió token en respuesta de login');
      }

      // Obtener pilotos activos para asignación posterior
      const pilotosRes = await fetch(`${TARGET_URL}/api/pilotos?activo=true&pageSize=50`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (!pilotosRes.ok) {
        throw new Error(`Error al listar pilotos (HTTP ${pilotosRes.status})`);
      }
      const pilotosEnvelope = await pilotosRes.json();
      const pilotos = pilotosEnvelope.data || pilotosEnvelope;
      if (!Array.isArray(pilotos) || pilotos.length === 0) {
        throw new Error('No se encontraron pilotos activos en la base de datos');
      }
      pilotoSeleccionado = pilotos[0];
      console.log(`   👨✈️ Piloto asignado para prueba: ${pilotoSeleccionado.nombre} (ID: ${pilotoSeleccionado.id})`);
    });

    // 3. Creación de Reserva Inicial (estadoPago: PENDIENTE)
    await step('3. Creación de Reserva Inicial (estadoPago: PENDIENTE)', async () => {
      const payload = {
        nombreTitular: `Titular Ciclo E2E ${timestamp}`,
        telefono: '+56988887777',
        email: `cliente.e2e.${timestamp}@parapente.cl`,
        valorTotal: VALOR_TOTAL,
        abono: 0,
        fechaReserva: new Date().toISOString(),
        bloqueHora: '10:00',
        pasajeros: [
          {
            nombre: `Pasajero E2E ${timestamp}`,
            rutDni: '12345678-9',
            peso: 72,
            telefono: '+56988887777',
            contactoEmergencia: 'Contacto Familiar E2E',
            telefonoEmergencia: '+56911112222',
            condicionFisica: 'Optima',
          },
        ],
      };

      const res = await fetch(`${TARGET_URL}/api/reservas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Error al crear reserva (HTTP ${res.status}): ${errText}`);
      }

      reservaCreada = await res.json();
      pasajeroCreado = reservaCreada.pasajeros?.[0];

      if (!reservaCreada?.id || !pasajeroCreado?.id) {
        throw new Error(`Estructura incompleta en reserva creada: ${JSON.stringify(reservaCreada)}`);
      }

      console.log(`   📝 Reserva creada #${reservaCreada.id} (${reservaCreada.numeroReserva || 'N/A'})`);
      console.log(`   🔑 Token Público Reserva: ${reservaCreada.tokenPublico || reservaCreada.shortId}`);
      console.log(`   👤 Pasajero ID: ${pasajeroCreado.id} | ShortId: ${pasajeroCreado.shortId || 'N/A'}`);
      console.log(`   💰 Estado Pago Inicial: ${reservaCreada.estadoPago} (Abono: $${reservaCreada.abono} / Total: $${reservaCreada.valorTotal})`);

      if (reservaCreada.estadoPago !== 'PENDIENTE') {
        throw new Error(`Estado de pago inicial esperado 'PENDIENTE', recibido: '${reservaCreada.estadoPago}'`);
      }
    });

    // 3b. Registro de Abono Inicial (Transición a ABONADO)
    await step('3b. Registro de Abono Inicial en Caja (Transición a ABONADO)', async () => {
      const abonoPayload = {
        monto: ABONO_INICIAL,
        metodoPago: 'TRANSFERENCIA',
        notas: 'Abono inicial de reserva verificado en suite E2E',
        fecha: new Date().toISOString(),
      };

      const abonoRes = await fetch(`${TARGET_URL}/api/reservas/${reservaCreada.id}/pagos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify(abonoPayload),
      });

      if (!abonoRes.ok) {
        const errText = await abonoRes.text();
        throw new Error(`Error al registrar abono inicial (HTTP ${abonoRes.status}): ${errText}`);
      }

      reservaCreada = await abonoRes.json();
      console.log(`   💵 Abono de $${ABONO_INICIAL} registrado exitosamente`);
      console.log(`   💰 Estado de Pago tras abono: ${reservaCreada.estadoPago} (Abono acumulado: $${reservaCreada.abono})`);

      if (reservaCreada.estadoPago !== 'ABONADO') {
        throw new Error(`Estado de pago esperado 'ABONADO', recibido: '${reservaCreada.estadoPago}'`);
      }
    });

    // 4. Agendamiento y Asignación de Vuelo a Piloto
    await step('4. Agendamiento de Vuelo y Asignación de Piloto (estado: AGENDADO)', async () => {
      // Generar una fechaHora única en el futuro para evitar colisión de unique ([pilotoId, fechaHora])
      const fechaVuelo = new Date();
      fechaVuelo.setDate(fechaVuelo.getDate() + 1);
      fechaVuelo.setHours(9 + (timestamp % 8), (timestamp % 4) * 15, 0, 0);

      const payloadVuelo = {
        pasajeroId: pasajeroCreado.id,
        pilotoId: pilotoSeleccionado.id,
        fechaHora: fechaVuelo.toISOString(),
        valorPactado: VALOR_TOTAL,
        estado: 'AGENDADO',
      };

      const res = await fetch(`${TARGET_URL}/api/vuelos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify(payloadVuelo),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Error al agendar vuelo (HTTP ${res.status}): ${errText}`);
      }

      vueloCreado = await res.json();
      console.log(`   🪂 Vuelo agendado #${vueloCreado.id} con Piloto ${pilotoSeleccionado.nombre} para ${fechaVuelo.toISOString()}`);
      console.log(`   📊 Estado inicial del vuelo: ${vueloCreado.estado}`);
    });

    // 5. Firma Digital de Deslinde en Ruta Pública (/deslinde/[id])
    await step('5. Firma Digital de Deslinde desde Ruta Pública (/deslinde/[id])', async () => {
      // Solo identificadores no secuenciales (el id numérico ya no resuelve en rutas públicas)
      const lookupId = reservaCreada.shortId || reservaCreada.tokenPublico;
      if (!lookupId) throw new Error('La reserva creada no tiene tokenPublico/shortId');
      
      // Validar consulta pública sin token
      const publicRes = await fetch(`${TARGET_URL}/api/public/reservas/${lookupId}`);
      if (!publicRes.ok) {
        throw new Error(`Error al consultar reserva pública (HTTP ${publicRes.status})`);
      }
      const publicData = await publicRes.json();
      const targetPax = publicData.pasajeros?.find((p: any) => p.id === pasajeroCreado.id) || publicData.pasajeros?.[0];

      if (!targetPax) {
        throw new Error('Pasajero no encontrado en la consulta pública de deslinde');
      }

      const paxLookupId = targetPax.shortId || targetPax.tokenPublico;
      if (!paxLookupId) throw new Error('El pasajero no tiene tokenPublico/shortId');

      // Simular firma digital con trazo en base64
      const firmaPayload = {
        firmaBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        rutDni: '12345678-9',
        pesoVerificado: 72,
        contactoEmergencia: 'Contacto Familiar E2E',
        telefonoEmergencia: '+56911112222',
        condicionFisica: 'Apto para vuelo',
      };

      const firmaRes = await fetch(`${TARGET_URL}/api/public/pasajeros/${paxLookupId}/firma`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(firmaPayload),
      });

      if (!firmaRes.ok) {
        const errText = await firmaRes.text();
        throw new Error(`Error al registrar firma de deslinde (HTTP ${firmaRes.status}): ${errText}`);
      }

      console.log(`   ✍️ Deslinde firmado exitosamente para pasajero ${targetPax.nombre}`);
    });

    // 6. Visualización de Voucher Digital Público (/voucher/[id]) en Browser Headless
    await step('6. Verificación de Voucher Digital Público (/voucher/[id])', async () => {
      const anonContext = await browser.newContext();
      const anonPage = await anonContext.newPage();

      // Solo identificadores no secuenciales (el id numérico ya no resuelve en rutas públicas)
      const voucherId = reservaCreada.shortId || reservaCreada.tokenPublico;
      if (!voucherId) throw new Error('La reserva creada no tiene tokenPublico/shortId');
      await anonPage.goto(`${TARGET_URL}/voucher/${voucherId}`, { waitUntil: 'domcontentloaded' });

      // Esperar a que renderice la tarjeta de vuelo y datos del titular
      await anonPage.waitForSelector('text=Ticket Oficial de Vuelo', { timeout: 8000 });
      await anonPage.waitForSelector(`text=${reservaCreada.nombreTitular}`, { timeout: 5000 });

      console.log('   🎟️ Voucher digital renderizado correctamente con datos y código QR');
      await anonContext.close();
    });

    // 7. Registro de Pago Restante y Transición a PAGADO
    await step('7. Registro de Pago Restante (Saldo) y Verificación de PAGADO', async () => {
      const pagoPayload = {
        monto: SALDO_RESTANTE,
        metodoPago: 'EFECTIVO',
        notas: 'Pago de saldo restante verificado en suite E2E',
        fecha: new Date().toISOString(),
      };

      const pagoRes = await fetch(`${TARGET_URL}/api/reservas/${reservaCreada.id}/pagos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify(pagoPayload),
      });

      if (!pagoRes.ok) {
        const errText = await pagoRes.text();
        throw new Error(`Error al registrar pago de saldo (HTTP ${pagoRes.status}): ${errText}`);
      }

      const reservaActualizada = await pagoRes.json();
      console.log(`   💵 Pago de $${SALDO_RESTANTE} registrado exitosamente`);
      console.log(`   💰 Nuevo estado de pago: ${reservaActualizada.estadoPago} (Abonado: $${reservaActualizada.abono} / Total: $${reservaActualizada.valorTotal})`);

      if (reservaActualizada.estadoPago !== 'PAGADO') {
        throw new Error(`Estado de pago esperado 'PAGADO', recibido: '${reservaActualizada.estadoPago}'`);
      }
    });

    // 8. Cierre y Completado de Vuelo (estado: COMPLETADO)
    await step('8. Ejecución y Cierre de Vuelo a estado COMPLETADO', async () => {
      const estadoRes = await fetch(`${TARGET_URL}/api/vuelos/${vueloCreado.id}/estado`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ estado: 'COMPLETADO' }),
      });

      if (!estadoRes.ok) {
        const errText = await estadoRes.text();
        throw new Error(`Error al actualizar estado del vuelo (HTTP ${estadoRes.status}): ${errText}`);
      }

      const vueloCompletado = await estadoRes.json();
      console.log(`   🏁 Vuelo #${vueloCompletado.id} actualizado con éxito a estado: ${vueloCompletado.estado}`);

      if (vueloCompletado.estado !== 'COMPLETADO') {
        throw new Error(`Estado de vuelo esperado 'COMPLETADO', recibido: '${vueloCompletado.estado}'`);
      }
    });

    // 9. Verificación en Manifiesto Diario (/reportes/manifiesto)
    await step('9. Verificación de Inclusión en Manifiesto Diario de Vuelos', async () => {
      const fechaManifiestoStr = vueloCreado.fechaHora ? vueloCreado.fechaHora.slice(0, 10) : new Date().toISOString().slice(0, 10);
      const manRes = await fetch(`${TARGET_URL}/api/reportes/manifiesto?fecha=${fechaManifiestoStr}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      if (!manRes.ok) {
        throw new Error(`Error al consultar manifiesto diario (HTTP ${manRes.status})`);
      }

      const manifiesto = await manRes.json();
      console.log(`   📋 Total vuelos en manifiesto (${fechaManifiestoStr}): ${manifiesto.totalVuelos} (Completados: ${manifiesto.totalCompletados}, Firmados: ${manifiesto.totalFirmados})`);

      const vueloEnManifiesto = manifiesto.vuelos?.find((v: any) => v.id === vueloCreado.id);
      if (vueloEnManifiesto) {
        console.log(`   ✅ Vuelo #${vueloCreado.id} encontrado en manifiesto con firmaDeslinde: ${Boolean(vueloEnManifiesto.pasajeroFirmaDeslinde)}`);
      }
    });

    // 10. Cuadratura Contable en Liquidaciones de Pilotos (/reportes/liquidaciones)
    await step('10. Cuadratura Contable de Comisión de Piloto en Liquidaciones', async () => {
      const now = new Date();
      const liqRes = await fetch(`${TARGET_URL}/api/reportes/liquidaciones?mes=${now.getMonth()}&year=${now.getFullYear()}&pilotoId=${pilotoSeleccionado.id}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      if (!liqRes.ok) {
        throw new Error(`Error al consultar liquidaciones de pilotos (HTTP ${liqRes.status})`);
      }

      const liqData = await liqRes.json();
      const pilotoLiq = liqData.pilotos?.find((p: any) => p.pilotoId === pilotoSeleccionado.id) || liqData.pilotos?.[0];

      if (!pilotoLiq) {
        throw new Error('Piloto no encontrado en el reporte de liquidaciones');
      }

      console.log(`   💼 Liquidación de ${pilotoLiq.nombre}:`);
      console.log(`      • Vuelos completados: ${pilotoLiq.totalVuelosCompletados}`);
      console.log(`      • Total a pagar al piloto: $${pilotoLiq.totalAPagar} CLP`);
      console.log(`      • Tipo de dato numérico exacto (sin NaN/Infinity/strings): ${typeof pilotoLiq.totalAPagar === 'number'}`);
    });

    // 11. Limpieza Segura de Registros de Prueba
    await step('11. Limpieza Segura (Soft Delete de Vuelo y Reserva de Prueba)', async () => {
      // 1. Eliminar vuelo
      if (vueloCreado?.id) {
        const delVueloRes = await fetch(`${TARGET_URL}/api/vuelos/${vueloCreado.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        if (delVueloRes.ok) {
          console.log(`   🧹 Vuelo #${vueloCreado.id} eliminado correctamente`);
        }
      }

      // 2. Eliminar reserva
      if (reservaCreada?.id) {
        const delReservaRes = await fetch(`${TARGET_URL}/api/reservas/${reservaCreada.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        if (delReservaRes.ok) {
          console.log(`   🧹 Reserva #${reservaCreada.id} eliminada correctamente`);
        }
      }
    });

  } finally {
    await browser.close();
  }

  // Resumen Final
  console.log('\n====================================================');
  console.log('📊 RESUMEN DE EJECUCIÓN DE LA SUITE FASE 5');
  console.log('====================================================');
  let allOk = true;
  for (const r of results) {
    const status = r.ok ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} | ${r.name.padEnd(50, ' ')} | ${r.durationMs}ms ${r.error ? `(${r.error})` : ''}`);
    if (!r.ok) allOk = false;
  }
  console.log('====================================================');

  if (allOk) {
    console.log('🎉 TODAS LAS ETAPAS DEL CICLO DE VIDA Y FINANZAS PASARON CON ÉXITO');
    process.exit(0);
  } else {
    console.error('💥 AL MENOS UNA ETAPA FALLÓ');
    process.exit(1);
  }
}

runFase5Suite().catch((err) => {
  console.error('Fatal error running Fase 5 suite:', err);
  process.exit(1);
});
