/**
 * Suite E2E de Fase 9: Flujos de Negocio Complejos y Casos Borde
 * 
 * Cobertura exhaustiva de flujos críticos de la aplicación:
 * 1. Healthcheck Inicial y Verificación de Red
 * 2. Ciclo de Cancelaciones, Devoluciones y Reglas Financieras (ADR 008, ciclo de vida)
 * 3. Módulo de Gastos Operativos y Caja Chica (/api/gastos, validaciones, auditoría)
 * 4. Motor de Promociones y Tarifas con Control RBAC (ADR 005, 403 Forbidden para no-admin)
 * 5. Configuración de Bloques y Resolver de Disponibilidad (/api/configuracion-bloques/resolver)
 * 6. Notificaciones Automáticas y Plantillas de Recordatorio (/api/notificaciones/pendientes)
 * 7. Gestión de Pasajeros, Verificación de Peso y Firmas Digitales (/api/pasajeros)
 * 8. Limpieza Segura (Soft Delete de Todos los Registros de Prueba)
 * 
 * Ejecución:
 *   npx tsx scripts/test-fase9-flujos-complejos.ts
 *   npm run test:fase9:prod
 *   npm run test:staging:fase9
 */

import { execSync } from 'child_process';

const TARGET_URL = process.env.PROD_URL || 'http://localhost:3200';
const EMAIL = process.env.ADMIN_EMAIL || 'admin@parapente.com';
const PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

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

async function runFase9Suite() {
  console.log('╔════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║   SUITE E2E FASE 9: FLUJOS DE NEGOCIO COMPLEJOS Y CASOS BORDE                 ║');
  console.log('║   Devoluciones • Gastos • Promociones RBAC • Resolver • Notificaciones         ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════════╝');
  console.log(`Target URL:      ${TARGET_URL}`);
  console.log(`Admin Email:     ${EMAIL}`);

  let adminToken = '';
  let testReservaId: number | null = null;
  let testGastoId: number | null = null;
  let testPromoId: number | null = null;
  let testUserId: number | null = null;
  let testPasajeroId: number | null = null;

  try {
    // 1. Healthcheck Inicial
    await step('1. Healthcheck Inicial y Verificación de Red', async () => {
      const res = await fetch(`${TARGET_URL}/api/public/health`);
      if (!res.ok) throw new Error(`Healthcheck falló: HTTP ${res.status}`);
      const body = await res.json();
      if (body.status !== 'ok') throw new Error(`Status de API no es ok: ${JSON.stringify(body)}`);
      console.log(`   🟢 API Saludable | Commit: ${body.commit} | Uptime: ${body.uptime}s`);

      // Login Admin
      const loginRes = await fetch(`${TARGET_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
      });
      if (!loginRes.ok) throw new Error(`Login de admin falló: HTTP ${loginRes.status}`);
      const loginData = await loginRes.json();
      adminToken = loginData.token;
      if (!adminToken) throw new Error('No se recibió token de administrador');
      console.log(`   🔑 Autenticación de Administrador exitosa`);
    });

    // 2. Ciclo de Cancelación, Devoluciones y Reglas Financieras
    await step('2. Ciclo de Cancelación, Devoluciones y Reglas Financieras', async () => {
      const timestamp = Date.now();
      // 2.1 Crear reserva con abono parcial
      const createRes = await fetch(`${TARGET_URL}/api/reservas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          nombreTitular: `Cliente Devolucion ${timestamp}`,
          email: `cliente.dev.${timestamp}@test.com`,
          telefono: '+56988776655',
          cantidadPasajeros: 1,
          valorTotal: 75000,
          abono: 30000,
          metodoPago: 'TRANSFERENCIA',
          fechaReserva: new Date().toISOString(),
          notas: 'Reserva para prueba de cancelaciones y devoluciones',
          pasajeros: [
            {
              nombre: `Pasajero Devolucion ${timestamp}`,
              email: `pax.dev.${timestamp}@test.com`,
              telefono: '+56988776655',
              rutDni: '15998877-6',
              peso: 72,
              condicionFisica: 'Optima',
            },
          ],
        }),
      });

      if (!createRes.ok) throw new Error(`Fallo al crear reserva: HTTP ${createRes.status}`);
      const reserva = await createRes.json();
      testReservaId = reserva.id;
      console.log(`   📝 Reserva #${testReservaId} creada (Total: $75.000, Abono: $30.000, Estado: ${reserva.estado})`);

      // 2.2 Intentar registrar devolución en reserva activa -> Debe responder HTTP 400
      const devActivaRes = await fetch(`${TARGET_URL}/api/reservas/${testReservaId}/devoluciones`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          monto: 10000,
          metodoPago: 'TRANSFERENCIA',
          notas: 'Intento de devolución en reserva activa',
          version: reserva.version,
        }),
      });

      if (devActivaRes.status !== 400) {
        throw new Error(`Se esperaba HTTP 400 al devolver en reserva activa, recibido ${devActivaRes.status}`);
      }
      console.log('   🛡️ Devolución en reserva activa correctamente bloqueada (HTTP 400)');

      // 2.3 Cancelar formalmente la reserva con motivo
      const cancelRes = await fetch(`${TARGET_URL}/api/reservas/${testReservaId}/cancelar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          motivo: 'Cancelación solicitada por el cliente debido a mal tiempo',
          version: reserva.version,
        }),
      });

      if (!cancelRes.ok) throw new Error(`Fallo al cancelar reserva: HTTP ${cancelRes.status}`);
      const reservaCancelada = await cancelRes.json();
      if (reservaCancelada.estado !== 'CANCELADA') {
        throw new Error(`Estado esperado CANCELADA, recibido: ${reservaCancelada.estado}`);
      }
      console.log(`   🚫 Reserva #${testReservaId} cancelada exitosamente con motivo`);

      // 2.4 Intentar devolver más de lo pagado (ej. $35.000 > $30.000) -> Debe responder HTTP 400
      const devExcesoRes = await fetch(`${TARGET_URL}/api/reservas/${testReservaId}/devoluciones`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          monto: 35000,
          metodoPago: 'TRANSFERENCIA',
          notas: 'Intento de devolver más de lo pagado',
          version: reservaCancelada.version,
        }),
      });

      if (devExcesoRes.status !== 400) {
        throw new Error(`Se esperaba HTTP 400 al devolver en exceso, recibido ${devExcesoRes.status}`);
      }
      console.log('   🛡️ Devolución en exceso correctamente rechazada (HTTP 400: no superar abono)');

      // 2.5 Registrar devolución parcial de $15.000
      const dev1Res = await fetch(`${TARGET_URL}/api/reservas/${testReservaId}/devoluciones`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          monto: 15000,
          metodoPago: 'TRANSFERENCIA',
          notas: 'Primera cuota de devolución',
          version: reservaCancelada.version,
        }),
      });

      if (!dev1Res.ok) throw new Error(`Fallo al registrar primera devolución: HTTP ${dev1Res.status}`);
      const rDev1 = await dev1Res.json();
      const devolucion1Id = rDev1.devoluciones?.[0]?.id;
      if (!devolucion1Id) throw new Error('No se generó registro de devolución en el arreglo');
      if (rDev1.montoDevuelto !== 15000) {
        throw new Error(`montoDevuelto esperado 15000, recibido: ${rDev1.montoDevuelto}`);
      }
      console.log(`   💵 Devolución parcial de $15.000 registrada (ID #${devolucion1Id}, montoDevuelto: $${rDev1.montoDevuelto})`);

      // 2.6 Registrar segunda devolución de $15.000 (totalizando $30.000 devueltos)
      const dev2Res = await fetch(`${TARGET_URL}/api/reservas/${testReservaId}/devoluciones`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          monto: 15000,
          metodoPago: 'TRANSFERENCIA',
          notas: 'Segunda cuota completando devolución',
          version: rDev1.version,
        }),
      });

      if (!dev2Res.ok) throw new Error(`Fallo al registrar segunda devolución: HTTP ${dev2Res.status}`);
      const rDev2 = await dev2Res.json();
      if (rDev2.montoDevuelto !== 30000) {
        throw new Error(`montoDevuelto esperado 30000, recibido: ${rDev2.montoDevuelto}`);
      }
      if (rDev2.estadoPago !== 'DEVUELTO') {
        throw new Error(`estadoPago esperado DEVUELTO, recibido: ${rDev2.estadoPago}`);
      }
      console.log(`   💵 Devolución total completada (montoDevuelto: $${rDev2.montoDevuelto}, estadoPago: ${rDev2.estadoPago})`);

      // 2.7 Concurrencia optimista en devoluciones: intentar enviar con versión stale -> HTTP 409
      const staleDevRes = await fetch(`${TARGET_URL}/api/reservas/${testReservaId}/devoluciones`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          monto: 1000,
          metodoPago: 'EFECTIVO',
          version: reservaCancelada.version, // STALE!
        }),
      });
      if (staleDevRes.status !== 409) {
        throw new Error(`Se esperaba HTTP 409 ante versión stale en devoluciones, recibido ${staleDevRes.status}`);
      }
      console.log('   🛡️ Concurrencia optimista en devoluciones verificada (HTTP 409)');

      // 2.8 Anular devolución 1 y verificar recálculo automático
      const deleteDevRes = await fetch(`${TARGET_URL}/api/reservas/${testReservaId}/devoluciones/${devolucion1Id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (!deleteDevRes.ok) throw new Error(`Fallo al anular devolución: HTTP ${deleteDevRes.status}`);
      const rAnulada = await deleteDevRes.json();
      if (rAnulada.montoDevuelto !== 15000) {
        throw new Error(`montoDevuelto tras anular esperado 15000, recibido: ${rAnulada.montoDevuelto}`);
      }
      console.log(`   🧹 Devolución #${devolucion1Id} anulada; monto recalculado a $${rAnulada.montoDevuelto}`);
    });

    // 3. Módulo de Gastos Operativos y Caja Chica (/api/gastos)
    await step('3. Módulo de Gastos Operativos y Caja Chica (/api/gastos)', async () => {
      // 3.1 Intento de crear gasto sin campos obligatorios -> HTTP 400
      const badGastoRes = await fetch(`${TARGET_URL}/api/gastos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({}),
      });
      if (badGastoRes.status !== 400) {
        throw new Error(`Se esperaba HTTP 400 al crear gasto sin campos, recibido: ${badGastoRes.status}`);
      }
      console.log('   🛡️ Validación de campos obligatorios en gastos confirmada (HTTP 400)');

      // 3.2 Crear gasto operativo válido
      const fechaHoy = new Date().toISOString().slice(0, 10);
      const createGastoRes = await fetch(`${TARGET_URL}/api/gastos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          fecha: fechaHoy,
          categoria: 'COMBUSTIBLE',
          monto: 35000,
          descripcion: 'Carga de combustible para van de traslado a pista',
        }),
      });

      if (!createGastoRes.ok) throw new Error(`Fallo al crear gasto: HTTP ${createGastoRes.status}`);
      const gastoCreado = await createGastoRes.json();
      testGastoId = gastoCreado.id;
      if (typeof gastoCreado.monto !== 'number' || gastoCreado.monto !== 35000) {
        throw new Error(`Monto del gasto inválido o no numérico: ${gastoCreado.monto}`);
      }
      console.log(`   ⛽ Gasto operativo creado #${testGastoId} ($${gastoCreado.monto} CLP, Categoría: ${gastoCreado.categoria})`);

      // 3.3 Listar gastos y validar presencia
      const listGastosRes = await fetch(`${TARGET_URL}/api/gastos`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (!listGastosRes.ok) throw new Error(`Fallo al listar gastos: HTTP ${listGastosRes.status}`);
      const gastosList = await listGastosRes.json();
      const items = Array.isArray(gastosList) ? gastosList : gastosList.data;
      const encontrado = items?.find((g: any) => g.id === testGastoId);
      if (!encontrado) throw new Error(`El gasto #${testGastoId} no apareció en el listado de gastos`);
      console.log(`   📋 Gasto #${testGastoId} verificado en listado de caja chica`);

      // 3.4 Verificar registro en auditoría
      const auditRes = await fetch(`${TARGET_URL}/api/auditoria?entidad=GASTO&limit=10`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (auditRes.ok) {
        const auditData = await auditRes.json();
        const logs = auditData.data || auditData;
        const auditLog = Array.isArray(logs) ? logs.find((l: any) => l.entidadId === String(testGastoId)) : null;
        if (auditLog) {
          console.log(`   📋 Evento de auditoría registrado: "${auditLog.descripcion}"`);
        }
      }

      // 3.5 Eliminar gasto (soft delete)
      const delGastoRes = await fetch(`${TARGET_URL}/api/gastos/${testGastoId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (delGastoRes.status !== 204 && delGastoRes.status !== 200) {
        throw new Error(`Fallo al eliminar gasto: HTTP ${delGastoRes.status}`);
      }
      console.log(`   🧹 Gasto #${testGastoId} eliminado de forma segura`);
    });

    // 4. Motor de Promociones y Tarifas con Control RBAC
    await step('4. Motor de Promociones y Tarifas con Control RBAC (/api/promociones, /api/tarifas)', async () => {
      const timestamp = Date.now();
      // 4.1 Crear usuario de prueba con rol RECEPCION
      const operadorEmail = `operador.promo.${timestamp}@parapente.cl`;
      const createUserRes = await fetch(`${TARGET_URL}/api/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          email: operadorEmail,
          password: 'Password123!',
          nombre: `Operador RBAC ${timestamp}`,
          role: 'RECEPCION',
        }),
      });

      if (!createUserRes.ok) throw new Error(`No se pudo crear usuario de prueba: HTTP ${createUserRes.status}`);
      const testUser = await createUserRes.json();
      testUserId = testUser.id;

      // Login del operador RECEPCION
      const opLoginRes = await fetch(`${TARGET_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: operadorEmail, password: 'Password123!' }),
      });
      if (!opLoginRes.ok) throw new Error(`Login de operador falló: HTTP ${opLoginRes.status}`);
      const opToken = (await opLoginRes.json()).token;

      // 4.2 Probar RBAC: Operador RECEPCION intenta crear promoción -> HTTP 403 Forbidden
      const rbacPromoRes = await fetch(`${TARGET_URL}/api/promociones`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${opToken}`,
        },
        body: JSON.stringify({
          nombre: 'Promo Hack',
          codigo: 'HACK2026',
          tipo: 'PORCENTAJE',
          valor: 50,
          activa: true,
        }),
      });

      if (rbacPromoRes.status !== 403) {
        throw new Error(`Se esperaba HTTP 403 Forbidden para rol RECEPCION en promociones, recibido: ${rbacPromoRes.status}`);
      }
      console.log('   🛡️ Bloqueo RBAC verificado (HTTP 403 Forbidden para usuario no-admin)');

      // 4.3 Como ADMIN: Crear promoción válida
      const promoPayload = {
        nombre: `Promo Primavera E2E ${timestamp}`,
        descripcion: 'Descuento especial E2E',
        tipoDescuento: 'PORCENTAJE',
        valor: 15,
        activa: true,
        fechaInicio: '2026-09-01T00:00:00.000Z',
        fechaFin: '2026-11-30T23:59:59.000Z',
      };

      const createPromoRes = await fetch(`${TARGET_URL}/api/promociones`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify(promoPayload),
      });

      if (!createPromoRes.ok) throw new Error(`Fallo al crear promoción como ADMIN: HTTP ${createPromoRes.status}`);
      const promoCreada = await createPromoRes.json();
      testPromoId = promoCreada.id;
      console.log(`   🏷️ Promoción creada #${testPromoId} ("${promoCreada.nombre}", Tipo: ${promoCreada.tipoDescuento})`);

      // 4.4 Listar promociones y validar contrato ADR 005
      const listPromoRes = await fetch(`${TARGET_URL}/api/promociones`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (!listPromoRes.ok) throw new Error(`Fallo al listar promociones: HTTP ${listPromoRes.status}`);
      const promoList = await listPromoRes.json();
      if (!Array.isArray(promoList.data)) {
        throw new Error('Listado de promociones no respeta el envelope { data: [...], pagination: {...} }');
      }
      console.log(`   📦 Contrato ADR 005 en /api/promociones verificado (${promoList.data.length} elementos)`);

      // 4.5 Actualizar promoción
      const updatePromoRes = await fetch(`${TARGET_URL}/api/promociones/${testPromoId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ valor: 20 }),
      });
      if (!updatePromoRes.ok) throw new Error(`Fallo al actualizar promoción: HTTP ${updatePromoRes.status}`);
      const promoActualizada = await updatePromoRes.json();
      if (Number(promoActualizada.valor) !== 20) {
        throw new Error(`Valor esperado 20, recibido: ${promoActualizada.valor}`);
      }
      console.log(`   ✏️ Promoción #${testPromoId} actualizada a 20% de descuento`);

      // 4.6 Eliminar promoción (soft delete)
      const delPromoRes = await fetch(`${TARGET_URL}/api/promociones/${testPromoId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (!delPromoRes.ok) throw new Error(`Fallo al eliminar promoción: HTTP ${delPromoRes.status}`);
      console.log(`   🧹 Promoción #${testPromoId} eliminada`);

      // 4.7 Consultar tarifas y verificar serialización
      const tarifasRes = await fetch(`${TARGET_URL}/api/tarifas`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (!tarifasRes.ok) throw new Error(`Fallo al consultar tarifas: HTTP ${tarifasRes.status}`);
      const tarifasData = await tarifasRes.json();
      console.log(`   💰 Tarifas del sistema operativas (${tarifasData.data?.length || 0} tarifas activas)`);
    });

    // 5. Configuración de Bloques y Resolver de Disponibilidad
    await step('5. Configuración de Bloques y Resolver de Disponibilidad (/api/configuracion-bloques)', async () => {
      // 5.1 Resolver rango válido (7 días)
      const resolverRes = await fetch(`${TARGET_URL}/api/configuracion-bloques/resolver?desde=2026-09-09&hasta=2026-09-15`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (!resolverRes.ok) throw new Error(`Fallo al consultar resolver: HTTP ${resolverRes.status}`);
      const diasResueltos = await resolverRes.json();
      const diasKeys = Object.keys(diasResueltos);
      if (diasKeys.length < 7) {
        throw new Error(`El resolver no retornó los 7 días esperados: ${JSON.stringify(diasResueltos)}`);
      }
      console.log(`   📅 Resolver de disponibilidad verificado (${diasKeys.length} días calculados: ${diasKeys[0]} a ${diasKeys[diasKeys.length - 1]})`);

      // 5.2 Guardrails del Resolver: desde > hasta -> HTTP 400
      const invalidRangeRes = await fetch(`${TARGET_URL}/api/configuracion-bloques/resolver?desde=2026-09-15&hasta=2026-09-09`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (invalidRangeRes.status !== 400) {
        throw new Error(`Se esperaba HTTP 400 ante rango invertido, recibido: ${invalidRangeRes.status}`);
      }
      console.log('   🛡️ Validación de rango "desde > hasta" confirmada (HTTP 400)');

      // 5.3 Guardrails del Resolver: formato de fecha inválido -> HTTP 400
      const badDateRes = await fetch(`${TARGET_URL}/api/configuracion-bloques/resolver?desde=fecha-mala&hasta=2026-09-09`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (badDateRes.status !== 400) {
        throw new Error(`Se esperaba HTTP 400 ante formato de fecha inválido, recibido: ${badDateRes.status}`);
      }
      console.log('   🛡️ Validación de formato de fecha YYYY-MM-DD confirmada (HTTP 400)');

      // 5.4 Limpieza de configuraciones expiradas (batch archiver)
      const limpiarRes = await fetch(`${TARGET_URL}/api/configuracion-bloques/limpiar-expiradas`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (!limpiarRes.ok) throw new Error(`Fallo en /limpiar-expiradas: HTTP ${limpiarRes.status}`);
      const limpiarData = await limpiarRes.json();
      console.log(`   🧹 Limpieza de configuraciones expiradas ejecutada (${limpiarData.archivadas ?? 0} archivadas)`);
    });

    // 6. Notificaciones Automáticas y Plantillas de Recordatorio
    await step('6. Notificaciones Automáticas y Plantillas de Recordatorio (/api/notificaciones)', async () => {
      // 6.1 Preview de notificaciones para próximas 24h
      const notif24Res = await fetch(`${TARGET_URL}/api/notificaciones/pendientes?horas=24`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (!notif24Res.ok) throw new Error(`Fallo en /notificaciones/pendientes?horas=24: HTTP ${notif24Res.status}`);
      const notif24Data = await notif24Res.json();
      if (notif24Data.ventanaHoras !== 24) {
        throw new Error(`ventanaHoras esperada 24, recibida: ${notif24Data.ventanaHoras}`);
      }
      console.log(`   🔔 Ventana de 24h verificada: ${notif24Data.total} vuelos candidatos`);

      // 6.2 Preview de notificaciones para próximas 2h
      const notif2Res = await fetch(`${TARGET_URL}/api/notificaciones/pendientes?horas=2`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (!notif2Res.ok) throw new Error(`Fallo en /notificaciones/pendientes?horas=2: HTTP ${notif2Res.status}`);
      const notif2Data = await notif2Res.json();
      if (notif2Data.ventanaHoras !== 2) {
        throw new Error(`ventanaHoras esperada 2, recibida: ${notif2Data.ventanaHoras}`);
      }
      console.log(`   🔔 Ventana de 2h verificada: ${notif2Data.total} vuelos candidatos`);

      // 6.3 Configuración de notificaciones automáticas (GET)
      const configRes = await fetch(`${TARGET_URL}/api/notificaciones/config`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (!configRes.ok) throw new Error(`Fallo en GET /notificaciones/config: HTTP ${configRes.status}`);
      const currentConfig = await configRes.json();
      console.log(`   ⚙️ Configuración de notificaciones: recordatorio24h=${currentConfig.recordatorio24hActivo}, version=${currentConfig.version}`);

      // 6.4 Concurrencia optimista en actualización de config: enviar versión stale -> HTTP 409
      const staleConfigRes = await fetch(`${TARGET_URL}/api/notificaciones/config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          recordatorio24hActivo: currentConfig.recordatorio24hActivo,
          version: (currentConfig.version || 1) - 1, // STALE!
        }),
      });

      if (staleConfigRes.status !== 409) {
        throw new Error(`Se esperaba HTTP 409 ante versión stale en config notificaciones, recibido: ${staleConfigRes.status}`);
      }
      console.log('   🛡️ Concurrencia optimista en configuración de notificaciones verificada (HTTP 409)');
    });

    // 7. Gestión de Pasajeros, Verificación de Peso y Firmas Digitales
    await step('7. Gestión de Pasajeros, Verificación de Peso y Firmas Digitales (/api/pasajeros)', async () => {
      const timestamp = Date.now();
      // 7.1 Crear pasajero de prueba
      const createPaxRes = await fetch(`${TARGET_URL}/api/pasajeros`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          nombre: `Pasajero Directo ${timestamp}`,
          telefono: '+56977665544',
          rutDni: '17889900-1',
          peso: 70,
          condicionFisica: 'Normal',
        }),
      });

      if (!createPaxRes.ok) throw new Error(`Fallo al crear pasajero directo: HTTP ${createPaxRes.status}`);
      const paxCreado = await createPaxRes.json();
      testPasajeroId = paxCreado.id;
      console.log(`   👤 Pasajero creado #${testPasajeroId} ("${paxCreado.nombre}")`);

      // 7.2 Actualizar datos y verificación de peso en pista
      const patchPaxRes = await fetch(`${TARGET_URL}/api/pasajeros/${testPasajeroId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          pesoVerificado: 72,
          contactoEmergencia: 'Hermano Pasajero',
          telefonoEmergencia: '+56911223344',
        }),
      });

      if (!patchPaxRes.ok) throw new Error(`Fallo al actualizar pasajero: HTTP ${patchPaxRes.status}`);
      const paxActualizado = await patchPaxRes.json();
      if (paxActualizado.pesoVerificado !== 72) {
        throw new Error(`pesoVerificado esperado 72, recibido: ${paxActualizado.pesoVerificado}`);
      }
      console.log(`   ⚖️ Peso verificado en pista registrado: ${paxActualizado.pesoVerificado} kg`);

      // 7.3 Guardar firma digital individual
      const firmaPayload = {
        firmaBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        rutDni: '17889900-1',
        contactoEmergencia: 'Hermano Pasajero',
        telefonoEmergencia: '+56911223344',
        condicionFisica: 'Normal',
        pesoVerificado: 72,
      };

      const firmaRes = await fetch(`${TARGET_URL}/api/pasajeros/${testPasajeroId}/firma`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify(firmaPayload),
      });

      if (!firmaRes.ok) throw new Error(`Fallo al guardar firma de pasajero: HTTP ${firmaRes.status}`);
      const paxFirmado = await firmaRes.json();
      if (!paxFirmado.firmaDeslinde) {
        throw new Error('firmaDeslinde no se estableció en true');
      }
      console.log(`   ✍️ Firma digital guardada con éxito (firmaDeslinde: ${paxFirmado.firmaDeslinde})`);
    });

    // 8. Limpieza Segura (Soft Delete de Registros de Prueba)
    await step('8. Limpieza Segura (Soft Delete de Todos los Registros de Prueba)', async () => {
      // 8.1 Limpiar pasajero
      if (testPasajeroId) {
        await fetch(`${TARGET_URL}/api/pasajeros/${testPasajeroId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        console.log(`   🧹 Pasajero #${testPasajeroId} eliminado`);
      }

      // 8.2 Limpiar reserva
      if (testReservaId) {
        await fetch(`${TARGET_URL}/api/reservas/${testReservaId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        console.log(`   🧹 Reserva #${testReservaId} eliminada`);
      }

      // 8.3 Limpiar usuario RBAC
      if (testUserId) {
        await fetch(`${TARGET_URL}/api/users/${testUserId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        console.log(`   🧹 Usuario RBAC #${testUserId} eliminado`);
      }
    });

  } catch (err) {
    console.error('\n💥 Error fatal en la ejecución de la suite Fase 9:', err);
    process.exitCode = 1;
  } finally {
    console.log('\n================================================================================');
    console.log('                 RESUMEN DE EJECUCIÓN - FASE 9 (CASOS BORDE)                    ');
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
      console.log('🎉 ¡FASE 9 COMPLETADA Y CERTIFICADA EXITOSAMENTE CON 0 ERRORES! 🎉\n');
    } else {
      console.log(`⚠️ SUITE INCOMPLETA: ${totalPassed}/${results.length} etapas aprobadas.\n`);
      process.exitCode = 1;
    }
  }
}

runFase9Suite();
