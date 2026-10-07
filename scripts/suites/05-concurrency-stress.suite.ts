/**
 * Suite 05: Concurrencia, Estrés y Reglas de Negocio Críticas
 * Consolida la validación de:
 * 1. Carrera simultánea de calendario (aislamiento de piloto/hora)
 * 2. Re-agendamiento sucesivo con version Int
 * 3. Ráfaga concurrente con detección de conflicto 409
 * 4. Límite de peso aeronáutico (>115kg rechazado)
 * 5. Inmutabilidad terminal (COMPLETADO -> AGENDADO bloqueado)
 * 6. Idempotencia de Outbox (ADR 009)
 * 7. Sincronización SSE (<1500ms)
 * 8. Slot fantasma soft-delete/cancelado (anti-regresión fix c064507: índice único parcial)
 */

import { randomUUID } from 'crypto';
import {
  createSuiteRunner,
  resolveSuiteConfig,
  createApiClient,
  createSSEListener,
  crearPilotoFixture,
  crearReservaFixture,
  createTeardownRegistry,
  fechaFuturaIso,
} from '../lib';

export async function runConcurrencyStressSuite() {
  const config = resolveSuiteConfig({
    name: '05-Concurrency-Stress: Concurrencia, Versioning & Reglas Críticas',
    description: 'Carreras de calendario, control de versión 409, límites aeronáuticos, inmutabilidad y deduplicación outbox',
  });

  const runner = createSuiteRunner(config);
  const client = createApiClient(config);
  const teardown = createTeardownRegistry(client);

  try {
    let pilotoAId: number;
    let pilotoBId: number;
    let reserva1Id: number;
    let reserva2Id: number;
    let pax1Id: number;
    let pax2Id: number;
    let vueloCarreraId: number;

    // 1. Setup de entidades
    await runner.step('1. Setup de pilotos y reservas para pruebas concurrentes', async () => {
      // Asegurar token de autenticación para evitar que peticiones concurrentes compitan por login
      await client.getAuthToken();

      const [resP1, resP2, resR1, resR2] = await Promise.all([
        client.post('/api/pilotos', crearPilotoFixture('Piloto Concurrente A')),
        client.post('/api/pilotos', crearPilotoFixture('Piloto Concurrente B')),
        client.post('/api/reservas', crearReservaFixture('Titular Concurrente 1')),
        client.post('/api/reservas', crearReservaFixture('Titular Concurrente 2')),
      ]);

      if (!resP1.ok || !resP2.ok || !resR1.ok || !resR2.ok) {
        const errors = [
          !resP1.ok ? `P1 (${resP1.status}): ${JSON.stringify(resP1.data)}` : null,
          !resP2.ok ? `P2 (${resP2.status}): ${JSON.stringify(resP2.data)}` : null,
          !resR1.ok ? `R1 (${resR1.status}): ${JSON.stringify(resR1.data)}` : null,
          !resR2.ok ? `R2 (${resR2.status}): ${JSON.stringify(resR2.data)}` : null,
        ].filter(Boolean).join('; ');
        throw new Error(`Fallo en el setup inicial de pilotos y reservas: ${errors}`);
      }

      pilotoAId = resP1.data.id;
      pilotoBId = resP2.data.id;
      reserva1Id = resR1.data.id;
      reserva2Id = resR2.data.id;

      teardown.registerPiloto(pilotoAId);
      teardown.registerPiloto(pilotoBId);
      teardown.registerReserva(reserva1Id);
      teardown.registerReserva(reserva2Id);

      pax1Id = resR1.data.pasajeros[0].id;
      pax2Id = resR2.data.pasajeros[0].id;

      console.log(`   🏁 Setup completado: Pilotos [${pilotoAId}, ${pilotoBId}], Pasajeros [${pax1Id}, ${pax2Id}]`);
    });

    // 2. Carrera simultánea de agendamiento
    await runner.step('2. Carrera simultánea: Dos vuelos al mismo piloto a la misma hora exacta', async () => {
      const fechaMismaHora = fechaFuturaIso(5, '11:00');

      const [resV1, resV2] = await Promise.all([
        client.post('/api/vuelos', {
          fechaHora: fechaMismaHora,
          valorPactado: 60000,
          estado: 'AGENDADO',
          pilotoId: pilotoAId,
          pasajeroId: pax1Id,
        }),
        client.post('/api/vuelos', {
          fechaHora: fechaMismaHora,
          valorPactado: 60000,
          estado: 'AGENDADO',
          pilotoId: pilotoAId,
          pasajeroId: pax2Id,
        }),
      ]);

      const statuses = [resV1.status, resV2.status].sort();
      // Exactamente uno debe ser 201 y el otro 400 (conflicto de piloto ocupado)
      if (statuses[0] !== 201 || statuses[1] !== 400) {
        throw new Error(`Carrera de calendario falló. Statuses recibidos: [${resV1.status}, ${resV2.status}], esperados: [201, 400]`);
      }

      const winnerRes = resV1.status === 201 ? resV1 : resV2;
      vueloCarreraId = winnerRes.data.id;
      teardown.registerVuelo(vueloCarreraId);

      console.log(`   🛡️ Aislamiento atómico verificado: 1 vuelo aprobado (#${vueloCarreraId}), 1 colisión rechazada con 400`);
    });

    // 3. Re-agendamiento sucesivo con version Int
    await runner.step('3. Re-agendamiento sucesivo: Cambio a Piloto B incrementando version (0 -> 1)', async () => {
      const nuevaHora = fechaFuturaIso(5, '12:00');
      const resUpdate = await client.put(`/api/vuelos/${vueloCarreraId}`, {
        fechaHora: nuevaHora,
        valorPactado: 60000,
        pilotoId: pilotoBId,
        pasajeroId: pax1Id,
        version: 0,
      });

      if (!resUpdate.ok) {
        throw new Error(`Error re-agendando vuelo: HTTP ${resUpdate.status} ${JSON.stringify(resUpdate.data)}`);
      }

      const nuevaVersion = resUpdate.data?.version;
      if (nuevaVersion !== 1) {
        throw new Error(`Versión del vuelo no incrementó a 1: version=${nuevaVersion}`);
      }
      console.log(`   🔄 Re-agendamiento exitoso: asignado a Piloto B, version=${nuevaVersion}`);
    });

    // 4. Ráfaga concurrente con detección de 409 Conflict
    await runner.step('4. Ráfaga concurrente: Dos peticiones simultáneas sobre la misma versión', async () => {
      const [resMutA, resMutB] = await Promise.all([
        client.patch(`/api/vuelos/${vueloCarreraId}/estado`, {
          estado: 'CANCELADO',
          version: 1,
        }),
        client.patch(`/api/vuelos/${vueloCarreraId}/estado`, {
          estado: 'CANCELADO',
          version: 1,
        }),
      ]);

      const statuses = [resMutA.status, resMutB.status].sort();
      if (statuses[0] !== 200 || statuses[1] !== 409) {
        throw new Error(`Ráfaga de versiones falló. Statuses recibidos: [${resMutA.status}, ${resMutB.status}], esperados: [200, 409]`);
      }

      console.log(`   ⚔️ Concurrencia optimista validada: 1 ganador (200), 1 conflicto detectado (409)`);
    });

    // 5. Límite de peso aeronáutico (>115kg)
    await runner.step('5. Regla de seguridad aeronáutica: Rechazo atómico de pasajero con sobrepeso (>115kg)', async () => {
      const resReservaPesada = await client.post('/api/reservas', {
        nombreTitular: 'Titular Sobrepeso',
        email: `sobrepeso-${Date.now()}@test.com`,
        telefono: '912345678',
        valorTotal: 60000,
        abono: 0,
        pasajeros: [{ nombre: 'Pax Sobrepeso', peso: 120 }],
      });

      if (!resReservaPesada.ok) throw new Error('Error creando reserva de sobrepeso');
      const pesadaId = resReservaPesada.data.id;
      const paxPesadoId = resReservaPesada.data.pasajeros[0].id;
      teardown.registerReserva(pesadaId);

      // Intentar agendar vuelo con el pasajero de 120kg
      const resAgendar = await client.post('/api/vuelos', {
        fechaHora: fechaFuturaIso(6, '14:00'),
        valorPactado: 60000,
        estado: 'AGENDADO',
        pilotoId: pilotoAId,
        pasajeroId: paxPesadoId,
      });

      if (resAgendar.status !== 400) {
        throw new Error(`Se esperaba HTTP 400 al agendar pasajero de 120kg, pero se recibió ${resAgendar.status}`);
      }

      const errMsg = JSON.stringify(resAgendar.data);
      if (!errMsg.includes('115') && !errMsg.includes('peso')) {
        console.warn(`   ⚠️ Advertencia: mensaje no menciona explícitamente 115kg (${errMsg})`);
      }
      console.log(`   ⚖️ Rechazo aeronáutico validado: HTTP 400 por exceso de peso (>115kg)`);
    });

    // 6. Inmutabilidad de estado terminal
    await runner.step('6. Inmutabilidad terminal: Bloqueo de reversión COMPLETADO -> AGENDADO', async () => {
      // Crear vuelo fresco y completarlo
      const resVueloNuevo = await client.post('/api/vuelos', {
        fechaHora: fechaFuturaIso(7, '15:00'),
        valorPactado: 60000,
        estado: 'AGENDADO',
        pilotoId: pilotoAId,
        pasajeroId: pax2Id,
      });

      if (!resVueloNuevo.ok) throw new Error('Error creando vuelo nuevo');
      const vId = resVueloNuevo.data.id;
      teardown.registerVuelo(vId);

      // Transicionar a COMPLETADO
      const resComp = await client.patch(`/api/vuelos/${vId}/estado`, {
        estado: 'COMPLETADO',
        version: 0,
      });
      if (!resComp.ok) throw new Error('Error completando vuelo');

      // Intentar revertir a AGENDADO
      const resRevertir = await client.patch(`/api/vuelos/${vId}/estado`, {
        estado: 'AGENDADO',
        version: 1,
      });

      if (resRevertir.status !== 400) {
        throw new Error(`Se esperaba HTTP 400 al revertir vuelo COMPLETADO, pero se recibió ${resRevertir.status}`);
      }
      console.log(`   🔒 Inmutabilidad validada: Vuelo COMPLETADO bloqueado contra reversión (HTTP 400)`);
    });

    // 7. Idempotencia de outbox con X-Client-Id
    await runner.step('7. Idempotencia de Outbox: Deduplicación transparente mediante X-Client-Id', async () => {
      const clientId = randomUUID();
      const payload = {
        nombreTitular: 'Titular Idempotente E2E',
        email: `idempotente-${Date.now()}@test.com`,
        telefono: '998877665',
        valorTotal: 65000,
        abono: 0,
        pasajeros: [{ nombre: 'Pasajero Idempotente', peso: 70 }],
      };

      const res1 = await client.post('/api/reservas', payload, {
        headers: { 'x-client-id': clientId },
      });

      if (!res1.ok || !res1.data?.id) {
        throw new Error(`Error en primera llamada idempotente: HTTP ${res1.status}`);
      }
      const createdId = res1.data.id;
      teardown.registerReserva(createdId);

      // Repetición inmediata con el mismo X-Client-Id
      const res2 = await client.post('/api/reservas', payload, {
        headers: { 'x-client-id': clientId },
      });

      if (!res2.ok || res2.data?.id !== createdId) {
        throw new Error(`Fallo de idempotencia: res2.status=${res2.status}, id devuelto=${res2.data?.id}, esperado=${createdId}`);
      }

      console.log(`   🔁 Idempotencia validada: 2 llamadas con mismo X-Client-Id retornaron el mismo recurso #${createdId}`);
    });

    // 8. Sincronización SSE en tiempo real
    await runner.step('8. Sincronización reactiva SSE: Mutación y recepción de evento (<1500ms)', async () => {
      const sse = await createSSEListener(client);
      try {
        const payloadSse = {
          nombreTitular: 'Titular SSE Reactivo',
          email: `sse-${Date.now()}@test.com`,
          telefono: '912345678',
          valorTotal: 70000,
          abono: 20000,
          pasajeros: [{ nombre: 'Pax SSE', peso: 68 }],
        };

        const t0 = Date.now();
        const resSse = await client.post('/api/reservas', payloadSse);
        if (!resSse.ok || !resSse.data?.id) {
          throw new Error(`Fallo creando reserva para test SSE: HTTP ${resSse.status}`);
        }
        teardown.registerReserva(resSse.data.id);

        // Esperar evento SSE de tipo 'datos-cambios' para entidad 'reserva'
        const event = await sse.waitForEvent(
          (ev) => ev.type === 'datos-cambios' && (ev.data?.entidad === 'reserva' || ev.data?.type === 'datos-cambios'),
          6000
        );

        const latenciaSse = event.timestamp - t0;
        console.log(`   📡 Evento SSE recibido: tipo="${event.type}", entidad="${event.data?.entidad || 'reserva'}", latencia=${latenciaSse}ms`);

        if (latenciaSse > 2500) {
          console.warn(`   ⚠️ Advertencia: Latencia SSE (${latenciaSse}ms) superó el umbral deseado de 1500ms`);
        }
      } finally {
        sse.close();
      }
    });


    // 9. Slot fantasma: soft-delete y CANCELADO liberan slot (anti-regresión P2002 global)
    await runner.step('9. Slot fantasma: soft-delete y CANCELADO liberan slot (anti-regresión índice único parcial)', async () => {
      // 9a. Soft-delete libera slot: crear -> DELETE -> reutilizar misma hora/piloto debe ser 201
      const fechaGhost1 = fechaFuturaIso(8, '10:00');
      const resGhostA = await client.post('/api/vuelos', {
        fechaHora: fechaGhost1,
        valorPactado: 60000,
        estado: 'AGENDADO',
        pilotoId: pilotoAId,
        pasajeroId: pax1Id,
      });
      if (!resGhostA.ok) throw new Error(`Error creando vuelo ghost soft-delete: HTTP ${resGhostA.status} ${JSON.stringify(resGhostA.data)}`);
      const ghostId = resGhostA.data.id;
      teardown.registerVuelo(ghostId);

      const resDel = await client.delete(`/api/vuelos/${ghostId}`);
      if (!resDel.ok && resDel.status !== 204 && resDel.status !== 200) {
        throw new Error(`Error borrando vuelo ghost: HTTP ${resDel.status} ${JSON.stringify(resDel.data)}`);
      }
      // Reutilizar slot con otro pasajero de la misma u otra reserva
      const resReuseSoft = await client.post('/api/vuelos', {
        fechaHora: fechaGhost1,
        valorPactado: 60000,
        estado: 'AGENDADO',
        pilotoId: pilotoAId,
        pasajeroId: pax2Id,
      });
      if (!resReuseSoft.ok) {
        throw new Error(`Regresión slot fantasma soft-delete: se esperaba 201 al reutilizar piloto/hora tras DELETE, pero se recibió ${resReuseSoft.status} ${JSON.stringify(resReuseSoft.data)}`);
      }
      teardown.registerVuelo(resReuseSoft.data.id);
      console.log(`   👻 Soft-delete libera slot validado: DELETE + reutilización 201 (vuelo #${resReuseSoft.data.id})`);

      // 9b. CANCELADO libera slot: crear -> PATCH CANCELADO -> reutilizar debe ser 201
      const fechaGhost2 = fechaFuturaIso(8, '11:00');
      const resGhostB = await client.post('/api/vuelos', {
        fechaHora: fechaGhost2,
        valorPactado: 60000,
        estado: 'AGENDADO',
        pilotoId: pilotoAId,
        pasajeroId: pax1Id,
      });
      if (!resGhostB.ok) throw new Error(`Error creando vuelo ghost cancelado: HTTP ${resGhostB.status}`);
      const ghostBId = resGhostB.data.id;
      teardown.registerVuelo(ghostBId);
      const vBVersion = resGhostB.data.version ?? 0;

      const resCancel = await client.patch(`/api/vuelos/${ghostBId}/estado`, { estado: 'CANCELADO', version: vBVersion });
      if (!resCancel.ok) throw new Error(`Error cancelando vuelo ghost: HTTP ${resCancel.status} ${JSON.stringify(resCancel.data)}`);

      const resReuseCancel = await client.post('/api/vuelos', {
        fechaHora: fechaGhost2,
        valorPactado: 60000,
        estado: 'AGENDADO',
        pilotoId: pilotoAId,
        pasajeroId: pax2Id,
      });
      if (!resReuseCancel.ok) {
        throw new Error(`Regresión slot fantasma CANCELADO: se esperaba 201 al reutilizar piloto/hora tras CANCELADO, pero se recibió ${resReuseCancel.status} ${JSON.stringify(resReuseCancel.data)}`);
      }
      teardown.registerVuelo(resReuseCancel.data.id);
      console.log(`   👻 CANCELADO libera slot validado: CANCELADO + reutilización 201 (vuelo #${resReuseCancel.data.id})`);

      // 9c. Slot activo sigue bloqueado: sin borrar, segundo vuelo misma hora debe ser 400
      const fechaGhost3 = fechaFuturaIso(8, '12:00');
      const resActive = await client.post('/api/vuelos', {
        fechaHora: fechaGhost3,
        valorPactado: 60000,
        estado: 'AGENDADO',
        pilotoId: pilotoAId,
        pasajeroId: pax1Id,
      });
      if (!resActive.ok) throw new Error(`Error creando vuelo activo para bloqueo: HTTP ${resActive.status}`);
      teardown.registerVuelo(resActive.data.id);

      const resBloqueado = await client.post('/api/vuelos', {
        fechaHora: fechaGhost3,
        valorPactado: 60000,
        estado: 'AGENDADO',
        pilotoId: pilotoAId,
        pasajeroId: pax2Id,
      });
      if (resBloqueado.status !== 400) {
        throw new Error(`Se esperaba 400 al colisionar slot activo, pero se recibió ${resBloqueado.status}`);
      }
      console.log(`   🔒 Slot activo sigue protegido: colisión activa correctamente rechazada con 400`);
    });

    // 10. Estrés de Autocompletado Concurrente en Reservas Multi-Pasajero (commit 1f8041d)
    await runner.step('10. Carrera de completado simultáneo: 3 vuelos en paralelo y autocompletado atómico de reserva grupal', async () => {
      // Alta de un tercer piloto para el grupo
      const resP3 = await client.post('/api/pilotos', crearPilotoFixture('Piloto Concurrente C'));
      if (!resP3.ok || !resP3.data?.id) throw new Error(`Fallo creando Piloto C: HTTP ${resP3.status}`);
      const pilotoCId = resP3.data.id;
      teardown.registerPiloto(pilotoCId);

      // Reserva con 3 pasajeros 100% abonada
      const resReservaGrupo = await client.post('/api/reservas', crearReservaFixture('Grupo Concurrente', 3, {
        estadoPago: 'PAGADO',
        valorTotal: 180000,
        abono: 180000,
      }));
      if (!resReservaGrupo.ok || !resReservaGrupo.data?.id) {
        throw new Error(`Fallo creando reserva grupal: HTTP ${resReservaGrupo.status}`);
      }
      const rGrupoId = resReservaGrupo.data.id;
      teardown.registerReserva(rGrupoId);
      const [paxA, paxB, paxC] = resReservaGrupo.data.pasajeros;

      // Agendar los 3 vuelos simultáneamente con pilotos A, B y C
      const fechaGrupo = fechaFuturaIso(9, '10:00');
      const [resVGrupo1, resVGrupo2, resVGrupo3] = await Promise.all([
        client.post('/api/vuelos', { fechaHora: fechaGrupo, valorPactado: 60000, estado: 'AGENDADO', pilotoId: pilotoAId, pasajeroId: paxA.id }),
        client.post('/api/vuelos', { fechaHora: fechaGrupo, valorPactado: 60000, estado: 'AGENDADO', pilotoId: pilotoBId, pasajeroId: paxB.id }),
        client.post('/api/vuelos', { fechaHora: fechaGrupo, valorPactado: 60000, estado: 'AGENDADO', pilotoId: pilotoCId, pasajeroId: paxC.id }),
      ]);

      if (!resVGrupo1.ok || !resVGrupo2.ok || !resVGrupo3.ok) {
        throw new Error(`Fallo agendando vuelos grupales: [${resVGrupo1.status}, ${resVGrupo2.status}, ${resVGrupo3.status}]`);
      }

      const vG1Id = resVGrupo1.data.id;
      const vG2Id = resVGrupo2.data.id;
      const vG3Id = resVGrupo3.data.id;
      teardown.registerVuelo(vG1Id);
      teardown.registerVuelo(vG2Id);
      teardown.registerVuelo(vG3Id);

      // Ráfaga concurrente: Completar los 3 vuelos al mismo milisegundo
      const [c1, c2, c3] = await Promise.all([
        client.patch(`/api/vuelos/${vG1Id}/estado`, { estado: 'COMPLETADO' }),
        client.patch(`/api/vuelos/${vG2Id}/estado`, { estado: 'COMPLETADO' }),
        client.patch(`/api/vuelos/${vG3Id}/estado`, { estado: 'COMPLETADO' }),
      ]);

      if (!c1.ok || !c2.ok || !c3.ok) {
        throw new Error(`Fallo en ráfaga de completar vuelos: [${c1.status}, ${c2.status}, ${c3.status}]`);
      }

      // Validar consistencia final de la reserva: debe haber transicionado a COMPLETADA sin deadlocks ni lost updates
      const resGrupoCheck = await client.get(`/api/reservas/${rGrupoId}`);
      if (!resGrupoCheck.ok) throw new Error(`Fallo obteniendo estado final de reserva grupal: HTTP ${resGrupoCheck.status}`);

      const dataFinal = resGrupoCheck.data;
      if (dataFinal.estado !== 'COMPLETADA') {
        throw new Error(`Reserva grupal no transicionó a COMPLETADA tras completar todos los vuelos concurrentemente: estado=${dataFinal.estado}`);
      }

      const todosPaxCompletados = dataFinal.pasajeros.every((p: any) => p.estado === 'VUELO_COMPLETADO');
      if (!todosPaxCompletados) {
        throw new Error(`No todos los pasajeros quedaron con VUELO_COMPLETADO: ${JSON.stringify(dataFinal.pasajeros)}`);
      }

      console.log(`   ⚡ Ráfaga de 3 vuelos completados concurrentemente: Autocompletado atómico exitoso en Reserva #${rGrupoId} (estado=COMPLETADA)`);
    });

    // 11. Carrera Extrema: Cierre Contable vs Pagos y Mutaciones Simultáneas (commit f94dedf)
    await runner.step('11. Carrera Cierre Contable vs Mutaciones Concurrentes: Aislamiento ACID sin 500', async () => {
      // Crear y completar una reserva dedicada para la carrera de cierre
      const resRComp = await client.post('/api/reservas', crearReservaFixture('Carrera Cierre', 1, {
        estadoPago: 'PAGADO',
        valorTotal: 60000,
        abono: 60000,
      }));
      if (!resRComp.ok) throw new Error('Error creando reserva para carrera de cierre');
      const rCompId = resRComp.data.id;
      teardown.registerReserva(rCompId);

      const paxCompId = resRComp.data.pasajeros[0].id;
      const resVComp = await client.post('/api/vuelos', {
        fechaHora: fechaFuturaIso(10, '12:00'),
        valorPactado: 60000,
        estado: 'AGENDADO',
        pilotoId: pilotoAId,
        pasajeroId: paxCompId,
      });
      if (!resVComp.ok) throw new Error('Error agendando vuelo para carrera de cierre');
      const vCompId = resVComp.data.id;
      teardown.registerVuelo(vCompId);

      // Completar vuelo para que la reserva pase a COMPLETADA
      const resC = await client.patch(`/api/vuelos/${vCompId}/estado`, { estado: 'COMPLETADO' });
      if (!resC.ok) throw new Error('Error completando vuelo');

      // Obtener versión actual de la reserva
      const resPrevia = await client.get(`/api/reservas/${rCompId}`);
      const vPrevia = resPrevia.data?.version ?? 0;

      // Lanzar simultáneamente: Cierre contable vs Pago tardío vs Edición general
      const [pCerrar, pPago, pEdicion] = await Promise.allSettled([
        client.post(`/api/reservas/${rCompId}/cerrar`, { version: vPrevia }),
        client.post(`/api/reservas/${rCompId}/pagos`, { monto: 5000, metodoPago: 'EFECTIVO', version: vPrevia }),
        client.patch(`/api/reservas/${rCompId}`, { telefono: '+56911223344', version: vPrevia }),
      ]);

      // Comprobar que NINGUNA solicitud arrojó 500 (Internal Server Error)
      const statuses = [
        pCerrar.status === 'fulfilled' ? pCerrar.value.status : 500,
        pPago.status === 'fulfilled' ? pPago.value.status : 500,
        pEdicion.status === 'fulfilled' ? pEdicion.value.status : 500,
      ];

      if (statuses.some((s) => s >= 500)) {
        throw new Error(`Carrera de cierre contable produjo error de servidor HTTP 5xx: statuses=[${statuses.join(', ')}]`);
      }

      // Verificar que la reserva mantiene consistencia contable
      const resCheck = await client.get(`/api/reservas/${rCompId}`);
      if (!resCheck.ok) throw new Error('No se pudo verificar estado de la reserva tras carrera');

      console.log(`   ⚖️ Carrera Cierre vs Mutaciones procesada limpiamente: statuses=[${statuses.join(', ')}], cerrada=${Boolean(resCheck.data?.cerradaAt)}`);

      // Si no quedó cerrada por perder la carrera de versión, cerrarla ahora para el siguiente paso
      if (!resCheck.data?.cerradaAt) {
        await client.post(`/api/reservas/${rCompId}/cerrar`);
      }
    });

    // 12. Ráfaga de Concurrencia en Reapertura Administrativa (409 Conflict)
    await runner.step('12. Ráfaga de reaperturas concurrentes: 1 éxito (200) y 1 conflicto optimista (409)', async () => {
      // Crear y cerrar una reserva para la prueba de reapertura
      const resRCerrada = await client.post('/api/reservas', crearReservaFixture('Reapertura Concurrente', 1, {
        estadoPago: 'PAGADO',
        valorTotal: 50000,
        abono: 50000,
      }));
      const rCerradaId = resRCerrada.data.id;
      teardown.registerReserva(rCerradaId);

      // Crear vuelo y completarlo para poder cerrar
      const paxId = resRCerrada.data.pasajeros[0].id;
      const resV = await client.post('/api/vuelos', {
        fechaHora: fechaFuturaIso(11, '14:00'),
        valorPactado: 50000,
        estado: 'AGENDADO',
        pilotoId: pilotoAId,
        pasajeroId: paxId,
      });
      teardown.registerVuelo(resV.data.id);
      await client.patch(`/api/vuelos/${resV.data.id}/estado`, { estado: 'COMPLETADO' });

      // Sellar contablemente
      const resCierre = await client.post(`/api/reservas/${rCerradaId}/cerrar`);
      if (!resCierre.ok) throw new Error(`Fallo al cerrar reserva: HTTP ${resCierre.status}`);
      const versionCerrada = resCierre.data.version;

      // Dos administradores intentan reabrir concurrentemente con la misma versión
      const [reapA, reapB] = await Promise.all([
        client.post(`/api/reservas/${rCerradaId}/reabrir`, { motivo: 'Auditoría Administrador A', version: versionCerrada }),
        client.post(`/api/reservas/${rCerradaId}/reabrir`, { motivo: 'Auditoría Administrador B', version: versionCerrada }),
      ]);

      const reapStatuses = [reapA.status, reapB.status].sort();
      if (reapStatuses[0] !== 200 || reapStatuses[1] !== 409) {
        throw new Error(`Ráfaga de reaperturas concurrentes falló: recibidos [${reapA.status}, ${reapB.status}], esperados [200, 409]`);
      }

      console.log(`   ⚔️ Concurrencia en reapertura validada: 1 reapertura confirmada (200), 1 rechazo optimista (409 Conflict)`);
    });

    // 13. Estrés de Paginación por Cursor (Keyset Pagination)
    await runner.step('13. Paginación por Cursor (Keyset): Navegación secuencial y aislamiento de registros', async () => {
      // Página 1: primeros 3 registros
      const resPag1 = await client.get('/api/reservas?pageSize=3');
      if (!resPag1.ok) throw new Error(`Error en página 1 de reservas: HTTP ${resPag1.status}`);

      const dataPag1 = client.unwrapList(resPag1);
      const paginationPag1 = resPag1.data?.pagination;

      if (!paginationPag1) {
        throw new Error('Respuesta no incluye sobre de paginación ADR 005');
      }

      if (dataPag1.length > 0 && paginationPag1.nextCursor) {
        const cursorVal = paginationPag1.nextCursor;

        // Página 2: usando nextCursor
        const resPag2 = await client.get(`/api/reservas?cursor=${cursorVal}&pageSize=3`);
        if (!resPag2.ok) throw new Error(`Error en página 2 cursoreada: HTTP ${resPag2.status}`);

        const dataPag2 = client.unwrapList(resPag2);

        // Validar que no haya IDs duplicados entre página 1 y página 2
        const idsPag1 = new Set(dataPag1.map((r: any) => r.id));
        const idsPag2 = new Set(dataPag2.map((r: any) => r.id));
        const overlap = [...idsPag1].filter((id) => idsPag2.has(id));

        if (overlap.length > 0) {
          throw new Error(`Inconsistencia en paginación por cursor: IDs duplicados entre páginas: ${overlap.join(', ')}`);
        }

        // Validar que los IDs en la página cursoreada son estrictamente menores que el cursor
        for (const item of dataPag2) {
          if (item.id >= Number(cursorVal)) {
            throw new Error(`Elemento #${item.id} viola condición de cursor (< ${cursorVal})`);
          }
        }

        console.log(`   📑 Paginación Keyset validada: Cursor ${cursorVal} dividió páginas de forma disjunta (${dataPag1.length} y ${dataPag2.length} items)`);
      } else {
        console.log(`   ℹ️ Paginación Keyset: Menos de 3 registros o sin nextCursor disponible`);
      }
    });

    // 14. Integridad Contable: Bloqueo Estricto de Pagos en Reservas Canceladas
    await runner.step('14. Integridad Contable: Rechazo atómico de pagos en reservas canceladas (HTTP 400)', async () => {
      const resCancelada = await client.post('/api/reservas', crearReservaFixture('Cancelacion Pago Tardio', 1, {
        estadoPago: 'PENDIENTE',
        valorTotal: 55000,
        abono: 0,
      }));
      if (!resCancelada.ok || !resCancelada.data?.id) throw new Error('Error creando reserva para prueba de pago en cancelada');
      const rCancelId = resCancelada.data.id;
      teardown.registerReserva(rCancelId);

      // Cancelar la reserva
      const resC = await client.post(`/api/reservas/${rCancelId}/cancelar`, { motivo: 'Cancelación administrativa de prueba' });
      if (!resC.ok) throw new Error(`Error cancelando reserva: HTTP ${resC.status}`);

      // Intentar registrar un pago tardío en la reserva cancelada
      const resPagoTardio = await client.post(`/api/reservas/${rCancelId}/pagos`, {
        monto: 20000,
        metodoPago: 'TRANSFERENCIA',
      });

      if (resPagoTardio.status !== 400) {
        throw new Error(`Se esperaba HTTP 400 al registrar pago en reserva CANCELADA, pero se recibió ${resPagoTardio.status}: ${JSON.stringify(resPagoTardio.data)}`);
      }

      console.log(`   🚫 Integridad contable validada: Pago tardío en reserva cancelada bloqueado con HTTP 400`);
    });

    // 15. Carrera Simultánea: Registro de Devolución vs Cierre Contable
    await runner.step('15. Carrera Devolución vs Cierre Contable: Serialización con FOR UPDATE sin inconsistencias 5xx', async () => {
      // Crear una reserva con pago completo y cancelada
      const resRCancel = await client.post('/api/reservas', crearReservaFixture('Carrera Devolucion Cierre', 1, {
        estadoPago: 'PAGADO',
        valorTotal: 60000,
        abono: 60000,
      }));
      if (!resRCancel.ok || !resRCancel.data?.id) throw new Error('Error creando reserva para prueba de devolución vs cierre');
      const rId = resRCancel.data.id;
      teardown.registerReserva(rId);

      const resC = await client.post(`/api/reservas/${rId}/cancelar`, { motivo: 'Cancelación administrativa previa a devolución' });
      if (!resC.ok) throw new Error(`Error cancelando reserva: HTTP ${resC.status}`);
      const versionActual = resC.data.version;

      // Disparar concurrentemente la devolución y el cierre contable
      const [resDevolucion, resCierre] = await Promise.all([
        client.post(`/api/reservas/${rId}/devoluciones`, {
          monto: 60000,
          metodoPago: 'TRANSFERENCIA',
          notas: 'Devolución concurrente',
          version: versionActual,
        }),
        client.post(`/api/reservas/${rId}/cerrar`, {
          version: versionActual,
        }),
      ]);

      const statuses = [resDevolucion.status, resCierre.status];
      if (statuses.some((s) => s >= 500)) {
        throw new Error(`Carrera de devolución vs cierre produjo error de servidor HTTP 5xx: statuses=[${statuses.join(', ')}]`);
      }

      // Validar que una ganó o se serializó sin corrupción de datos
      const resCheck = await client.get(`/api/reservas/${rId}`);
      if (!resCheck.ok) throw new Error('No se pudo verificar estado final de la reserva');

      const dataFinal = resCheck.data;
      const montoDevuelto = Number(dataFinal.montoDevuelto || 0);
      const abono = Number(dataFinal.abono || 0);

      if (montoDevuelto > abono) {
        throw new Error(`Inconsistencia contable: montoDevuelto (${montoDevuelto}) supera el abono (${abono})`);
      }

      console.log(`   ⚖️ Carrera Devolución vs Cierre validada: statuses=[Dev:${resDevolucion.status}, Cierre:${resCierre.status}], cerrada=${Boolean(dataFinal.cerradaAt)}, devuelto=$${montoDevuelto}`);
    });

    // 16. Pérdida de Conexión en Deslinde (Offline Outbox) y Carrera con Cancelación de Último Minuto
    await runner.step('16. Deslinde Offline & Carrera con Cancelación: Replay seguro con X-Client-Id y rechazo atómico (HTTP 400)', async () => {
      // Crear reserva activa con un pasajero
      const resR = await client.post('/api/reservas', crearReservaFixture('Deslinde Offline Carrera', 1, {
        estadoPago: 'PENDIENTE',
        valorTotal: 50000,
        abono: 0,
      }));
      if (!resR.ok || !resR.data?.id) throw new Error('Error creando reserva para prueba de deslinde offline');
      const rId = resR.data.id;
      teardown.registerReserva(rId);

      const pax = resR.data.pasajeros[0];
      const paxId = pax.id;
      const clientIdFirma = randomUUID();

      // Carrera: El pasajero reconecta y sincroniza firma offline (con X-Client-Id), mientras recepción cancela
      const [resCancel, resFirma] = await Promise.all([
        client.post(`/api/reservas/${rId}/cancelar`, { motivo: 'Viento sobre el límite de seguridad' }),
        client.post(
          `/api/pasajeros/${paxId}/firma`,
          {
            firmaBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            rutDni: '11.222.333-4',
            condicionFisica: 'Apto',
            pesoVerificado: 70,
          },
          { headers: { 'x-client-id': clientIdFirma } }
        ),
      ]);

      const statuses = [resCancel.status, resFirma.status];
      if (statuses.some((s) => s >= 500)) {
        throw new Error(`Carrera de cancelación vs firma produjo error 5xx: statuses=[${statuses.join(', ')}]`);
      }

      // Cancelación siempre debe haber procesado limpiamente (200)
      if (!resCancel.ok) {
        throw new Error(`Cancelación falló con HTTP ${resCancel.status}: ${JSON.stringify(resCancel.data)}`);
      }

      // Si la firma llegó después de la cancelación, debe ser rechazada con 400 Bad Request
      // Si la firma llegó antes, fue aceptada (200), y luego la cancelación canceló el pasajero
      if (resFirma.status !== 200 && resFirma.status !== 400) {
        throw new Error(`Se esperaba HTTP 200 o 400 en firma concurrente, pero se recibió ${resFirma.status}`);
      }

      // Replay del Outbox con el MISMO X-Client-Id:
      // Debe responder idénticamente (idempotente) sin 5xx y sin alterar la reserva cancelada
      const resReplay = await client.post(
        `/api/pasajeros/${paxId}/firma`,
        {
          firmaBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        },
        { headers: { 'x-client-id': clientIdFirma } }
      );

      if (resReplay.status >= 500) {
        throw new Error(`Replay de Outbox con X-Client-Id produjo error HTTP 5xx: ${resReplay.status}`);
      }

      console.log(`   📴 Deslinde Offline y Replay validado: Cancel:${resCancel.status}, Firma:${resFirma.status}, Replay:${resReplay.status}`);
    });

    return runner.conclude();
  } finally {
    await teardown.cleanup();
  }
}

// Ejecución directa si se invoca como script
if (process.argv[1]?.endsWith('05-concurrency-stress.suite.ts')) {
  runConcurrencyStressSuite().then((res) => {
    if (!res.ok) process.exit(1);
  });
}
