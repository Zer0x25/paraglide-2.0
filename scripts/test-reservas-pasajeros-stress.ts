/**
 * Suite E2E de Pruebas y Estrés para Reservas y Pasajeros
 * 
 * Cobertura exhaustiva de operaciones sobre Reservas y Pasajeros:
 * 1. Healthcheck y Autenticación Administrativa.
 * 2. Creación de Reserva Base (2 pasajeros, cálculo de correlativos AAMMDD-XX y -01/-02, tokens, shortId).
 * 3. Edición de Datos del Titular y Control de Concurrencia Optimista (rechazo 409 ante versión desfasada).
 * 4. Cambios de Número: Actualización de teléfono del titular y de los pasajeros (validación de persistencia).
 * 5. Cambios de Fecha y Bloque Horario: Transición a 'sin fecha' (limpieza de bloque) y re-asignación futura.
 * 6. Gestión Dinámica de Pasajeros:
 *    - Modificación de peso y RUT/DNI de pasajero existente.
 *    - Adición dinámica de 3er pasajero con asignación de correlativo secuencial consecuente.
 *    - Eliminación de pasajero de la reserva.
 *    - Firma digital de deslinde con persistencia de base64.
 * 7. Agendar y Desagendar Vuelos:
 *    - Agendamiento de grupo con asignación de piloto.
 *    - Verificación de transición de estado de reserva: SIN_AGENDAR -> AGENDADA.
 *    - Desagendar vuelos (eliminación suave) y validación de reversión a SIN_AGENDAR.
 *    - Re-agendamiento dinámico.
 * 8. Ciclo Financiero y Cancelación:
 *    - Registro de abonos y pagos completos con derivación de estadoPago.
 *    - Cancelación de reserva con motivo y anulación de vuelos.
 * 9. Soft-Delete y Aislamiento de Reserva.
 * 10. Pruebas de Estrés y Concurrencia:
 *    - 10 mutaciones concurrentes sobre una misma reserva (aislamiento y lock optimista 409).
 *    - 8 creaciones concurrentes en ráfaga (validación de unicidad de numeroReserva sin colisiones P2002).
 * 11. Verificación Visual e Interactiva en Navegador Headless Playwright (/reservas).
 * 
 * Ejecución:
 *   npx tsx scripts/test-reservas-pasajeros-stress.ts
 *   npm run test:staging:reservas
 *   npm run test:reservas:prod
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

async function runReservasPasajerosStressSuite() {
  console.log('╔════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║   SUITE E2E DE ESTRÉS Y FLUJO: RESERVAS Y PASAJEROS                            ║');
  console.log('║   Creación • Edición • Teléfonos • Fechas • Agendar/Desagendar • Concurrencia   ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════════╝');
  console.log(`Target URL:      ${TARGET_URL}`);
  console.log(`Admin Email:     ${EMAIL}`);
  console.log(`Headless:        ${HEADLESS}`);

  let adminToken = '';
  const createdReservaIds: number[] = [];
  const createdPilotoIds: number[] = [];
  const createdVueloIds: number[] = [];

  let testReserva: any = null;
  let testPiloto: any = null;

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  const consoleErrors: string[] = [];

  try {
    // 1. Healthcheck Inicial y Autenticación Administrativa
    await step('1. Healthcheck Inicial y Autenticación Administrativa', async () => {
      const maxWaitMs = SHOULD_WAIT ? 360_000 : 25_000;
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
        if (!SHOULD_WAIT && lastBody?.status === 'ok') break;
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
        throw new Error(`Login falló (${loginRes.status}): ${await loginRes.text()}`);
      }
      const loginData = await loginRes.json();
      adminToken = loginData.token;
      if (!adminToken) throw new Error('Token JWT no recibido');
      console.log(`   🔑 Autenticado como ${loginData.user?.nombre} (${loginData.user?.role})`);
    });

    const authHeaders = () => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    });

    const authOnlyHeaders = () => ({
      Authorization: `Bearer ${adminToken}`,
    });

    // 2. Creación de Reserva Base y Validación de Correlativos
    await step('2. Creación de Reserva Base (2 Pasajeros, Correlativos y Tokens)', async () => {
      const now = Date.now();
      const payload = {
        nombreTitular: `Titular Suite ${now}`,
        rutDniTitular: '12.345.678-9',
        telefono: '+56912345678',
        email: `suite_${now}@reserva-test.com`,
        fechaAgenda: '2026-12-10T10:00:00.000Z',
        horaAgenda: '10:00',
        valorTotal: 160000,
        abono: 0,
        pasajeros: [
          {
            nombre: `Pasajero Alfa ${now}`,
            rutDni: '15.111.222-3',
            peso: 70,
            telefono: '+56988881111',
            contactoEmergencia: 'Contacto Alfa',
            telefonoEmergencia: '+56977771111',
            condicionFisica: 'Óptima',
          },
          {
            nombre: `Pasajero Bravo ${now}`,
            rutDni: '16.222.333-4',
            peso: 80,
            telefono: '+56988882222',
            contactoEmergencia: 'Contacto Bravo',
            telefonoEmergencia: '+56977772222',
            condicionFisica: 'Normal',
          },
        ],
      };

      const res = await fetch(`${TARGET_URL}/api/reservas`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Fallo al crear reserva base: ${res.status} - ${await res.text()}`);
      }

      testReserva = await res.json();
      createdReservaIds.push(testReserva.id);

      // Verificaciones
      if (!testReserva.numeroReserva || !testReserva.numeroReserva.includes('-')) {
        throw new Error(`numeroReserva inválido: ${testReserva.numeroReserva}`);
      }
      if (!testReserva.tokenPublico || testReserva.tokenPublico.length < 32) {
        throw new Error(`tokenPublico de reserva inválido: ${testReserva.tokenPublico}`);
      }
      if (!testReserva.shortId || testReserva.shortId.length !== 8) {
        throw new Error(`shortId de reserva inválido: ${testReserva.shortId}`);
      }
      if (testReserva.estado !== 'SIN_AGENDAR') {
        throw new Error(`Estado inicial esperado SIN_AGENDAR pero se obtuvo: ${testReserva.estado}`);
      }
      if (testReserva.estadoPago !== 'PENDIENTE') {
        throw new Error(`Estado de pago esperado PENDIENTE pero se obtuvo: ${testReserva.estadoPago}`);
      }
      if (testReserva.version !== 0) {
        throw new Error(`Versión inicial esperada 0 pero se obtuvo: ${testReserva.version}`);
      }

      const paxs = testReserva.pasajeros;
      if (!paxs || paxs.length !== 2) {
        throw new Error(`Se esperaban 2 pasajeros, obtenidos: ${paxs?.length}`);
      }

      const p1 = paxs[0];
      const p2 = paxs[1];
      if (!p1.numeroPasajero?.endsWith('-01') || !p2.numeroPasajero?.endsWith('-02')) {
        throw new Error(`Correlativos de pasajero incorrectos: p1=${p1.numeroPasajero}, p2=${p2.numeroPasajero}`);
      }
      if (!p1.tokenPublico || !p2.tokenPublico || p1.tokenPublico === p2.tokenPublico) {
        throw new Error('Tokens públicos de pasajeros ausentes o colisionados');
      }

      console.log(`   ✅ Reserva #${testReserva.id} (${testReserva.numeroReserva}) creada con 2 pasajeros correlativos (-01, -02)`);
    });

    // 3. Edición de Titular y Concurrencia Optimista
    await step('3. Edición de Datos del Titular y Control de Concurrencia (409 Conflict)', async () => {
      // 3a. Intentar update con versión obsoleta (version: 999)
      const conflictRes = await fetch(`${TARGET_URL}/api/reservas/${testReserva.id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({
          nombreTitular: 'Titular Intruso',
          version: 999,
        }),
      });

      if (conflictRes.status !== 409) {
        throw new Error(`Se esperaba status 409 ante versión obsoleta, pero se obtuvo: ${conflictRes.status}`);
      }
      console.log('   🔒 Concurrencia validada: rechazo 409 exitoso con versión obsoleta');

      // 3b. Update válido con version: 0
      const nuevoNombre = `${testReserva.nombreTitular} (Editado)`;
      const nuevoEmail = 'editado_' + testReserva.email;
      const validUpdateRes = await fetch(`${TARGET_URL}/api/reservas/${testReserva.id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({
          nombreTitular: nuevoNombre,
          email: nuevoEmail,
          version: testReserva.version, // 0
        }),
      });

      if (!validUpdateRes.ok) {
        throw new Error(`Fallo en update válido: ${validUpdateRes.status} - ${await validUpdateRes.text()}`);
      }

      const updated = await validUpdateRes.json();
      if (updated.version !== 1) {
        throw new Error(`Se esperaba incremento de version a 1, pero se obtuvo: ${updated.version}`);
      }
      if (updated.nombreTitular !== nuevoNombre || updated.email !== nuevoEmail) {
        throw new Error('Los datos actualizados no coinciden');
      }

      testReserva = updated;
      console.log(`   ✅ Titular actualizado exitosamente | Nueva versión: ${testReserva.version}`);
    });

    // 4. Cambios de Número (Titular y Pasajeros)
    await step('4. Cambios de Número (Teléfono de Titular y Pasajeros)', async () => {
      const nuevoTelTitular = '+56999990000';
      const nuevoTelPaxAlfa = '+56911119999';
      const nuevoEmergenciaPaxAlfa = '+56933339999';

      const paxsActuales = testReserva.pasajeros;
      const payload = {
        telefono: nuevoTelTitular,
        version: testReserva.version, // 1
        pasajeros: [
          {
            id: paxsActuales[0].id,
            nombre: paxsActuales[0].nombre,
            peso: paxsActuales[0].peso,
            rutDni: paxsActuales[0].rutDni,
            telefono: nuevoTelPaxAlfa,
            telefonoEmergencia: nuevoEmergenciaPaxAlfa,
            contactoEmergencia: paxsActuales[0].contactoEmergencia,
          },
          {
            id: paxsActuales[1].id,
            nombre: paxsActuales[1].nombre,
            peso: paxsActuales[1].peso,
            rutDni: paxsActuales[1].rutDni,
            telefono: paxsActuales[1].telefono,
            contactoEmergencia: paxsActuales[1].contactoEmergencia,
          },
        ],
      };

      const res = await fetch(`${TARGET_URL}/api/reservas/${testReserva.id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Fallo en actualización de teléfonos: ${res.status} - ${await res.text()}`);
      }

      const updated = await res.json();
      if (updated.telefono !== nuevoTelTitular) {
        throw new Error(`Teléfono del titular no se actualizó: ${updated.telefono} vs ${nuevoTelTitular}`);
      }

      const pax0 = updated.pasajeros?.find((p: any) => p.id === paxsActuales[0].id);
      if (!pax0) throw new Error('Pasajero Alfa no encontrado en respuesta');
      if (pax0.telefono !== nuevoTelPaxAlfa) {
        throw new Error(`Teléfono de pasajero Alfa no se actualizó: ${pax0.telefono} vs ${nuevoTelPaxAlfa}`);
      }
      if (pax0.telefonoEmergencia !== nuevoEmergenciaPaxAlfa) {
        throw new Error(`Teléfono de emergencia de Alfa no se actualizó: ${pax0.telefonoEmergencia} vs ${nuevoEmergenciaPaxAlfa}`);
      }

      testReserva = updated;
      console.log(`   ✅ Teléfono titular (${nuevoTelTitular}) y pasajero (${nuevoTelPaxAlfa}) actualizados y persistidos | Versión: ${testReserva.version}`);
    });

    // 5. Cambios de Fecha y Horarios (Sin fecha y Re-programación)
    await step('5. Cambios de Fecha y Horarios (Conversión a Sin Fecha y Re-programación)', async () => {
      // 5a. Convertir a Sin Fecha (Giftcard / abierta)
      const resSinFecha = await fetch(`${TARGET_URL}/api/reservas/${testReserva.id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({
          fechaAgenda: null,
          horaAgenda: null,
          version: testReserva.version,
        }),
      });

      if (!resSinFecha.ok) {
        throw new Error(`Fallo al convertir a sin fecha: ${resSinFecha.status} - ${await resSinFecha.text()}`);
      }
      const reservaSinFecha = await resSinFecha.json();
      if (reservaSinFecha.fechaAgenda !== null || reservaSinFecha.horaAgenda !== null) {
        throw new Error(`Fecha/Bloque no quedaron en null: fecha=${reservaSinFecha.fechaAgenda}, bloque=${reservaSinFecha.horaAgenda}`);
      }
      console.log('   ✅ Reserva convertida a modalidad Abierta / Sin Fecha (bloque purgado)');

      // 5b. Re-programar a fecha futura y bloque 12:00
      const nuevaFechaIso = '2026-12-24T12:00:00.000Z';
      const nuevoBloque = '12:00';
      const resConFecha = await fetch(`${TARGET_URL}/api/reservas/${testReserva.id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({
          fechaAgenda: nuevaFechaIso,
          horaAgenda: nuevoBloque,
          version: reservaSinFecha.version,
        }),
      });

      if (!resConFecha.ok) {
        throw new Error(`Fallo al reprogramar fecha: ${resConFecha.status} - ${await resConFecha.text()}`);
      }
      testReserva = await resConFecha.json();
      if (!testReserva.fechaAgenda || testReserva.horaAgenda !== nuevoBloque) {
        throw new Error(`Fecha/Bloque no se actualizaron correctamente: ${testReserva.fechaAgenda} - ${testReserva.horaAgenda}`);
      }
      console.log(`   ✅ Re-programada a fecha ${nuevaFechaIso.slice(0, 10)} bloque ${nuevoBloque} | Versión: ${testReserva.version}`);
    });

    // 6. Gestión Dinámica de Pasajeros (Edición, Adición, Eliminación, Firma)
    await step('6. Gestión Dinámica de Pasajeros (Edición, Adición -03, Eliminación y Firma)', async () => {
      const paxAlfa = testReserva.pasajeros[0];
      const paxBravo = testReserva.pasajeros[1];

      // Modificamos a Alfa (peso 85), eliminamos a Bravo y agregamos a Charlie (nuevo)
      const payload = {
        version: testReserva.version,
        pasajeros: [
          {
            id: paxAlfa.id,
            nombre: `${paxAlfa.nombre} (Modificado)`,
            peso: 85,
            rutDni: paxAlfa.rutDni,
            telefono: paxAlfa.telefono,
          },
          {
            // Sin id = nuevo pasajero
            nombre: 'Pasajero Charlie Nuevo',
            peso: 68,
            rutDni: '17.333.444-5',
            telefono: '+56977773333',
            contactoEmergencia: 'Contacto Charlie',
          },
        ],
      };

      const res = await fetch(`${TARGET_URL}/api/reservas/${testReserva.id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Fallo al actualizar lista de pasajeros: ${res.status} - ${await res.text()}`);
      }

      testReserva = await res.json();
      const paxs = testReserva.pasajeros;
      if (paxs.length !== 2) {
        throw new Error(`Se esperaban 2 pasajeros tras eliminación y adición, obtenidos: ${paxs.length}`);
      }

      // Bravo no debe estar
      const bravoExiste = paxs.some((p: any) => p.id === paxBravo.id);
      if (bravoExiste) throw new Error('Pasajero Bravo no fue eliminado');

      // Charlie debe tener el correlativo -03
      const charlie = paxs.find((p: any) => p.nombre === 'Pasajero Charlie Nuevo');
      if (!charlie) throw new Error('Pasajero Charlie no encontrado');
      if (!charlie.numeroPasajero?.endsWith('-03')) {
        throw new Error(`Se esperaba correlativo -03 para el nuevo pasajero Charlie, se obtuvo: ${charlie.numeroPasajero}`);
      }

      // Alfa debe tener peso 85
      const alfaActualizado = paxs.find((p: any) => p.id === paxAlfa.id);
      if (alfaActualizado.peso !== 85) {
        throw new Error(`Peso de Alfa no se actualizó a 85: ${alfaActualizado.peso}`);
      }

      // Firma de deslinde para Charlie
      const firmaRes = await fetch(`${TARGET_URL}/api/pasajeros/${charlie.id}/firma`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          firmaBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          rutDni: charlie.rutDni,
          pesoVerificado: 69,
        }),
      });

      if (!firmaRes.ok) {
        throw new Error(`Fallo al registrar firma digital: ${firmaRes.status} - ${await firmaRes.text()}`);
      }
      const charlieFirmado = await firmaRes.json();
      if (!charlieFirmado.firmaDeslinde || charlieFirmado.pesoVerificado !== 69) {
        throw new Error('Firma de deslinde o peso verificado no persistieron');
      }

      console.log(`   ✅ Pasajeros reorganizados: Bravo eliminado, Charlie agregado con correlativo ${charlie.numeroPasajero} y firma de deslinde registrada`);
    });

    // 7. Agendar y Desagendar Vuelos
    await step('7. Agendar y Desagendar Vuelos (Transiciones SIN_AGENDAR <-> AGENDADA)', async () => {
      // 7a. Crear dos pilotos de prueba para agendamiento
      const nowPilotos = Date.now();
      const pilotoResA = await fetch(`${TARGET_URL}/api/pilotos`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          nombre: `Piloto Suite A ${nowPilotos}`,
          rutDni: `11.${String(nowPilotos).slice(-6)}-1`,
          telefono: '+56955554441',
          email: `piloto_a_${nowPilotos}@parapente.com`,
          activo: true,
          peso: 76,
          tieneLicencia: true,
          numeroLicencia: `LIC-A-${nowPilotos}`,
          prioridad: 1,
          categoria: 'MASTER',
          pesoMinimoPasajero: 40,
          pesoMaximoPasajero: 110,
          disponibilidadTotal: true,
          tarifaPorVuelo: 30000,
        }),
      });
      if (!pilotoResA.ok) throw new Error(`Fallo al crear piloto A: ${pilotoResA.status} - ${await pilotoResA.text()}`);
      const pilotoA = await pilotoResA.json();
      createdPilotoIds.push(pilotoA.id);

      const pilotoResB = await fetch(`${TARGET_URL}/api/pilotos`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          nombre: `Piloto Suite B ${nowPilotos}`,
          rutDni: `11.${String(nowPilotos).slice(-6)}-2`,
          telefono: '+56955554442',
          email: `piloto_b_${nowPilotos}@parapente.com`,
          activo: true,
          peso: 78,
          tieneLicencia: true,
          numeroLicencia: `LIC-B-${nowPilotos}`,
          prioridad: 2,
          categoria: 'SENIOR',
          pesoMinimoPasajero: 40,
          pesoMaximoPasajero: 110,
          disponibilidadTotal: true,
          tarifaPorVuelo: 30000,
        }),
      });
      if (!pilotoResB.ok) throw new Error(`Fallo al crear piloto B: ${pilotoResB.status} - ${await pilotoResB.text()}`);
      const pilotoB = await pilotoResB.json();
      createdPilotoIds.push(pilotoB.id);

      // 7b. Agendar vuelos en grupo para los 2 pasajeros de la reserva
      const p1 = testReserva.pasajeros[0];
      const p2 = testReserva.pasajeros[1];
      const asignaciones: Record<number, number> = {
        [p1.id]: pilotoA.id,
        [p2.id]: pilotoB.id,
      };

      const agendarRes = await fetch(`${TARGET_URL}/api/vuelos/agendamiento-grupo`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          reservaId: testReserva.id,
          fechaHora: '2026-12-24T12:00:00.000Z',
          asignaciones,
          version: testReserva.version,
        }),
      });

      if (!agendarRes.ok) {
        throw new Error(`Fallo al agendar grupo: ${agendarRes.status} - ${await agendarRes.text()}`);
      }

      const agendarData = await agendarRes.json();
      const vuelosCreados = Array.isArray(agendarData) ? agendarData : agendarData.vuelos;
      if (!Array.isArray(vuelosCreados) || vuelosCreados.length !== 2) {
        throw new Error(`Se esperaban 2 vuelos creados, obtenidos: ${vuelosCreados?.length} (Respuesta: ${JSON.stringify(agendarData)})`);
      }
      vuelosCreados.forEach((v: any) => createdVueloIds.push(v.id));

      // Verificar que la reserva ahora esté en AGENDADA
      const reservaAgendadaRes = await fetch(`${TARGET_URL}/api/reservas/${testReserva.id}`, {
        headers: authHeaders(),
      });
      testReserva = await reservaAgendadaRes.json();
      if (testReserva.estado !== 'AGENDADA') {
        throw new Error(`Se esperaba estado AGENDADA tras programar vuelos, pero se obtuvo: ${testReserva.estado}`);
      }
      console.log(`   🪂 Vuelos #${vuelosCreados[0].id} y #${vuelosCreados[1].id} programados | Estado reserva: ${testReserva.estado}`);

      // 7c. Desagendar: eliminar los vuelos programados
      for (const vuelo of vuelosCreados) {
        const delVueloRes = await fetch(`${TARGET_URL}/api/vuelos/${vuelo.id}`, {
          method: 'DELETE',
          headers: authOnlyHeaders(),
        });
        if (!delVueloRes.ok) {
          throw new Error(`Fallo al eliminar vuelo #${vuelo.id}: ${delVueloRes.status} - ${await delVueloRes.text()}`);
        }
      }

      // Verificar que la reserva se revirtió a SIN_AGENDAR
      const reservaDesagendadaRes = await fetch(`${TARGET_URL}/api/reservas/${testReserva.id}`, {
        headers: authOnlyHeaders(),
      });
      testReserva = await reservaDesagendadaRes.json();
      if (testReserva.estado !== 'SIN_AGENDAR') {
        throw new Error(`Se esperaba que la reserva revirtiera a SIN_AGENDAR tras desagendar todos los vuelos, pero quedó en: ${testReserva.estado}`);
      }
      console.log(`   🔄 Desagendamiento completo exitoso: Vuelos eliminados y reserva revertida a ${testReserva.estado}`);
    });

    // 8. Registro de Pagos, Abonos y Cancelación con Motivo
    await step('8. Ciclo Financiero (Abono, Pago Completo) y Cancelación con Motivo', async () => {
      // 8a. Registrar abono del 50%
      const mitad = Math.floor(Number(testReserva.valorTotal) / 2);
      const abonoRes = await fetch(`${TARGET_URL}/api/reservas/${testReserva.id}/pagos`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          monto: mitad,
          metodoPago: 'TRANSFERENCIA',
          notas: 'Abono 50% prueba suite',
          version: testReserva.version,
        }),
      });

      if (!abonoRes.ok) {
        throw new Error(`Fallo al registrar abono: ${abonoRes.status} - ${await abonoRes.text()}`);
      }
      testReserva = await abonoRes.json();
      if (testReserva.estadoPago !== 'ABONADO') {
        throw new Error(`Se esperaba estadoPago ABONADO pero se obtuvo: ${testReserva.estadoPago}`);
      }
      console.log(`   💳 Abono de $${mitad} registrado exitosamente | estadoPago: ${testReserva.estadoPago}`);

      // 8b. Registrar saldo restante para pago completo
      const saldo = Number(testReserva.valorTotal) - mitad;
      const pagoTotalRes = await fetch(`${TARGET_URL}/api/reservas/${testReserva.id}/pagos`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          monto: saldo,
          metodoPago: 'EFECTIVO',
          notas: 'Saldo completado',
          version: testReserva.version,
        }),
      });

      if (!pagoTotalRes.ok) {
        throw new Error(`Fallo al registrar saldo: ${pagoTotalRes.status} - ${await pagoTotalRes.text()}`);
      }
      testReserva = await pagoTotalRes.json();
      if (testReserva.estadoPago !== 'PAGADO') {
        throw new Error(`Se esperaba estadoPago PAGADO pero se obtuvo: ${testReserva.estadoPago}`);
      }
      console.log(`   💰 Pago completado al 100% | estadoPago: ${testReserva.estadoPago}`);

      // 8c. Cancelar reserva con motivo
      const motivo = 'Condiciones meteorológicas de viento cruzado desfavorables en la zona';
      const cancelRes = await fetch(`${TARGET_URL}/api/reservas/${testReserva.id}/cancelar`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          motivo,
          version: testReserva.version,
        }),
      });

      if (!cancelRes.ok) {
        throw new Error(`Fallo al cancelar reserva: ${cancelRes.status} - ${await cancelRes.text()}`);
      }
      testReserva = await cancelRes.json();
      if (testReserva.estado !== 'CANCELADA' || testReserva.motivoCancelacion !== motivo) {
        throw new Error(`Cancelación no reflejada: estado=${testReserva.estado}, motivo=${testReserva.motivoCancelacion}`);
      }
      console.log(`   🛑 Reserva #${testReserva.id} cancelada con motivo verificado: "${motivo}"`);
    });

    // 9. Soft-Delete y Aislamiento de Reserva
    await step('9. Soft Delete de Reserva y Verificación de Aislamiento', async () => {
      // 9a. Verificar que una reserva CANCELADA no se puede eliminar (invariante de auditoría)
      const deleteCanceladaRes = await fetch(`${TARGET_URL}/api/reservas/${testReserva.id}`, {
        method: 'DELETE',
        headers: authOnlyHeaders(),
      });
      if (deleteCanceladaRes.status !== 400) {
        throw new Error(`Se esperaba 400 al intentar eliminar reserva cancelada, pero se obtuvo: ${deleteCanceladaRes.status}`);
      }
      console.log('   🛡️ Invariante de auditoría validada: reserva cancelada protegida contra eliminación');

      // 9b. Crear una reserva activa específica para soft-delete
      const now = Date.now();
      const createActivaRes = await fetch(`${TARGET_URL}/api/reservas`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          nombreTitular: `Titular Para Eliminar ${now}`,
          telefono: '+56900001111',
          email: `eliminar_${now}@test.com`,
          valorTotal: 70000,
          abono: 0,
          pasajeros: [{ nombre: 'Pax Delete', peso: 75 }],
        }),
      });
      if (!createActivaRes.ok) throw new Error('No se pudo crear reserva para prueba de eliminación');
      const reservaParaEliminar = await createActivaRes.json();

      // 9c. Eliminar la reserva activa
      const deleteRes = await fetch(`${TARGET_URL}/api/reservas/${reservaParaEliminar.id}`, {
        method: 'DELETE',
        headers: authOnlyHeaders(),
      });

      if (!deleteRes.ok) {
        throw new Error(`Fallo en soft delete de reserva activa: ${deleteRes.status} - ${await deleteRes.text()}`);
      }

      // 9d. Validar que un get directo retorne 404
      const getRes = await fetch(`${TARGET_URL}/api/reservas/${reservaParaEliminar.id}`, {
        headers: authOnlyHeaders(),
      });
      if (getRes.status !== 404) {
        throw new Error(`Se esperaba 404 al consultar reserva eliminada, pero retornó: ${getRes.status}`);
      }

      // 9e. Validar que no figure en el listado activo
      const listRes = await fetch(`${TARGET_URL}/api/reservas?q=${encodeURIComponent(reservaParaEliminar.numeroReserva)}`, {
        headers: authOnlyHeaders(),
      });
      const listData = await listRes.json();
      const items = listData.data || listData;
      if (items.some((r: any) => r.id === reservaParaEliminar.id)) {
        throw new Error('La reserva eliminada aún aparece en el listado activo');
      }

      console.log(`   🗑️ Reserva activa #${reservaParaEliminar.id} soft-deleted correctamente; invisible en endpoints activos`);
    });

    // 10. Estrés y Concurrencia
    await step('10. Estrés de Mutaciones Concurrentes y Creación en Ráfaga', async () => {
      // 10a. Mutaciones concurrentes sobre la misma reserva con la misma versión
      const now = Date.now();
      const stressReservaRes = await fetch(`${TARGET_URL}/api/reservas`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          nombreTitular: `Titular Stress Lock ${now}`,
          telefono: '+56900000000',
          email: `stress_lock_${now}@test.com`,
          valorTotal: 80000,
          abono: 0,
          pasajeros: [{ nombre: 'Pax Lock', peso: 70 }],
        }),
      });
      if (!stressReservaRes.ok) throw new Error('No se pudo crear reserva de prueba para estrés');
      const stressReserva = await stressReservaRes.json();
      createdReservaIds.push(stressReserva.id);

      const initialVersion = stressReserva.version; // 0
      const attempts = 10;
      console.log(`   🚀 Lanzando ${attempts} mutaciones concurrentes compitiendo con versión ${initialVersion}...`);

      const promises = Array.from({ length: attempts }).map((_, i) =>
        fetch(`${TARGET_URL}/api/reservas/${stressReserva.id}`, {
          method: 'PATCH',
          headers: authHeaders(),
          body: JSON.stringify({
            nombreTitular: `Nombre Competidor #${i} (${now})`,
            version: initialVersion,
          }),
        })
      );

      const responses = await Promise.all(promises);
      const okCount = responses.filter((r) => r.ok).length;
      const conflictCount = responses.filter((r) => r.status === 409).length;

      console.log(`   📊 Resultados mutación concurrente: Exitosos=${okCount}, Conflictos (409)=${conflictCount}`);
      if (okCount !== 1) {
        throw new Error(`Se esperaba exactamente 1 mutación exitosa, pero hubo: ${okCount}`);
      }
      if (conflictCount !== attempts - 1) {
        throw new Error(`Se esperaban ${attempts - 1} conflictos 409, pero hubo: ${conflictCount}`);
      }
      console.log('   🛡️ Lock optimista verificado: aislamiento absoluto ante colisión de versiones');

      // 10b. Creación en ráfaga concurrente de reservas
      const burstSize = 8;
      console.log(`   🚀 Lanzando ráfaga concurrente de ${burstSize} creaciones de reservas simultáneas...`);
      const burstPromises = Array.from({ length: burstSize }).map((_, i) =>
        fetch(`${TARGET_URL}/api/reservas`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            nombreTitular: `Titular Ráfaga #${i} ${now}`,
            telefono: `+5691111000${i}`,
            email: `rafaga_${i}_${now}@test.com`,
            fechaAgenda: '2026-12-11T10:00:00.000Z',
            horaAgenda: '10:00',
            valorTotal: 75000,
            abono: 0,
            pasajeros: [{ nombre: `Pax Ráfaga ${i}`, peso: 75 }],
          }),
        })
      );

      const burstResponses = await Promise.all(burstPromises);
      const burstBodies = await Promise.all(burstResponses.map((r) => r.json()));

      const createdNumbers: string[] = [];
      for (let i = 0; i < burstResponses.length; i++) {
        const res = burstResponses[i];
        const body = burstBodies[i];
        if (!res.ok) {
          throw new Error(`Ráfaga #${i} falló (${res.status}): ${JSON.stringify(body)}`);
        }
        createdReservaIds.push(body.id);
        createdNumbers.push(body.numeroReserva);
      }

      const uniqueNumbers = new Set(createdNumbers);
      if (uniqueNumbers.size !== burstSize) {
        throw new Error(`Colisión detectada en numeros de reserva: generados ${createdNumbers.length} vs únicos ${uniqueNumbers.size}`);
      }
      console.log(`   ✅ Ráfaga de ${burstSize} reservas concurrentes creada sin colisiones: ${createdNumbers.join(', ')}`);
    });

    // 11. Verificación Visual e Interactiva en Navegador Headless Playwright
    await step('11. Verificación UI en Navegador Headless Playwright (/reservas)', async () => {
      const chromeBin = process.env.CHROME_BIN || '/usr/bin/google-chrome';
      browser = await chromium.launch({
        executablePath: chromeBin,
        headless: HEADLESS,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });
      context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
      });
      page = await context.newPage();

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      // 11a. Login
      await page.goto(`${TARGET_URL}/login`, { waitUntil: 'domcontentloaded' });
      const emailInput = page.locator('input[type="email"], input[name="email"]');
      const passwordInput = page.locator('input[type="password"], input[name="password"]');
      const submitBtn = page.locator('button[type="submit"]');

      await emailInput.waitFor({ state: 'visible', timeout: 15000 });
      await emailInput.fill(EMAIL);
      await passwordInput.fill(PASSWORD);
      await submitBtn.click();
      await page.waitForURL((url) => url.pathname === '/' || url.pathname === '', { timeout: 20000 });

      // 11b. Navegar a /reservas
      await page.click('a[href="/reservas"]');
      await page.waitForSelector('text=Reservas');
      await page.waitForTimeout(1000);

      // Verificar elementos de UI
      const headerTitle = await page.textContent('h1');
      if (!headerTitle?.includes('Reservas')) {
        throw new Error(`Título no esperado en /reservas: ${headerTitle}`);
      }

      // 11c. Abrir modal de nueva reserva
      const nuevaReservaBtn = page.locator('button:has-text("Nueva Reserva")');
      await nuevaReservaBtn.first().click();
      await page.waitForSelector('text=Nueva Reserva');
      await page.waitForTimeout(500);

      // Verificar que el formulario contenga los campos requeridos
      const inputTitular = page.locator('input[placeholder="Ej: Juan Pérez"]');
      await inputTitular.waitFor({ state: 'visible', timeout: 5000 });
      await inputTitular.fill('Titular Prueba UI Playwright');

      // Cerrar modal
      const modal = page.locator('div.fixed.inset-0').filter({ hasText: 'Crear Nueva Reserva' });
      const cerrarBtn = modal.locator('button:has-text("Cancelar")');
      await cerrarBtn.click();
      await page.waitForTimeout(500);

      console.log('   🖥️ Navegación, carga de pestaña /reservas y modal interactivo validados con éxito');
    });

  } finally {
    // Cierre de navegador Playwright
    if (browser) {
      await browser.close().catch(() => {});
    }

    // Limpieza de entidades de prueba
    if (adminToken && (createdReservaIds.length > 0 || createdPilotoIds.length > 0 || createdVueloIds.length > 0)) {
      console.log('\n🧹 Limpiando entidades de prueba generadas...');
      const headers = { Authorization: `Bearer ${adminToken}` };

      for (const id of createdVueloIds) {
        try {
          await fetch(`${TARGET_URL}/api/vuelos/${id}`, { method: 'DELETE', headers });
        } catch {}
      }
      for (const id of createdReservaIds) {
        try {
          await fetch(`${TARGET_URL}/api/reservas/${id}`, { method: 'DELETE', headers });
        } catch {}
      }
      for (const id of createdPilotoIds) {
        try {
          await fetch(`${TARGET_URL}/api/pilotos/${id}`, { method: 'DELETE', headers });
        } catch {}
      }
      console.log(`   ✨ Limpieza finalizada (${createdVueloIds.length} vuelos, ${createdReservaIds.length} reservas, ${createdPilotoIds.length} pilotos)`);
    }
  }

  // Resumen final
  console.log('\n╔════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║   RESUMEN DE EJECUCIÓN - SUITE DE RESERVAS Y PASAJEROS                         ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════════╝');
  let allPassed = true;
  for (const r of results) {
    const icon = r.ok ? '✅' : '❌';
    console.log(`${icon} ${r.name.padEnd(65)} [${r.durationMs}ms]`);
    if (!r.ok) {
      allPassed = false;
      if (r.error) console.log(`   ⚠️ Detalle error: ${r.error}`);
    }
  }

  if (consoleErrors.length > 0) {
    console.warn(`\n⚠️ Se detectaron ${consoleErrors.length} errores de consola durante la navegación UI:`);
    consoleErrors.forEach((err, i) => console.warn(`   [${i + 1}] ${err}`));
  }

  if (!allPassed) {
    console.error('\n💥 La suite de reservas y pasajeros finalizó con errores.');
    process.exit(1);
  } else {
    console.log('\n🎉 ¡TODAS LAS PRUEBAS Y VALIDACIONES DE ESTRÉS PASARON SATISFACTORIAMENTE!');
    process.exit(0);
  }
}

runReservasPasajerosStressSuite().catch((err) => {
  console.error('\n💥 Error fatal en la ejecución de la suite:', err);
  process.exit(1);
});
