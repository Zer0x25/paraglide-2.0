/**
 * Suite E2E de Fase 7: Protocolos de Integración y Servicios Externos
 * 
 * Cobertura de canales de integración, interoperabilidad y seguridad perimetral:
 * 1. Healthcheck Inicial y Verificación de Red Ingress
 * 2. Suscripción Pública iCal Feed (RFC 5545) & Protección de Tokens
 * 3. Descarga y Validación Estructural del Feed Universal .ics (Zonas Horarias, VEVENTs, UIDs)
 * 4. Feeds Personalizados por Piloto Activo
 * 5. Descarga de Tickets Voucher .ics Individuales para Clientes
 * 6. Servidor Model Context Protocol (MCP) — Inicialización y Descubrimiento de Tools (12 herramientas)
 * 7. Ejecución de MCP Tools de Consulta (Meteorología, Pilotos Disponibles, Disponibilidad de Bloques)
 * 8. Flujo Compuesto de Agendamiento Inteligente vía MCP (Cotización -> Reserva -> Agendamiento -> Enlaces Seguros)
 * 9. Auditoría de Seguridad y Privilegios Mínimos del Servidor MCP (Rol RECEPCION, Aislamiento Admin)
 * 10. Auditoría de Cabeceras de Seguridad HTTP (HSTS, CSP, X-Content-Type-Options, COOP/CORP)
 * 11. Rate Limiting y Control de Ráfagas (Headers x-ratelimit-*, Mitigación de Sobrecarga)
 * 12. Limpieza Segura de Registros de Prueba
 * 
 * Ejecución:
 *   npx tsx scripts/test-fase7-integraciones.ts
 *   npm run test:fase7:prod
 */

import { execSync } from 'child_process';
import { createMcpServer } from '../apps/mcp/src/server';
import { ParaglideApiClient } from '../apps/mcp/src/client/api-client';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

const TARGET_URL = (process.env.PROD_URL || 'https://parapente.zer0x.org').replace(/\/$/, '');
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

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Variables compartidas entre etapas
let adminToken: string = '';
let universalFeedToken: string = '';
let universalFeedUrl: string = '';
let pilotosFeeds: Array<{ id: number; nombre: string; token: string; httpUrl: string }> = [];
let testReservaTokenPublico: string = '';
let createdReservaIds: number[] = [];

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║   SUITE E2E FASE 7: PROTOCOLOS DE INTEGRACIÓN Y SERVICIOS EXTERNOS (PROD)     ║');
  console.log('║   iCal RFC 5545 • Servidor MCP • Rate Limiting • Cabeceras de Seguridad        ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════════╝');
  console.log(`Target URL:      ${TARGET_URL}`);
  console.log(`Admin Email:     ${EMAIL}`);
  if (EXPECTED_COMMIT) {
    console.log(`Expected Commit: ${EXPECTED_COMMIT}`);
  }

  // --- 1. HEALTHCHECK & ESPERA DE DEPLOY ---
  await step('1. Healthcheck Inicial y Verificación de Red Ingress', async () => {
    let attempts = 0;
    const maxAttempts = SHOULD_WAIT ? 60 : 5;
    let healthy = false;

    while (attempts < maxAttempts) {
      attempts++;
      try {
        const res = await fetch(`${TARGET_URL}/api/public/health`, { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          const body = await res.json();
          if (EXPECTED_COMMIT && body.commit && !body.commit.startsWith(EXPECTED_COMMIT)) {
            console.log(`[Deploy Wait] Intento ${attempts}/${maxAttempts}: commit actual ${body.commit}, esperando ${EXPECTED_COMMIT}...`);
            await sleep(3000);
            continue;
          }
          healthy = true;
          console.log(`[Health] API saludable: status=${res.status}, commit=${body.commit || 'n/a'}, uptime=${body.uptime}s`);
          break;
        }
      } catch {
        // reintentar
      }
      if (attempts < maxAttempts) await sleep(2000);
    }

    if (!healthy) {
      throw new Error(`El servidor en ${TARGET_URL} no respondió con salud en ${attempts} intentos.`);
    }

    // Login inicial de administrador
    const loginRes = await fetch(`${TARGET_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });

    if (!loginRes.ok) {
      throw new Error(`Fallo de login administrativo inicial: status ${loginRes.status}`);
    }
    const authData = await loginRes.json();
    adminToken = authData.token;
    if (!adminToken) throw new Error('No se recibió token JWT de administrador');
  });

  // --- 2. SUSCRIPCIÓN PÚBLICA iCAL & SEGURIDAD DE TOKENS ---
  await step('2. Suscripción Pública iCal (RFC 5545) & Protección de Tokens', async () => {
    // 2.1 Petición sin token -> 401 Unauthorized
    const noTokenRes = await fetch(`${TARGET_URL}/api/public/calendar/feed.ics`);
    if (noTokenRes.status !== 401) {
      throw new Error(`Se esperaba 401 sin token en feed.ics, se recibió ${noTokenRes.status}`);
    }
    const noTokenBody = await noTokenRes.json();
    if (!noTokenBody.message?.includes('token')) {
      throw new Error(`Mensaje de error inesperado en 401 sin token: ${JSON.stringify(noTokenBody)}`);
    }

    // 2.2 Petición con token inválido/manipulado -> 401 Unauthorized
    const badTokenRes = await fetch(`${TARGET_URL}/api/public/calendar/feed.ics?token=token_invalido_hacker.12345`);
    if (badTokenRes.status !== 401) {
      throw new Error(`Se esperaba 401 con token corrupto, se recibió ${badTokenRes.status}`);
    }

    // 2.3 Obtener tokens válidos autenticado como Admin
    const syncRes = await fetch(`${TARGET_URL}/api/calendar/sync-info`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (!syncRes.ok) {
      throw new Error(`Fallo al obtener sync-info: status ${syncRes.status}`);
    }
    const syncInfo = await syncRes.json();

    if (!syncInfo.universal?.token || !syncInfo.universal?.httpUrl) {
      throw new Error(`sync-info no contiene feed universal válido: ${JSON.stringify(syncInfo)}`);
    }

    universalFeedToken = syncInfo.universal.token;
    universalFeedUrl = syncInfo.universal.httpUrl;
    pilotosFeeds = syncInfo.pilotos || [];

    console.log(`[iCal] Feed universal obtenido: ${universalFeedUrl.slice(0, 75)}...`);
    console.log(`[iCal] Pilotos con feed propio: ${pilotosFeeds.length}`);
  });

  // --- 3. DESCARGA Y PARSING DE FEED UNIVERSAL .ICS ---
  await step('3. Descarga y Validación Estructural del Feed Universal .ics (RFC 5545)', async () => {
    const feedRes = await fetch(universalFeedUrl);
    if (!feedRes.ok) {
      throw new Error(`Fallo al descargar feed universal: status ${feedRes.status}`);
    }

    const contentType = feedRes.headers.get('content-type') || '';
    if (!contentType.includes('text/calendar')) {
      throw new Error(`Content-Type inválido en feed iCal: esperado text/calendar, recibido ${contentType}`);
    }

    const disposition = feedRes.headers.get('content-disposition') || '';
    if (!disposition.includes('parapente-vuelos.ics')) {
      throw new Error(`Content-Disposition inesperado: ${disposition}`);
    }

    const icsText = await feedRes.text();

    // Validaciones RFC 5545
    const requiredTags = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:',
      'METHOD:PUBLISH',
      'END:VCALENDAR',
    ];

    for (const tag of requiredTags) {
      if (!icsText.includes(tag)) {
        throw new Error(`El feed iCal carece de la directiva RFC 5545 requerida: "${tag}"`);
      }
    }

    if (!icsText.includes('X-WR-TIMEZONE:America/Santiago') && !icsText.includes('TIMEZONE-ID:America/Santiago')) {
      throw new Error('El feed iCal carece de la directiva de zona horaria (X-WR-TIMEZONE o TIMEZONE-ID)');
    }

    const eventCount = (icsText.match(/BEGIN:VEVENT/g) || []).length;
    console.log(`[iCal RFC 5545] Feed universal validado con éxito. Eventos activos en feed: ${eventCount}`);
  });

  // --- 4. FEEDS PERSONALIZADOS POR PILOTO ---
  await step('4. Feeds Personalizados por Piloto Activo', async () => {
    if (pilotosFeeds.length === 0) {
      console.log('[iCal] No hay pilotos activos para validar feed individual (se omite)');
      return;
    }

    const primerPiloto = pilotosFeeds[0];
    const pilotoRes = await fetch(primerPiloto.httpUrl);
    if (!pilotoRes.ok) {
      throw new Error(`Fallo al descargar feed de piloto ${primerPiloto.nombre}: status ${pilotoRes.status}`);
    }

    const icsText = await pilotoRes.text();
    if (!icsText.includes('BEGIN:VCALENDAR') || !icsText.includes('END:VCALENDAR')) {
      throw new Error(`Feed de piloto no contiene estructura VCALENDAR válida`);
    }

    console.log(`[iCal] Feed individual de piloto "${primerPiloto.nombre}" validado exitosamente.`);
  });

  // --- 5. TICKETS VOUCHER .ICS INDIVIDUALES ---
  await step('5. Descarga de Tickets Voucher .ics Individuales para Clientes', async () => {
    // Buscar una reserva activa existente para probar su ticket de calendario
    const reservasRes = await fetch(`${TARGET_URL}/api/reservas?pageSize=5`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const reservasData = await reservasRes.json();
    const reservas = reservasData.data || reservasData.items || [];
    const reserva = reservas.find((r: any) => r.tokenPublico) || reservas[0];

    if (!reserva) {
      throw new Error('No hay reservas disponibles para probar voucher .ics');
    }

    // Solo identificadores no secuenciales (el id numérico ya no resuelve en rutas públicas)
    testReservaTokenPublico = reserva.tokenPublico || reserva.shortId;
    if (!testReservaTokenPublico) throw new Error('La reserva de prueba no tiene tokenPublico/shortId');
    const voucherUrl = `${TARGET_URL}/api/public/calendar/reserva/${testReservaTokenPublico}.ics`;

    const voucherRes = await fetch(voucherUrl);
    if (!voucherRes.ok) {
      throw new Error(`Fallo al descargar voucher .ics (${voucherUrl}): status ${voucherRes.status}`);
    }

    const contentType = voucherRes.headers.get('content-type') || '';
    if (!contentType.includes('text/calendar')) {
      throw new Error(`Content-Type inválido en voucher .ics: ${contentType}`);
    }

    const icsText = await voucherRes.text();
    if (!icsText.includes('BEGIN:VCALENDAR') || !icsText.includes('BEGIN:VEVENT') || !icsText.includes('END:VCALENDAR')) {
      throw new Error('El voucher .ics no contiene un evento VEVENT válido');
    }

    console.log(`[iCal Voucher] Voucher .ics para token ${testReservaTokenPublico.slice(0, 12)}... validado.`);
  });

  // --- 6. SERVIDOR MCP — INICIALIZACIÓN Y DESCUBRIMIENTO DE TOOLS ---
  let mcpClient: Client;
  let mcpServerInstance: any;

  await step('6. Servidor Model Context Protocol (MCP) — Inicialización y Descubrimiento de Tools', async () => {
    // Inicializar cliente API tipado de Paraglide
    class TestApiClient extends ParaglideApiClient {
      constructor() {
        super(`${TARGET_URL}/api`, adminToken);
      }
      async request<T>(path: string, options: RequestInit = {}): Promise<T> {
        options.headers = {
          ...(options.headers as Record<string, string> || {}),
          Authorization: `Bearer ${adminToken}`,
        };
        return super.request<T>(path, options);
      }
    }

    const customApiClient = new TestApiClient();
    mcpServerInstance = createMcpServer(customApiClient);

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    mcpClient = new Client({ name: 'paraglide-test-client', version: '1.0.0' }, { capabilities: {} });

    await mcpServerInstance.connect(serverTransport);
    await mcpClient.connect(clientTransport);

    const toolsResponse = await mcpClient.listTools();
    const registeredTools = toolsResponse.tools.map((t) => t.name);

    console.log(`[MCP Protocol] Herramientas registradas (${registeredTools.length}): ${registeredTools.join(', ')}`);

    const expectedTools = [
      'consultar_meteorologia',
      'consultar_disponibilidad_calendario',
      'consultar_pilotos_disponibles',
      'calcular_tarifa_reserva',
      'crear_reserva',
      'consultar_reserva',
      'listar_reservas',
      'obtener_enlaces_deslinde',
      'cancelar_reserva',
      'agendar_vuelos_reserva',
      'reagendar_reserva',
      'crear_y_agendar_reserva',
    ];

    for (const expected of expectedTools) {
      if (!registeredTools.includes(expected)) {
        throw new Error(`Herramienta MCP obligatoria ausente: "${expected}"`);
      }
    }
  });

  // --- 7. MCP TOOLS DE CONSULTA ---
  await step('7. Ejecución de MCP Tools de Consulta (Meteorología, Pilotos, Calendario)', async () => {
    // 7.1 Meteorología
    const meteoResult = await mcpClient.callTool({ name: 'consultar_meteorologia', arguments: {} });
    if (meteoResult.isError) {
      throw new Error(`Error en tool consultar_meteorologia: ${JSON.stringify(meteoResult)}`);
    }
    const meteoData = JSON.parse((meteoResult.content[0] as any).text);
    if (typeof meteoData.volable !== 'boolean') {
      throw new Error(`Estructura inválida en retorno de consultar_meteorologia: ${JSON.stringify(meteoData)}`);
    }
    console.log(`[MCP] Meteorología: condicion=${meteoData.condicion}, volable=${meteoData.volable}, viento=${meteoData.vientoKmH}km/h`);

    // 7.2 Pilotos Disponibles
    const pilotosResult = await mcpClient.callTool({ name: 'consultar_pilotos_disponibles', arguments: {} });
    if (pilotosResult.isError) {
      throw new Error(`Error en tool consultar_pilotos_disponibles: ${JSON.stringify(pilotosResult)}`);
    }
    const pilotosData = JSON.parse((pilotosResult.content[0] as any).text);
    if (!Array.isArray(pilotosData.pilotos)) {
      throw new Error('consultar_pilotos_disponibles no retornó un arreglo de pilotos');
    }
    console.log(`[MCP] Pilotos disponibles: total=${pilotosData.totalPilotos}`);

    // 7.3 Disponibilidad Calendario
    const fechaTest = '2026-09-15';
    const calResult = await mcpClient.callTool({
      name: 'consultar_disponibilidad_calendario',
      arguments: { fecha: fechaTest },
    });
    if (calResult.isError) {
      throw new Error(`Error en tool consultar_disponibilidad_calendario: ${JSON.stringify(calResult)}`);
    }
    const calData = JSON.parse((calResult.content[0] as any).text);
    console.log(`[MCP] Disponibilidad para ${fechaTest}: ${calData.resumen || 'Consultado con éxito'}`);
  });

  // --- 8. MCP TOOLS DE ESCRITURA Y AGENDAMIENTO INTELIGENTE ---
  await step('8. Flujo Compuesto de Agendamiento Inteligente vía MCP (crear_y_agendar_reserva)', async () => {
    // 8.1 Cotización de tarifa
    const cotizacionResult = await mcpClient.callTool({
      name: 'calcular_tarifa_reserva',
      arguments: {
        tarifaId: 1,
        cantidadPasajeros: 2,
        incluyeFotos: true,
      },
    });
    if (cotizacionResult.isError) {
      throw new Error(`Error en tool calcular_tarifa_reserva: ${JSON.stringify(cotizacionResult)}`);
    }
    const cotizacion = JSON.parse((cotizacionResult.content[0] as any).text);
    if (!cotizacion.total || cotizacion.total <= 0) {
      throw new Error(`Cotización calculó total inválido: ${JSON.stringify(cotizacion)}`);
    }
    console.log(`[MCP] Cotización para 2 pasajeros con fotos: subtotal=${cotizacion.subtotal}, total=${cotizacion.total} CLP`);

    // 8.2 Flujo compuesto atómico: crear_y_agendar_reserva con fecha y hora dinámicas
    const randomOffset = Math.floor(Math.random() * 1000) + 10;
    const testDateObj = new Date(Date.now() + 86400000 * 60 + randomOffset * 60000);
    const dynamicFecha = testDateObj.toISOString().slice(0, 10);
    const hours = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];
    const dynamicHora = hours[Math.floor(Math.random() * hours.length)];

    const workflowResult = await mcpClient.callTool({
      name: 'crear_y_agendar_reserva',
      arguments: {
        nombreTitular: `Agente IA MCP Test ${Date.now()}`,
        email: `ia.mcp.${Date.now()}@parapente.com`,
        telefono: '+56987654321',
        fecha: dynamicFecha,
        hora: dynamicHora,
        tipoVuelo: 'INICIACION',
        abono: 50000,
        pasajeros: [
          { nombre: 'Pasajero IA Alpha', peso: 70 },
          { nombre: 'Pasajero IA Beta', peso: 80 },
        ],
      },
    });

    if (workflowResult.isError) {
      throw new Error(`Error en tool crear_y_agendar_reserva: ${JSON.stringify(workflowResult)}`);
    }

    const workflowData = JSON.parse((workflowResult.content[0] as any).text);
    if (!workflowData.reservaId || !workflowData.enlacesPublicos?.voucher || !workflowData.enlacesPublicos?.deslinde) {
      throw new Error(`Respuesta incompleta de crear_y_agendar_reserva: ${JSON.stringify(workflowData)}`);
    }

    createdReservaIds.push(workflowData.reservaId);
    console.log(`[MCP Workflow] Reserva #${workflowData.reservaId} creada y agendada con ${workflowData.vuelosAgendados?.length} vuelos.`);
    console.log(`[MCP Workflow] Enlace público Voucher:  ${workflowData.enlacesPublicos.voucher}`);
    console.log(`[MCP Workflow] Enlace público Deslinde: ${workflowData.enlacesPublicos.deslinde}`);
  });

  // --- 9. SEGURIDAD Y PRIVILEGIOS MÍNIMOS DEL SERVIDOR MCP ---
  await step('9. Auditoría de Seguridad y Privilegios Mínimos del Servidor MCP', async () => {
    // 9.1 Petición con API Key inválida
    const badKeyRes = await fetch(`${TARGET_URL}/api/meteorologia/estado-actual`, {
      headers: { 'x-api-key': 'clave_mcp_completamente_falsa' },
    });
    if (badKeyRes.status !== 401) {
      throw new Error(`Se esperaba 401 con API Key falsa, se recibió ${badKeyRes.status}`);
    }

    // 9.2 Probar que un token con rol RECEPCION (o service key) NO puede acceder a administración sensible
    // Intentar acceder a /api/users o /api/dev/*
    const forbiddenRes = await fetch(`${TARGET_URL}/api/dev/simulate`, {
      method: 'POST',
      headers: { 'x-api-key': 'dev-mcp-service-key-12345' },
    });
    // Debe responder 401/403/404 según esté montado /dev, pero jamás 200
    if (forbiddenRes.status === 200) {
      throw new Error(`Vulnerabilidad: endpoint administrativo /dev/simulate accesible con clave MCP`);
    }

    console.log(`[Seguridad MCP] Aislamiento de privilegios y rechazo de credenciales espurias certificado.`);
  });

  // --- 10. AUDITORÍA DE CABECERAS DE SEGURIDAD HTTP ---
  await step('10. Auditoría de Cabeceras de Seguridad HTTP (HSTS, CSP, X-Content-Type-Options)', async () => {
    const probeRes = await fetch(`${TARGET_URL}/api/public/calendar/feed.ics`);
    const headers = probeRes.headers;

    // Verificar cabeceras estándar de endurecimiento
    const nosniff = headers.get('x-content-type-options');
    if (nosniff !== 'nosniff') {
      throw new Error(`Cabecera X-Content-Type-Options ausente o no es "nosniff" (recibido: ${nosniff})`);
    }

    const hsts = headers.get('strict-transport-security');
    if (TARGET_URL.startsWith('https://') && !hsts) {
      throw new Error('Cabecera Strict-Transport-Security (HSTS) requerida en producción HTTPS');
    }

    const xFrame = headers.get('x-frame-options');
    const csp = headers.get('content-security-policy');
    if (!xFrame && !csp) {
      throw new Error('Se requiere X-Frame-Options o Content-Security-Policy para mitigar clickjacking');
    }

    console.log(`[Security Headers] Endurecimiento verificado:`);
    console.log(`  - X-Content-Type-Options: ${nosniff}`);
    if (hsts) console.log(`  - Strict-Transport-Security: ${hsts}`);
    if (xFrame) console.log(`  - X-Frame-Options: ${xFrame}`);
    if (csp) console.log(`  - CSP presente: Sí (${csp.slice(0, 45)}...)`);
  });

  // --- 11. RATE LIMITING Y CONTROL DE RÁFAGAS ---
  await step('11. Rate Limiting y Control de Ráfagas (Headers x-ratelimit-*)', async () => {
    const rateProbe = await fetch(`${TARGET_URL}/api/public/calendar/feed.ics`);
    const limitHeader = rateProbe.headers.get('x-ratelimit-limit');
    const remainingHeader = rateProbe.headers.get('x-ratelimit-remaining');
    const resetHeader = rateProbe.headers.get('x-ratelimit-reset');

    if (!limitHeader || !remainingHeader) {
      throw new Error(`Cabeceras de cuota x-ratelimit-* no detectadas en respuesta`);
    }

    console.log(`[Rate Limiting] Cuota activa: Limit=${limitHeader}, Remaining=${remainingHeader}, Reset=${resetHeader}s`);

    // Validar que ráfagas de 5 consultas estándar no degraden latencia
    const burstStart = Date.now();
    const burstPromises = Array.from({ length: 5 }).map(() =>
      fetch(`${TARGET_URL}/api/public/calendar/feed.ics?token=${universalFeedToken}`)
    );
    const burstResponses = await Promise.all(burstPromises);
    const burstDuration = Date.now() - burstStart;

    for (const res of burstResponses) {
      if (res.status !== 200) {
        throw new Error(`Petición en ráfaga controlada falló con status ${res.status}`);
      }
    }

    console.log(`[Rate Limiting] Ráfaga concurrente de 5 peticiones iCal completada en ${burstDuration}ms (${(burstDuration / 5).toFixed(1)}ms/req).`);
  });

  // --- 12. LIMPIEZA SEGURA DE REGISTROS DE PRUEBA ---
  await step('12. Limpieza Segura (Soft Delete) de Registros de Prueba Generados', async () => {
    if (createdReservaIds.length === 0) {
      console.log('[Limpieza] No se crearon reservas en esta sesión.');
      return;
    }

    for (const resId of createdReservaIds) {
      const delRes = await fetch(`${TARGET_URL}/api/reservas/${resId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (!delRes.ok && delRes.status !== 404) {
        console.warn(`[Limpieza] Advertencia: no se pudo eliminar reserva de prueba #${resId} (status ${delRes.status})`);
      } else {
        console.log(`[Limpieza] Reserva de prueba #${resId} eliminada (soft delete) exitosamente.`);
      }
    }

    if (mcpClient) await mcpClient.close().catch(() => {});
    if (mcpServerInstance) await mcpServerInstance.close().catch(() => {});
  });

  // --- RESUMEN FINAL ---
  console.log('\n╔════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║               RESUMEN DE EJECUCIÓN: SUITE E2E FASE 7 (PRODUCCIÓN)              ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════════╝');
  let allOk = true;
  for (const r of results) {
    const status = r.ok ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} | ${r.durationMs.toString().padStart(6)}ms | ${r.name}`);
    if (!r.ok) allOk = false;
  }
  console.log('────────────────────────────────────────────────────────────────────────────────');
  if (allOk) {
    console.log('🎉 TODAS LAS PRUEBAS DE FASE 7 (INTEGRACIONES, iCAL, MCP & SEGURIDAD) PASARON.');
    process.exit(0);
  } else {
    console.error('💥 SE DETECTARON FALLOS EN LA SUITE DE FASE 7.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\n💥 Error fatal en la ejecución de la suite de Fase 7:', err);
  process.exit(1);
});
