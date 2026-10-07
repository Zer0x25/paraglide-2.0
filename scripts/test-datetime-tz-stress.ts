/**
 * Suite de Pruebas de Estrés y Auditoría de Fechas y Horas en Staging
 * 
 * Diseñada para reproducir, detectar y auditar exactamente los problemas reportados:
 * 1. Desplazamiento de día: reserva creada para el día 14 aparece marcada el día 13
 * 2. Desplazamiento de hora: agendamiento a las 14:00 aparece en UTC (17:00) o en otra hora en Google Calendar
 * 3. Inconsistencia en bloqueHora al persistir en agendamiento-grupo
 * 4. Generación de Feed .ics y Voucher .ics (DTSTART floating vs UTC vs TZID)
 * 5. Generación de Enlace 1-Clic Google Calendar (dates=...Z con &ctz)
 * 6. Estrés concurrente de agendamiento en diferentes horas y días
 * 
 * Ejecución:
 *   npx tsx scripts/test-datetime-tz-stress.ts
 *   STAGING_URL=http://localhost:3200 npx tsx scripts/test-datetime-tz-stress.ts
 */

const BASE_URL = (process.env.PROD_URL || process.env.STAGING_URL || 'http://localhost:3200').replace(/\/$/, '');
const API_URL = (
  process.env.API_URL ||
  process.env.STAGING_API_URL ||
  (BASE_URL.includes('parapente.zer0x.org') ? 'https://parapente.zer0x.org' : 'http://localhost:3201')
).replace(/\/$/, '');
const EMAIL = process.env.ADMIN_EMAIL || 'admin@parapente.com';
const PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const TIMEZONE = 'America/Santiago';

const createdReservaIds: number[] = [];


interface AuditDiscrepancy {
  test: string;
  expectedDate?: string;
  actualDate?: string;
  expectedTime?: string;
  actualTime?: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  description: string;
}

const discrepancies: AuditDiscrepancy[] = [];

function recordDiscrepancy(disc: AuditDiscrepancy) {
  discrepancies.push(disc);
  console.log(`\n🚨 [DISCREPANCIA DETECTADA - ${disc.severity}] ${disc.test}`);
  console.log(`   Esperado: Fecha=${disc.expectedDate ?? 'N/A'}, Hora=${disc.expectedTime ?? 'N/A'}`);
  console.log(`   Obtenido: Fecha=${disc.actualDate ?? 'N/A'}, Hora=${disc.actualTime ?? 'N/A'}`);
  console.log(`   Detalle:  ${disc.description}`);
}

async function login(): Promise<string> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`Login falló con status ${res.status}`);
  const data = await res.json();
  return data.token;
}

/** Formatea una fecha en America/Santiago a YYYY-MM-DD */
function toSantiagoDateKey(date: Date): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date); // YYYY-MM-DD
}

/** Formatea una fecha en America/Santiago a HH:mm */
function toSantiagoTime(date: Date): string {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return formatter.format(date); // HH:mm
}

async function main() {
  console.log('========================================================================');
  console.log('🧪 SUITE DE PRUEBAS DE ESTRÉS Y AUDITORÍA DE FECHA/HORA EN STAGING');
  console.log(`   API Target:  ${API_URL}`);
  console.log(`   Web Target:  ${BASE_URL}`);
  console.log(`   Zona Horaria Operacional: ${TIMEZONE}`);
  console.log('========================================================================\n');

  const token = await login();
  console.log('🔑 Autenticación exitosa en Staging.\n');

  // Obtener piloto activo para pruebas
  const pilotosRes = await fetch(`${API_URL}/api/pilotos?pageSize=5`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const pilotosData = await pilotosRes.json();
  const pilotos = pilotosData.data || pilotosData;
  if (!pilotos || pilotos.length === 0) {
    throw new Error('No hay pilotos en Staging para ejecutar la prueba');
  }
  const piloto = pilotos[0];
  console.log(`🧑‍✈️ Usando piloto de prueba: ${piloto.nombre} (ID: ${piloto.id})\n`);

  // ========================================================================
  // TEST 1: Crear reserva con fecha "2026-09-14" (día 14) y bloque "14:00"
  // Simular envío de input tipo fecha del navegador
  // ========================================================================
  console.log('------------------------------------------------------------------------');
  console.log('📌 TEST 1: Creación de Reserva para el Día 14 (2026-09-14) a las 14:00');
  console.log('------------------------------------------------------------------------');

  const fechaInput = '2026-09-14';
  const bloqueInput = '14:00';
  const titularTest1 = `Test Fecha 14 - ${Date.now()}`;

  // Caso 1A: Cliente frontend convirtiendo a ISO crudo con new Date('2026-09-14').toISOString()
  const fechaIsoCruda = new Date(fechaInput).toISOString(); // 2026-09-14T00:00:00.000Z
  console.log(`   Payload enviado: fechaReserva="${fechaIsoCruda}", bloqueHora="${bloqueInput}"`);

  const createRes1 = await fetch(`${API_URL}/api/reservas`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      nombreTitular: titularTest1,
      telefono: '+56988887777',
      email: 'test14@parapente.com',
      fechaReserva: fechaIsoCruda,
      bloqueHora: bloqueInput,
      valorTotal: 75000,
      abono: 0,
      pasajeros: [{ nombre: 'Pasajero Día 14', peso: 75 }],
    }),
  });

  if (!createRes1.ok) {
    const errText = await createRes1.text();
    throw new Error(`Error creando reserva de prueba 1: ${errText}`);
  }

  const reserva1 = await createRes1.json();
  createdReservaIds.push(reserva1.id);
  console.log(`   ✅ Reserva #${reserva1.numeroReserva} (ID: ${reserva1.id}) creada.`);
  console.log(`   DB fechaReserva: "${reserva1.fechaReserva}"`);
  console.log(`   DB bloqueHora:   "${reserva1.bloqueHora}"`);

  // Verificar cómo se interpreta la fecha devuelta en Santiago (UTC-3)
  const fechaObj1 = new Date(reserva1.fechaReserva);
  const santiagoDateKey1 = toSantiagoDateKey(fechaObj1);
  const santiagoLocaleStr1 = fechaObj1.toLocaleDateString('es-CL', { timeZone: TIMEZONE, weekday: 'long', day: 'numeric', month: 'long' });

  console.log(`   🌍 Interpretación en America/Santiago:`);
  console.log(`      Día calculado:  ${santiagoDateKey1}`);
  console.log(`      Texto formato:  "${santiagoLocaleStr1}"`);

  if (santiagoDateKey1 !== fechaInput) {
    recordDiscrepancy({
      test: 'Test 1 - Desplazamiento de Fecha en Creación de Reserva',
      expectedDate: fechaInput,
      actualDate: santiagoDateKey1,
      severity: 'CRITICAL',
      description: `La reserva creada para el día 14 (${fechaInput}) se interpreta como día 13 (${santiagoDateKey1}) en ${TIMEZONE} porque fue almacenada a medianoche UTC (${reserva1.fechaReserva}), que en UTC-3 corresponde a las 21:00 del día anterior.`,
    });
  } else {
    console.log(`   ✅ Correcto: Se mantiene en día 14 (${santiagoDateKey1})`);
  }

  // ========================================================================
  // TEST 2: Voucher Público .ics para la Reserva sin vuelos
  // ========================================================================
  console.log('\n------------------------------------------------------------------------');
  console.log('📌 TEST 2: Descarga de Voucher .ics (/api/public/calendar/reserva/:id.ics)');
  console.log('------------------------------------------------------------------------');

  // Solo identificadores no secuenciales (el id numérico ya no resuelve en rutas públicas)
  const publicId1 = reserva1.tokenPublico || reserva1.shortId;
  if (!publicId1) throw new Error('La reserva de prueba no tiene tokenPublico/shortId');
  const voucherIcsRes = await fetch(`${API_URL}/api/public/calendar/reserva/${publicId1}.ics`);
  if (!voucherIcsRes.ok) throw new Error(`Fallo descargando .ics de reserva: HTTP ${voucherIcsRes.status}`);
  const icsContent1 = await voucherIcsRes.text();

  const dtstartMatch = icsContent1.match(/DTSTART.*:(\S+)/);
  const dtstartVal = dtstartMatch ? dtstartMatch[1] : 'NO_ENCONTRADO';
  console.log(`   DTSTART en Voucher .ics: ${dtstartVal}`);

  if (dtstartVal.startsWith('20260913') || dtstartVal.includes('20260913T210000')) {
    recordDiscrepancy({
      test: 'Test 2 - Voucher .ics adelantado a la víspera (Día 13 a las 21:00)',
      expectedDate: '20260914',
      actualDate: dtstartVal,
      severity: 'CRITICAL',
      description: `El archivo .ics descargado para el pasajero contiene DTSTART:${dtstartVal}. El vuelo fue agendado para el 14, pero el calendario lo marca para las 21:00 del día 13. Además, no contempla el bloque horario de ${bloqueInput}.`,
    });
  } else if (!dtstartVal.includes('140000') && !dtstartVal.includes('170000') && bloqueInput === '14:00') {
    recordDiscrepancy({
      test: 'Test 2 - Voucher .ics no respeta el bloque horario pactado',
      expectedTime: '14:00 (140000 en local o 170000Z en UTC)',
      actualTime: dtstartVal,
      severity: 'HIGH',
      description: `El voucher .ics programa el evento en una hora que no corresponde al bloque pactado (${bloqueInput}).`,
    });
  }

  // ========================================================================
  // TEST 3: Agendamiento de Grupo en el Calendario a las 14:00
  // ========================================================================
  console.log('\n------------------------------------------------------------------------');
  console.log('📌 TEST 3: Agendamiento de Grupo a las 14:00 (POST /api/vuelos/agendamiento-grupo)');
  console.log('------------------------------------------------------------------------');

  // Usar minuto dinámico para evitar colisión con vuelos previos del test
  const testMinute = String(Math.floor(Math.random() * 50) + 10).padStart(2, '0');
  const fechaHoraSantiagoIso = `2026-09-14T17:${testMinute}:00.000Z`; // 14:XX hora Santiago
  console.log(`   Agendando grupo para fechaHora="${fechaHoraSantiagoIso}" (14:${testMinute} en Santiago)...`);

  const pax1Id = reserva1.pasajeros[0].id;
  const agendarRes = await fetch(`${API_URL}/api/vuelos/agendamiento-grupo`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      reservaId: reserva1.id,
      fechaHora: fechaHoraSantiagoIso,
      asignaciones: { [pax1Id]: piloto.id },
      version: reserva1.version,
    }),
  });

  if (!agendarRes.ok) {
    const errText = await agendarRes.text();
    throw new Error(`Fallo agendando grupo: HTTP ${agendarRes.status}: ${errText}`);
  }

  const agendarData = await agendarRes.json();
  const vuelosAgendados = agendarData.vuelos || agendarData;
  console.log(`   ✅ Vuelos creados exitosamente: ${vuelosAgendados.length}`);

  // Consultar reserva actualizada para inspeccionar bloqueHora persistido
  const getReservaUpdated = await fetch(`${API_URL}/api/reservas/${reserva1.id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const reservaActualizada = await getReservaUpdated.json();
  console.log(`   Reserva actualizada en DB:`);
  console.log(`      fechaReserva: "${reservaActualizada.fechaReserva}"`);
  console.log(`      bloqueHora:   "${reservaActualizada.bloqueHora}"`);

  if (reservaActualizada.bloqueHora === '17:00') {
    recordDiscrepancy({
      test: 'Test 3 - Inconsistencia en bloqueHora al agendar (Guarda hora UTC en vez de Local)',
      expectedTime: '14:00',
      actualTime: reservaActualizada.bloqueHora,
      severity: 'CRITICAL',
      description: `El agendamiento fue realizado a las 14:00 hora local, pero en la base de datos se guardó bloqueHora="17:00" porque el backend hizo targetDate.toISOString().slice(11, 16). Esto desalinea el calendario y muestra 17:00 en la vista de reservas.`,
    });
  } else {
    console.log(`   ✅ bloqueHora preservado como "${reservaActualizada.bloqueHora}"`);
  }

  // ========================================================================
  // TEST 4: Feed Universal iCalendar tras el Agendamiento
  // ========================================================================
  console.log('\n------------------------------------------------------------------------');
  console.log('📌 TEST 4: Sincronización en Feed Universal (/api/public/calendar/feed.ics)');
  console.log('------------------------------------------------------------------------');

  const syncRes = await fetch(`${API_URL}/api/calendar/sync-info`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const syncInfo = await syncRes.json();
  const feedIcsRes = await fetch(syncInfo.universal.httpUrl);
  const feedIcsText = await feedIcsRes.text();

  // Buscar el evento de nuestro vuelo recién creado
  const vueloCreado = vuelosAgendados[0];
  const vueloUid = `vuelo-${vueloCreado.id}@parapente.app`;
  console.log(`   Buscando evento ${vueloUid} en el feed...`);

  const eventIdx = feedIcsText.indexOf(vueloUid);
  if (eventIdx === -1) {
    throw new Error(`El vuelo recién creado ${vueloUid} no aparece en feed.ics`);
  }

  const eventSnippet = feedIcsText.slice(eventIdx, eventIdx + 400);
  const feedDtstartMatch = eventSnippet.match(/DTSTART.*:(\S+)/);
  const feedDtstart = feedDtstartMatch ? feedDtstartMatch[1] : 'DESCONOCIDO';
  console.log(`   DTSTART en feed.ics: ${feedDtstart}`);

  // ¿Qué hora ve Google Calendar si suscribe este feed?
  // Si DTSTART es "20260914T140000" (floating):
  // Si no tiene TZID o UTC, Google Calendar asume la zona del usuario o floating.
  // Pero si fue exportado como 170000, aparecerá a las 17:00.
  console.log(`   Hora reportada en el feed: ${feedDtstart}`);

  // ========================================================================
  // TEST 5: Generación de Enlace 1-Clic de Google Calendar (Voucher)
  // ========================================================================
  console.log('\n------------------------------------------------------------------------');
  console.log('📌 TEST 5: Simulación de Enlace 1-Clic de Google Calendar en Voucher');
  console.log('------------------------------------------------------------------------');

  // Simular la función handleGoogleCalendar1Click de voucher/[id]/page.tsx:
  // const fecha = reserva.fechaReserva ? new Date(reserva.fechaReserva) : new Date();
  // const formatGDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  // dates=${formatGDate(fecha)}/${formatGDate(end)}&ctz=America/Santiago
  const gcalFechaRef = reservaActualizada.fechaReserva ? new Date(reservaActualizada.fechaReserva) : new Date();
  const formatGDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const gcalStart = formatGDate(gcalFechaRef);
  const gcalEnd = formatGDate(new Date(gcalFechaRef.getTime() + 60 * 60 * 1000));
  const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&dates=${gcalStart}/${gcalEnd}&ctz=${TIMEZONE}`;

  console.log(`   URL generada para Google Calendar:`);
  console.log(`   ${gcalUrl}`);
  console.log(`   Parámetro dates: ${gcalStart} a ${gcalEnd}`);
  console.log(`   Parámetro ctz:   ${TIMEZONE}`);

  // Análisis:
  // Si gcalStart es 20260914T170000Z, Google Calendar convierte 17:00Z a America/Santiago (UTC-3) -> 14:00.
  // ¡PERO si reservaActualizada.fechaReserva fuera medianoche (20260914T000000Z),
  // Google Calendar convierte 00:00Z a America/Santiago -> 21:00 DEL DÍA 13!
  if (gcalStart.includes('T000000Z')) {
    recordDiscrepancy({
      test: 'Test 5 - Google Calendar 1-Clic abre a las 21:00 del día anterior',
      expectedTime: '14:00',
      actualTime: '21:00 del día anterior',
      severity: 'CRITICAL',
      description: `El enlace a Google Calendar usa dates=${gcalStart} con ctz=America/Santiago. Al pasar 00:00:00 UTC, Google Calendar resta 3 horas y abre la cita el día 13 a las 21:00 en lugar del día 14.`,
    });
  } else {
    console.log(`   🕒 Google Calendar interpretará ${gcalStart} en ${TIMEZONE} como:`);
    const dateConverted = new Date(gcalFechaRef);
    console.log(`      Fecha: ${toSantiagoDateKey(dateConverted)} | Hora: ${toSantiagoTime(dateConverted)}`);
  }

  // ========================================================================
  // TEST 6: Estrés Concurrente de Creación y Agendamiento (20 reservas)
  // Probar diferentes días y horas extremas (09:00, 14:00, 18:00, 21:00)
  // ========================================================================
  console.log('\n------------------------------------------------------------------------');
  console.log('📌 TEST 6: Estrés Concurrente (20 reservas en días y horas variadas)');
  console.log('------------------------------------------------------------------------');

  const diasPrueba = ['2026-09-14', '2026-09-15', '2026-09-20', '2026-10-05', '2026-12-24'];
  const horasPrueba = ['09:00', '11:30', '14:00', '16:00', '18:30'];

  interface StressItem {
    index: number;
    dia: string;
    hora: string;
    horaEsperada?: string;
    reservaId?: number;
    dbBloqueHora?: string;
    diaRecuperado?: string;
    ok: boolean;
    error?: string;
  }

  const stressItems: StressItem[] = [];
  const promesas = [];

  for (let i = 0; i < 20; i++) {
    const dia = diasPrueba[i % diasPrueba.length];
    const hora = horasPrueba[i % horasPrueba.length];
    stressItems.push({ index: i, dia, hora, ok: false });

    promesas.push(
      (async (idx: number) => {
        try {
          // Crear reserva
          const res = await fetch(`${API_URL}/api/reservas`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              nombreTitular: `Stress TZ #${idx} - ${dia} ${hora}`,
              telefono: `+569999900${String(idx).padStart(2, '0')}`,
              email: `stress_${idx}_${Date.now()}@test.com`,
              fechaReserva: `${dia}T00:00:00.000Z`,
              bloqueHora: hora,
              valorTotal: 75000,
              abono: 0,
              pasajeros: [{ nombre: `Pax Stress ${idx}`, peso: 70 + (idx % 20) }],
            }),
          });

          if (!res.ok) throw new Error(`Crear HTTP ${res.status}`);
          const rData = await res.json();
          stressItems[idx].reservaId = rData.id;
          createdReservaIds.push(rData.id);

          // Agendar
          // Calcular UTC para Santiago (-3) usando offsets dinámicos para garantizar unicidad
          const [hh, mm] = hora.split(':').map(Number);
          const baseMinutes = (mm + idx * 2) % 60;
          const dynamicMm = String(baseMinutes).padStart(2, '0');
          const randomSec = Math.floor(Math.random() * 55) + 1;
          const dynamicSs = String(randomSec).padStart(2, '0');
          const utcHh = (hh + 3) % 24;
          const diaFinal = hh + 3 >= 24 ? diasPrueba[(i + 1) % diasPrueba.length] : dia;
          const iso = `${diaFinal}T${String(utcHh).padStart(2, '0')}:${dynamicMm}:${dynamicSs}.000Z`;
          
          // La hora local agendada es HH:dynamicMm (siempre debe coincidir con bloqueHora en DB, NO utcHh)
          const horaLocalAgendada = `${String(hh).padStart(2, '0')}:${dynamicMm}`;
          stressItems[idx].horaEsperada = horaLocalAgendada;

          // Rotar entre todos los pilotos disponibles
          const assignedPiloto = pilotos[idx % pilotos.length];

          const agRes = await fetch(`${API_URL}/api/vuelos/agendamiento-grupo`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              reservaId: rData.id,
              fechaHora: iso,
              asignaciones: { [rData.pasajeros[0].id]: assignedPiloto.id },
              version: rData.version,
            }),
          });

          if (!agRes.ok) {
            const errBody = await agRes.text();
            throw new Error(`Agendar HTTP ${agRes.status}: ${errBody}`);
          }

          // Consultar resultado
          const checkRes = await fetch(`${API_URL}/api/reservas/${rData.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const checked = await checkRes.json();
          stressItems[idx].dbBloqueHora = checked.bloqueHora;

          const dObj = new Date(checked.fechaReserva);
          stressItems[idx].diaRecuperado = toSantiagoDateKey(dObj);

          stressItems[idx].ok = true;
        } catch (err: any) {
          stressItems[idx].error = err?.message || String(err);
        }
      })(i)
    );
  }

  await Promise.all(promesas);

  // Analizar resultados del estrés
  let descalcesDia = 0;
  let descalcesHora = 0;
  let exitosos = 0;

  for (const item of stressItems) {
    if (!item.ok) {
      if (item.error && exitosos === 0 && descalcesDia === 0) {
        console.log(`      ⚠️ Error en item ${item.index}: ${item.error}`);
      }
      continue;
    }
    exitosos++;
    if (item.diaRecuperado !== item.dia) {
      descalcesDia++;
    }
    if (item.dbBloqueHora !== (item.horaEsperada || item.hora)) {
      descalcesHora++;
    }
  }

  console.log(`   📊 Resultados del Estrés (20 reservas):`);
  console.log(`      Exitosas:                 ${exitosos}/20`);
  console.log(`      Descalces de Día (-1 día): ${descalcesDia}/20`);
  console.log(`      Descalces de Hora (UTC):   ${descalcesHora}/20`);

  if (descalcesHora > 0) {
    recordDiscrepancy({
      test: 'Test 6 - Corrupción Masiva de bloqueHora en Agendamiento Concurrente',
      expectedTime: 'Hora original seleccionada por el usuario (HH:mm)',
      actualTime: 'Hora UTC desplazada en +3 horas (HH:mm)',
      severity: 'CRITICAL',
      description: `El 100% de las reservas agendadas (${descalcesHora}/${exitosos}) sufrieron corrupción del campo bloqueHora, guardando la hora UTC en lugar de la hora local pactada.`,
    });
  }

  // ========================================================================
  // TEARDOWN: Limpieza de Reservas de Prueba
  // ========================================================================
  console.log(`\n🧹 [TEARDOWN] Limpiando reservas de prueba generadas...`);
  
  // Buscar también reservas de prueba creadas previamente
  try {
    const listRes = await fetch(`${API_URL}/api/reservas?pageSize=50`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const listData = await listRes.json();
    const items = listData.data || listData;
    if (Array.isArray(items)) {
      for (const item of items) {
        if (
          (item.nombreTitular?.startsWith('Stress TZ #') || item.nombreTitular?.startsWith('Test Fecha 14')) &&
          !createdReservaIds.includes(item.id)
        ) {
          createdReservaIds.push(item.id);
        }
      }
    }
  } catch {}

  let eliminadas = 0;
  for (const resId of createdReservaIds) {
    try {
      const delRes = await fetch(`${API_URL}/api/reservas/${resId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (delRes.ok) {
        eliminadas++;
      } else {
        // Si no permite DELETE directo, cancelar la reserva
        const getR = await fetch(`${API_URL}/api/reservas/${resId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const rObj = await getR.json();
        if (rObj?.version !== undefined && rObj.estado !== 'CANCELADA') {
          const canRes = await fetch(`${API_URL}/api/reservas/${resId}/cancelar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ motivo: 'Limpieza suite de estrés', version: rObj.version }),
          });
          if (canRes.ok) eliminadas++;
        }
      }
    } catch {}
  }
  console.log(`   ✅ Limpieza completada: ${eliminadas}/${createdReservaIds.length} reservas limpiadas correctamente.`);


  // ========================================================================
  // REPORTE FINAL DE AUDITORÍA
  // ========================================================================
  console.log('\n========================================================================');
  console.log(`📋 DIAGNÓSTICO FINAL DE FECHAS Y HORAS (${BASE_URL})`);
  console.log('========================================================================');

  if (discrepancies.length === 0) {
    console.log('🎉 No se detectaron anomalías. Todo está sincronizado correctamente.');
  } else {
    console.log(`⚠️ Se identificaron ${discrepancies.length} causas raíces de inconsistencia:\n`);
    discrepancies.forEach((d, idx) => {
      console.log(`${idx + 1}. [${d.severity}] ${d.test}`);
      console.log(`   Causa: ${d.description}\n`);
    });
    process.exit(1);
  }
  console.log('========================================================================\n');
}

main().catch((err) => {
  console.error('\n❌ Error fatal en la suite de auditoría:', err);
  process.exit(1);
});
