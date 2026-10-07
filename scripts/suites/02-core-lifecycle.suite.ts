/**
 * Suite 02: Core Lifecycle & Cuadratura Contable
 * Consolida el ciclo de vida completo de una reserva y sus vuelos:
 * Creación -> Abono -> Agendamiento -> Firma Deslinde -> Completado -> Liquidación Piloto
 */

import {
  createSuiteRunner,
  resolveSuiteConfig,
  createApiClient,
  crearPilotoFixture,
  crearReservaFixture,
  createTeardownRegistry,
  fechaFuturaIso,
} from '../lib';

export async function runCoreLifecycleSuite() {
  const config = resolveSuiteConfig({
    name: '02-Core-Lifecycle: Ciclo de Vida & Liquidación',
    description: 'Flujo completo de Reserva, Asignación de Vuelos, Firma de Deslinde, Pagos y Liquidación a Piloto',
  });

  const runner = createSuiteRunner(config);
  const client = createApiClient(config);
  const teardown = createTeardownRegistry(client);

  try {
    let pilotoId: number;
    let reservaId: number;
    let pasajeroId: number;
    let vueloId: number;
    let tokenPublicoPax: string;

    // 1. Crear piloto de prueba
    await runner.step('1. Alta de piloto para el ciclo de vida', async () => {
      const pilotoPayload = crearPilotoFixture('Piloto Ciclo');
      const res = await client.post('/api/pilotos', pilotoPayload);
      if (!res.ok || !res.data?.id) {
        throw new Error(`Error creando piloto: HTTP ${res.status} ${JSON.stringify(res.data)}`);
      }
      pilotoId = res.data.id;
      teardown.registerPiloto(pilotoId);
      const resTarifa = await client.patch(`/api/pilotos/${pilotoId}`, { tarifaPorVuelo: 25000 });
      if (!resTarifa.ok) {
        throw new Error(`Error actualizando tarifa del piloto: HTTP ${resTarifa.status}`);
      }
      console.log(`   🪂 Piloto creado con ID ${pilotoId} (${pilotoPayload.nombre}, tarifa: $25000)`);
    });

    // 2. Crear reserva con pasajero y registrar abono inicial
    await runner.step('2. Creación de reserva y abono inicial de $20.000', async () => {
      const reservaPayload = crearReservaFixture('Titular Ciclo', 1, {
        estadoPago: 'PENDIENTE',
        valorTotal: 70000,
        abono: 0,
      });

      const res = await client.post('/api/reservas', reservaPayload);
      if (!res.ok || !res.data?.id) {
        throw new Error(`Error creando reserva: HTTP ${res.status} ${JSON.stringify(res.data)}`);
      }
      reservaId = res.data.id;
      teardown.registerReserva(reservaId);

      const pax = res.data.pasajeros?.[0];
      if (!pax?.id) {
        throw new Error('Reserva creada sin pasajero');
      }
      pasajeroId = pax.id;
      // Solo identificadores no secuenciales (el id numérico ya no resuelve en rutas públicas)
      tokenPublicoPax = pax.tokenPublico || pax.shortId;
      if (!tokenPublicoPax) throw new Error('El pasajero creado no tiene tokenPublico/shortId');
      teardown.registerPasajero(pasajeroId);

      // Registrar abono inicial conforme a ADR 002 (cuadratura en tabla Pago)
      const resAbono = await client.post(`/api/reservas/${reservaId}/pagos`, {
        monto: 20000,
        metodoPago: 'TRANSFERENCIA',
        notas: 'Abono inicial 30%',
      });
      if (!resAbono.ok) {
        throw new Error(`Error registrando abono inicial: HTTP ${resAbono.status}`);
      }

      console.log(`   📋 Reserva creada con ID ${reservaId} (#${res.data.numeroReserva}), Pax ID ${pasajeroId}, Abono inicial: $20.000 (estadoPago: ABONADO)`);
    });

    // 3. Asignar vuelo al pasajero con el piloto
    await runner.step('3. Agendamiento de vuelo con piloto asignado', async () => {
      const fechaVuelo = fechaFuturaIso(2, '10:30');
      const vueloPayload = {
        fechaHora: fechaVuelo,
        valorPactado: 70000,
        estado: 'AGENDADO',
        pilotoId,
        pasajeroId,
      };

      const res = await client.post('/api/vuelos', vueloPayload);
      if (!res.ok || !res.data?.id) {
        throw new Error(`Error agendando vuelo: HTTP ${res.status} ${JSON.stringify(res.data)}`);
      }
      vueloId = res.data.id;
      teardown.registerVuelo(vueloId);
      console.log(`   🛫 Vuelo agendado con ID ${vueloId} (version: ${res.data.version})`);
    });

    // 4. Firma digital de deslinde pública
    await runner.step('4. Firma digital pública del deslinde de responsabilidad', async () => {
      const firmaPayload = {
        firmaBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        contactoEmergencia: 'Contacto Ciclo Vida',
        telefonoEmergencia: '+56999887766',
        pesoVerificado: 74,
      };

      const res = await client.post(
        `/api/public/pasajeros/${tokenPublicoPax}/firma`,
        firmaPayload,
        { skipAuth: true }
      );

      if (!res.ok) {
        throw new Error(`Error firmando deslinde: HTTP ${res.status} ${JSON.stringify(res.data)}`);
      }

      // Verificar que el estado del deslinde ahora sea true
      const resPax = await client.get(`/api/pasajeros/${pasajeroId}`);
      if (!resPax.ok || !resPax.data?.firmaDeslinde) {
        throw new Error(`Pasajero no registra firmaDeslinde: true`);
      }
      console.log(`   ✍️ Deslinde firmado exitosamente y persistido en DB`);
    });

    // 5. Completar vuelo y validar liquidación a piloto
    await runner.step('5. Completar vuelo y cuadratura de pago a piloto', async () => {
      const resEstado = await client.patch(`/api/vuelos/${vueloId}/estado`, {
        estado: 'COMPLETADO',
        version: 0,
      });

      if (!resEstado.ok) {
        throw new Error(`Error completando vuelo: HTTP ${resEstado.status} ${JSON.stringify(resEstado.data)}`);
      }

      // Validar que el pago al piloto se calculó (tarifaPorVuelo = 25000)
      const pagoPiloto = Number(resEstado.data?.pagoPiloto || 0);
      if (pagoPiloto !== 25000) {
        throw new Error(`Liquidación a piloto incorrecta: esperada 25000, recibida ${pagoPiloto}`);
      }
      console.log(`   💰 Vuelo COMPLETADO. Pago piloto liquidado: $${pagoPiloto}`);
    });

    // 6. Liquidación final de la reserva vía endpoint de pagos y autocompletado
    await runner.step('6. Pago del saldo restante ($50.000) y transición automática a COMPLETADA', async () => {
      // Saldo pendiente: valorTotal 70000 - abono 20000 = 50000
      const resPago = await client.post(`/api/reservas/${reservaId}/pagos`, {
        monto: 50000,
        metodoPago: 'TRANSFERENCIA',
      });

      if (!resPago.ok) {
        throw new Error(`Error registrando pago de saldo: HTTP ${resPago.status} ${JSON.stringify(resPago.data)}`);
      }

      // La reserva ahora debe estar PAGADA y haber transicionado automáticamente a COMPLETADA (commit 1f8041d)
      const resFinal = await client.get(`/api/reservas/${reservaId}`);
      if (!resFinal.ok) {
        throw new Error(`Error consultando reserva tras pago: HTTP ${resFinal.status}`);
      }

      if (resFinal.data?.estadoPago !== 'PAGADO') {
        throw new Error(`Reserva no figura como PAGADO: estadoPago=${resFinal.data?.estadoPago}`);
      }

      if (resFinal.data?.estado !== 'COMPLETADA') {
        throw new Error(`Reserva debió autocompletarse a COMPLETADA al tener vuelo y saldo completado: estado=${resFinal.data?.estado}`);
      }

      console.log(`   💰 Pago de $50000 registrado. Reserva #${reservaId} transicionó a COMPLETADA (abono=$${resFinal.data?.abono})`);
    });

    // 7. Cierre contable y congelamiento con snapshot inmutable (commit f94dedf)
    await runner.step('7. Cierre contable formal: Sello inmutable con cerradaAt y snapshotJson', async () => {
      const resCerrar = await client.post(`/api/reservas/${reservaId}/cerrar`);
      if (!resCerrar.ok) {
        throw new Error(`Error al cerrar contablemente reserva: HTTP ${resCerrar.status} ${JSON.stringify(resCerrar.data)}`);
      }

      const cerrada = resCerrar.data;
      if (!cerrada.cerradaAt) {
        throw new Error('Reserva cerrada no estampó cerradaAt');
      }

      if (!cerrada.snapshotJson || typeof cerrada.snapshotJson !== 'object') {
        throw new Error('Reserva cerrada no generó snapshotJson');
      }

      const snapshot = cerrada.snapshotJson as Record<string, any>;
      if (snapshot.estado !== 'COMPLETADA' || snapshot.valorTotal !== 70000 || snapshot.abono !== 70000) {
        throw new Error(`Snapshot contable inconsistente: ${JSON.stringify(snapshot)}`);
      }

      console.log(`   🔒 Reserva #${reservaId} congelada con snapshot inmutable (cerradaAt: ${cerrada.cerradaAt})`);
    });

    // 8. Guardrails de inmutabilidad estricta sobre la reserva cerrada
    await runner.step('8. Guardrails de inmutabilidad: Rechazo 409/400 en ediciones, pagos y vuelos de reserva cerrada', async () => {
      // 8a. Rechazo al editar datos generales
      const resMutar = await client.patch(`/api/reservas/${reservaId}`, {
        nombreTitular: 'Intento Fraude Post-Cierre',
      });
      if (resMutar.status !== 409 && resMutar.status !== 400) {
        throw new Error(`Se esperaba 409/400 al editar reserva cerrada, recibido HTTP ${resMutar.status}`);
      }

      // 8b. Rechazo al agregar nuevos pagos
      const resNuevoPago = await client.post(`/api/reservas/${reservaId}/pagos`, {
        monto: 5000,
        metodoPago: 'EFECTIVO',
      });
      if (resNuevoPago.status !== 409 && resNuevoPago.status !== 400) {
        throw new Error(`Se esperaba 409/400 al añadir pago a reserva cerrada, recibido HTTP ${resNuevoPago.status}`);
      }

      // 8c. Rechazo al modificar estado de vuelo asociado
      const resVueloMod = await client.patch(`/api/vuelos/${vueloId}/estado`, {
        estado: 'AGENDADO',
        version: 1,
      });
      if (resVueloMod.status !== 409 && resVueloMod.status !== 400) {
        throw new Error(`Se esperaba 409 al modificar vuelo de reserva cerrada, recibido HTTP ${resVueloMod.status}`);
      }

      // 8d. Rechazo al eliminar vuelo de reserva cerrada
      const resVueloDel = await client.delete(`/api/vuelos/${vueloId}`);
      if (resVueloDel.status !== 409) {
        throw new Error(`Se esperaba 409 al eliminar vuelo de reserva cerrada, recibido HTTP ${resVueloDel.status}`);
      }

      console.log(`   🛡️ Inmutabilidad verificada: Todos los intentos de alteración fueron rechazados (409/400)`);
    });

    // 9. Reapertura administrativa excepcional con motivo formal
    await runner.step('9. Reapertura administrativa auditada: Retiro de cerradaAt y restauración de mutabilidad', async () => {
      // 9a. Rechazo si no se entrega motivo
      const resSinMotivo = await client.post(`/api/reservas/${reservaId}/reabrir`, { motivo: '   ' });
      if (resSinMotivo.status !== 400) {
        throw new Error(`Se esperaba HTTP 400 al reabrir sin motivo, recibido ${resSinMotivo.status}`);
      }

      // 9b. Reapertura exitosa con motivo
      const resReabrir = await client.post(`/api/reservas/${reservaId}/reabrir`, {
        motivo: 'Auditoría E2E: Regularización contable aprobada',
      });

      if (!resReabrir.ok) {
        throw new Error(`Error reabriendo reserva: HTTP ${resReabrir.status} ${JSON.stringify(resReabrir.data)}`);
      }

      if (resReabrir.data?.cerradaAt !== null && resReabrir.data?.cerradaAt !== undefined) {
        throw new Error(`Reserva reabierta aún registra cerradaAt: ${resReabrir.data?.cerradaAt}`);
      }

      // 9c. Verificar que vuelve a admitir ajustes contables (pagos) que estaban bloqueados por cerradaAt
      const resAjustePago = await client.post(`/api/reservas/${reservaId}/pagos`, {
        monto: 1000,
        metodoPago: 'TRANSFERENCIA',
        notas: 'Ajuste contable tras reapertura autorizada',
      });

      if (!resAjustePago.ok) {
        throw new Error(`Reserva reabierta no permitió registrar ajuste de pago: HTTP ${resAjustePago.status} ${JSON.stringify(resAjustePago.data)}`);
      }

      // Anular el pago de ajuste para dejar saldos intactos
      const pagoAjusteId = resAjustePago.data.pagos?.[0]?.id;
      if (pagoAjusteId) {
        const resDelPago = await client.delete(`/api/reservas/${reservaId}/pagos/${pagoAjusteId}`);
        if (!resDelPago.ok) {
          console.warn(`   ⚠️ Advertencia al anular pago de ajuste: HTTP ${resDelPago.status}`);
        }
      }

      console.log(`   🔓 Reserva #${reservaId} reabierta con éxito y verificada mutable (cerradaAt=null, admite ajustes de pagos)`);
    });

    return runner.conclude();
  } finally {
    await teardown.cleanup();
  }
}

// Ejecución directa si se invoca como script
if (process.argv[1]?.endsWith('02-core-lifecycle.suite.ts')) {
  runCoreLifecycleSuite().then((res) => {
    if (!res.ok) process.exit(1);
  });
}
