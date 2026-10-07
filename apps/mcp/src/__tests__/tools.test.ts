/**
 * Tests de las tools del servidor MCP de Paraglide.
 *
 * Invocan los handlers REALES registrados en el `McpServer` mediante un
 * `Client` MCP real conectado por un transporte en memoria (patrón estándar
 * de testeo del MCP SDK) y asertan sobre el JSON que cada handler produce,
 * no sobre el valor que devuelve el mock.
 *
 * Los mocks de `ParaglideApiClient` respetan los contratos reales de la API:
 * colecciones con el sobre `{ data, pagination }` (ADR 005) tal como las
 * consume `unwrapList`, y recursos/acciones como objetos planos.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Cero ruido: silenciar los tips de dotenv v17 que `src/config.ts` imprime al
// cargar el entorno. Se ejecuta antes de los imports (hoisted) para que el
// módulo `config` ya vea la variable.
vi.hoisted(() => {
  process.env.DOTENV_CONFIG_QUIET = 'true';
});

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { fechaHoraLocalToIso } from '@parapente/shared';
import { ParaglideApiClient } from '../client/api-client';
import { mcpConfig } from '../config';
import { createMcpServer } from '../server';

type SalidaTool = Record<string, any>;

const ORIGIN_WEB = mcpConfig.webUrl.replace(/\/$/, '');

const HERRAMIENTAS_ESPERADAS = [
  'agendar_vuelos_reserva',
  'calcular_tarifa_reserva',
  'cancelar_reserva',
  'consultar_contacto_escuela',
  'consultar_disponibilidad_calendario',
  'consultar_meteorologia',
  'consultar_pilotos_disponibles',
  'consultar_preguntas_frecuentes',
  'consultar_promociones_activas',
  'consultar_reglas_operativas',
  'consultar_reserva',
  'crear_reserva',
  'crear_y_agendar_reserva',
  'desagendar_reserva',
  'listar_reservas',
  'obtener_enlaces_deslinde',
  'reagendar_reserva',
];

/** Texto de la primera entrada de contenido del resultado MCP. */
function textoDe(res: unknown): string {
  const bloque = (res as { content?: Array<{ type?: string; text?: string }> }).content?.[0];
  if (!bloque || bloque.type !== 'text' || typeof bloque.text !== 'string') {
    throw new Error('La tool no retornó contenido de texto');
  }
  return bloque.text;
}

/** Resultado exitoso de una tool, parseado como JSON. */
function salidaDe(res: unknown): SalidaTool {
  expect((res as { isError?: boolean }).isError).not.toBe(true);
  return JSON.parse(textoDe(res)) as SalidaTool;
}

function crearMockApi(): ParaglideApiClient {
  return {
    // --- Meteorología (contrato real GET /meteorologia/estado-actual, CondicionPista) ---
    getMeteorologia: vi.fn().mockResolvedValue({
      id: 1,
      fechaHora: '2026-09-04T10:00:00.000Z',
      estadoPista: 'ABIERTA',
      velocidadViento: 14,
      rachaViento: 18,
      direccionViento: 'SO',
      temperatura: 19,
      visibilidad: 'EXCELENTE',
      techoNubes: 1800,
      observaciones: 'Condiciones ideales para despegue',
      registradoPor: 'Director de Vuelo',
    }),

    // --- Bloques y disponibilidad ---
    resolverBloques: vi.fn().mockResolvedValue({
      '2026-09-10': {
        configuracionId: 1,
        nombre: 'Temporada Alta',
        bloqueado: false,
        horarios: [
          { horaInicio: '09:00', horaFin: '10:00' },
          { horaInicio: '10:00', horaFin: '11:00' },
          { horaInicio: '11:00', horaFin: '12:00' },
        ],
      },
    }),
    // 13:00Z = 10:00 America/Santiago: cae en el bloque 10:00-11:00.
    getVuelos: vi.fn().mockResolvedValue({
      data: [
        {
          id: 101,
          fechaHora: fechaHoraLocalToIso('2026-09-10', '10:00'),
          estado: 'AGENDADO',
          pilotoId: 1,
          pasajeroId: 1,
        },
      ],
      pagination: { page: 1, pageSize: 50, total: 1, totalPages: 1, hasMore: false },
    }),
    getPilotos: vi.fn().mockResolvedValue({
      data: [
        { id: 1, nombre: 'Rodrigo Morales', activo: true, categoria: 'MASTER', disponibilidadTotal: true },
        { id: 2, nombre: 'Camila Sepúlveda', activo: true, categoria: 'SENIOR', disponibilidadTotal: true },
      ],
      pagination: { page: 1, pageSize: 50, total: 2, totalPages: 1, hasMore: false },
    }),

    // --- Tarifas (respuesta de POST /reservas/calcular-valor) ---
    calcularTarifa: vi.fn().mockResolvedValue({
      precioBase: 150000,
      descuento: 15000,
      valorTotal: 135000,
      detalle: 'Vuelo Standard x2 - Primavera (10%)',
    }),

    // --- Reservas ---
    crearReserva: vi.fn().mockResolvedValue({
      id: 42,
      tokenPublico: 'tok_abc123',
      shortId: 'RES-42',
      nombreTitular: 'Ana Gómez',
      estado: 'SIN_AGENDAR',
      estadoPago: 'PENDIENTE',
      valorTotal: 135000,
      version: 1,
      pasajeros: [{ id: 201, nombre: 'Ana Gómez' }, { id: 202, nombre: 'Pedro Gómez' }],
    }),
    getReserva: vi.fn().mockResolvedValue({
      id: 42,
      tokenPublico: 'tok_abc123',
      shortId: 'RES-42',
      nombreTitular: 'Ana Gómez',
      email: 'ana@example.com',
      telefono: '+56911112222',
      estado: 'SIN_AGENDAR',
      estadoPago: 'PENDIENTE',
      valorTotal: 135000,
      abono: 0,
      version: 1,
      pasajeros: [
        { id: 201, nombre: 'Ana Gómez', peso: 65, deslindeFirmado: false, vuelos: [] },
        { id: 202, nombre: 'Pedro Gómez', peso: 75, deslindeFirmado: false, vuelos: [] },
      ],
      pagos: [],
    }),
    // Sobre ADR 005: { data, pagination }. Un sobre tipo `{ items }` haría que
    // `unwrapList` resolviera a `[]` y la tool listara vacío contra la API real.
    listarReservas: vi.fn().mockResolvedValue({
      data: [
        {
          id: 42,
          nombreTitular: 'Ana Gómez',
          estado: 'SIN_AGENDAR',
          estadoPago: 'PENDIENTE',
          valorTotal: 135000,
          pasajeros: [{}, {}],
        },
      ],
      pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1, hasMore: false },
    }),
    cancelarReserva: vi.fn().mockResolvedValue({ success: true, cancelada: true }),
    desagendarReserva: vi.fn().mockResolvedValue({
      id: 42,
      estado: 'SIN_AGENDAR',
      vuelosEliminados: 2,
      version: 2,
    }),

    // --- Consultas públicas (arreglos simples, igual que GET /public/*) ---
    getFaqs: vi.fn().mockResolvedValue([
      { id: 1, pregunta: '¿Qué ropa debo usar?', respuesta: 'Ropa cómoda y zapatillas deportivas.', categoria: 'VUELO' },
      { id: 2, pregunta: '¿Cuál es el peso máximo?', respuesta: 'El límite máximo por pasajero es 120 kg.', categoria: 'SEGURIDAD' },
    ]),
    getReglasOperativas: vi.fn().mockResolvedValue([
      { id: 1, titulo: 'Límite de Peso', descripcion: 'Máximo 120 kg.', categoria: 'SEGURIDAD' },
    ]),
    getEmpresa: vi.fn().mockResolvedValue({
      nombre: 'Parapente Iquique',
      telefono: '+56912345678',
      email: 'contacto@parapente.cl',
    }),
    getPromociones: vi.fn().mockResolvedValue({
      data: [{ id: 1, nombre: 'Primavera', codigo: 'PRIMAVERA26', activa: true }],
      pagination: { page: 1, pageSize: 50, total: 1, totalPages: 1, hasMore: false },
    }),

    // --- Agendamiento ---
    agendarGrupo: vi.fn().mockResolvedValue({
      success: true,
      vuelos: [
        {
          id: 301,
          fechaHora: '2026-09-10T10:00:00.000Z',
          pasajeroId: 201,
          pilotoId: 1,
          estado: 'AGENDADO',
          pasajero: { nombre: 'Ana Gómez' },
          piloto: { nombre: 'Rodrigo Morales' },
        },
        {
          id: 302,
          fechaHora: '2026-09-10T10:00:00.000Z',
          pasajeroId: 202,
          pilotoId: 2,
          estado: 'AGENDADO',
          pasajero: { nombre: 'Pedro Gómez' },
          piloto: { nombre: 'Camila Sepúlveda' },
        },
      ],
    }),
  } as unknown as ParaglideApiClient;
}

describe('Paraglide MCP Server Tools', () => {
  let api: ParaglideApiClient;
  let server: McpServer;
  let client: Client;

  beforeEach(async () => {
    api = crearMockApi();
    server = createMcpServer(api);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: 'test-client', version: '0.0.0' });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  });

  afterEach(async () => {
    await client.close();
    await server.close();
  });

  it('createMcpServer instancia el servidor y registra las herramientas esperadas', async () => {
    expect(server).toBeDefined();

    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([...HERRAMIENTAS_ESPERADAS].sort());
    expect(tools).toHaveLength(HERRAMIENTAS_ESPERADAS.length);
  });

  it('consultar_meteorologia retorna los datos meteorológicos sanitizados', async () => {
    const salida = salidaDe(await client.callTool({ name: 'consultar_meteorologia', arguments: {} }));

    // El mapping se hace desde el contrato real (estadoPista/velocidadViento/
    // rachaViento/observaciones/fechaHora), no desde campos inventados.
    expect(salida).toMatchObject({
      condicion: 'ABIERTA',
      volable: true,
      vientoKmH: 14,
      rafagasKmH: 18,
      direccionViento: 'SO',
      recomendacion: 'Condiciones ideales para despegue',
      temperatura: 19,
      ultimaActualizacion: '2026-09-04T10:00:00.000Z',
    });
    // Sanitización: solo se exponen los campos normalizados.
    expect(Object.keys(salida).sort()).toEqual([
      'condicion',
      'direccionViento',
      'rafagasKmH',
      'recomendacion',
      'temperatura',
      'ultimaActualizacion',
      'vientoKmH',
      'volable',
    ]);
  });

  it('consultar_disponibilidad_calendario calcula los cupos libres descontando los vuelos agendados', async () => {
    const salida = salidaDe(
      await client.callTool({ name: 'consultar_disponibilidad_calendario', arguments: { fecha: '2026-09-10' } })
    );

    expect(salida).toMatchObject({
      fecha: '2026-09-10',
      bloqueadoPorAdmin: false,
      nombreConfiguracion: 'Temporada Alta',
      totalPilotosActivos: 2,
      totalVuelosDelDia: 1,
      resumen: 'Hay 3 bloques con cupos libres.',
    });
    // Capacidad por bloque = 2 pilotos activos; el vuelo de las 10:00 ocupa 1 cupo.
    expect(salida.bloques).toEqual([
      { hora: '09:00', horaFin: '10:00', capacidadTotal: 2, vuelosAgendados: 0, cuposDisponibles: 2, disponible: true },
      { hora: '10:00', horaFin: '11:00', capacidadTotal: 2, vuelosAgendados: 1, cuposDisponibles: 1, disponible: true },
      { hora: '11:00', horaFin: '12:00', capacidadTotal: 2, vuelosAgendados: 0, cuposDisponibles: 2, disponible: true },
    ]);
    expect(vi.mocked(api.getVuelos).mock.calls[0][0]).toEqual({
      desde: '2026-09-10',
      hasta: '2026-09-10',
      campos: 'vista-calendario',
    });
  });

  it('calcular_tarifa_reserva retorna el desglose con descuento y valor por pasajero', async () => {
    const salida = salidaDe(
      await client.callTool({
        name: 'calcular_tarifa_reserva',
        arguments: { tarifaId: 1, promocionId: 2, cantidadPasajeros: 2 },
      })
    );

    expect(salida).toMatchObject({
      tarifaId: 1,
      promocionId: 2,
      cantidadPasajeros: 2,
      subtotal: 150000,
      descuento: 15000,
      total: 135000,
      valorPorPasajero: 67500,
      detalle: 'Vuelo Standard x2 - Primavera (10%)',
      moneda: 'CLP',
    });
    expect(vi.mocked(api.calcularTarifa).mock.calls[0][0]).toEqual({
      tarifaId: 1,
      promocionId: 2,
      cantidadPasajeros: 2,
    });
  });

  it('crear_reserva retorna identificadores públicos y enlaces seguros de voucher y deslinde', async () => {
    const salida = salidaDe(
      await client.callTool({
        name: 'crear_reserva',
        arguments: {
          nombreTitular: 'Ana Gómez',
          email: 'ana@example.com',
          telefono: '+56911112222',
          valorTotal: 135000,
          abono: 50000,
          pasajeros: [
            { nombre: 'Ana Gómez', peso: 65 },
            { nombre: 'Pedro Gómez', peso: 75 },
          ],
        },
      })
    );

    expect(salida).toMatchObject({
      id: 42,
      tokenPublico: 'tok_abc123',
      shortId: 'RES-42',
      nombreTitular: 'Ana Gómez',
      totalPasajeros: 2,
      estado: 'SIN_AGENDAR',
      estadoPago: 'PENDIENTE',
      valorTotal: 135000,
      version: 1,
      enlacesPublicos: {
        voucher: `${ORIGIN_WEB}/voucher/RES-42`,
        deslinde: `${ORIGIN_WEB}/deslinde/RES-42`,
      },
    });
    expect(salida.mensaje).toContain('Reserva #42');
    // Identificadores públicos no secuenciales: jamás se expone el id numérico.
    expect(salida.enlacesPublicos.voucher).not.toContain('/voucher/42');
    expect(salida.enlacesPublicos.deslinde).not.toContain('/deslinde/42');
  });

  it('listar_reservas consume el sobre { data, pagination } del contrato ADR 005', async () => {
    const salida = salidaDe(
      await client.callTool({
        name: 'listar_reservas',
        arguments: { estado: 'SIN_AGENDAR', page: 1, pageSize: 10 },
      })
    );

    expect(salida).toMatchObject({ total: 1, totalPages: 1, page: 1, pageSize: 10 });
    expect(salida.items).toHaveLength(1);
    expect(salida.items[0]).toMatchObject({
      id: 42,
      nombreTitular: 'Ana Gómez',
      estado: 'SIN_AGENDAR',
      estadoPago: 'PENDIENTE',
      valorTotal: 135000,
      cantidadPasajeros: 2,
    });
    expect(vi.mocked(api.listarReservas).mock.calls[0][0]).toMatchObject({
      estado: 'SIN_AGENDAR',
      page: 1,
      pageSize: 10,
    });
  });

  it('desagendar_reserva devuelve la reserva a SIN_AGENDAR y reporta los vuelos liberados', async () => {
    const salida = salidaDe(
      await client.callTool({ name: 'desagendar_reserva', arguments: { reservaId: 42 } })
    );

    expect(salida).toMatchObject({
      reservaId: 42,
      estado: 'SIN_AGENDAR',
      vuelosLiberados: 2,
      version: 2,
    });
    expect(salida.mensaje).toContain('desagendada');
    // Control optimista: sin versión explícita la tool consulta la versión actual.
    expect(vi.mocked(api.getReserva).mock.calls[0][0]).toBe(42);
    expect(vi.mocked(api.desagendarReserva).mock.calls[0]).toEqual([42, { version: 1 }]);
  });

  it('agendar_vuelos_reserva normaliza la hora local y asigna pilotos a los vuelos', async () => {
    const salida = salidaDe(
      await client.callTool({
        name: 'agendar_vuelos_reserva',
        arguments: { reservaId: 42, fechaHora: '2026-09-10 11:00' },
      })
    );

    expect(salida).toMatchObject({ totalVuelosAgendados: 2, estadoReserva: 'AGENDADA' });
    expect(salida.vuelos).toEqual([
      {
        vueloId: 301,
        fechaHora: '2026-09-10T10:00:00.000Z',
        pasajero: 'Ana Gómez',
        piloto: 'Rodrigo Morales',
        estado: 'AGENDADO',
      },
      {
        vueloId: 302,
        fechaHora: '2026-09-10T10:00:00.000Z',
        pasajero: 'Pedro Gómez',
        piloto: 'Camila Sepúlveda',
        estado: 'AGENDADO',
      },
    ]);
    // '2026-09-10 11:00' es hora local America/Santiago (UTC-3): debe viajar como ISO UTC.
    expect(vi.mocked(api.agendarGrupo).mock.calls[0][0]).toEqual({
      reservaId: 42,
      fechaHora: '2026-09-10T14:00:00.000Z',
      valorPactadoPorPasajero: undefined,
      asignaciones: undefined,
      version: 1,
    });
  });

  it('crear_y_agendar_reserva calcula el valor pactado por pasajero sin inventar un precio fallback', async () => {
    const salida = salidaDe(
      await client.callTool({
        name: 'crear_y_agendar_reserva',
        arguments: {
          nombreTitular: 'Ana Gómez',
          email: 'ana@example.com',
          telefono: '+56911112222',
          fecha: '2026-09-10',
          hora: '11:00',
          abono: 30000,
          pasajeros: [
            { nombre: 'Ana Gómez', peso: 65 },
            { nombre: 'Pedro Gómez', peso: 75 },
          ],
        },
      })
    );

    expect(salida).toMatchObject({
      reservaId: 42,
      tokenPublico: 'tok_abc123',
      shortId: 'RES-42',
      titular: 'Ana Gómez',
      totalPasajeros: 2,
      valorTotal: 135000,
      abono: 30000,
      saldoPendiente: 105000,
      estadoReserva: 'AGENDADA',
      estadoPago: 'ABONADO',
    });

    // La reserva se crea con el valor cotizado, jamás con un precio inventado.
    expect(vi.mocked(api.crearReserva).mock.calls[0][0]).toMatchObject({
      valorTotal: 135000,
      descuento: 15000,
      abono: 30000,
      estado: 'SIN_AGENDAR',
    });

    // Regresión vigilada (fix del fallback de 75000): el valor pactado por
    // pasajero se computa SIEMPRE del total cotizado (135000 / 2 = 67500).
    const argsAgendamiento = vi.mocked(api.agendarGrupo).mock.calls[0][0];
    expect(argsAgendamiento.valorPactadoPorPasajero).toBe(67500);
    expect(argsAgendamiento.valorPactadoPorPasajero).not.toBe(75000);
    expect(argsAgendamiento).toMatchObject({
      reservaId: 42,
      fechaHora: fechaHoraLocalToIso('2026-09-10', '11:00'),
      version: 1,
    });
  });

  it('crear_y_agendar_reserva aborta antes de crear la reserva si la cotización falla', async () => {
    vi.mocked(api.calcularTarifa).mockRejectedValueOnce(new Error('Tarifa no encontrada'));

    const resultado = await client.callTool({
      name: 'crear_y_agendar_reserva',
      arguments: {
        nombreTitular: 'Ana Gómez',
        fecha: '2026-09-10',
        hora: '11:00',
        pasajeros: [{ nombre: 'Ana Gómez' }],
      },
    });

    expect(resultado.isError).toBe(true);
    const texto = textoDe(resultado);
    expect(texto).toContain('No se pudo cotizar la tarifa');
    expect(texto).toContain('Tarifa no encontrada');
    // El flujo se detiene ANTES de crear la reserva (sin precio inventado).
    expect(api.crearReserva).not.toHaveBeenCalled();
    expect(api.agendarGrupo).not.toHaveBeenCalled();
  });

  it('obtener_enlaces_deslinde usa identificadores no secuenciales (shortId/tokenPublico)', async () => {
    const salida = salidaDe(
      await client.callTool({ name: 'obtener_enlaces_deslinde', arguments: { reservaId: 42 } })
    );

    expect(salida).toMatchObject({
      reservaId: 42,
      titular: 'Ana Gómez',
      enlaceDeslindePublico: `${ORIGIN_WEB}/deslinde/RES-42`,
      enlaceVoucherPublico: `${ORIGIN_WEB}/voucher/RES-42`,
    });
    expect(salida.pasajeros).toEqual([
      {
        pasajeroId: 201,
        nombre: 'Ana Gómez',
        deslindeFirmado: false,
        enlaceDirectoFirma: `${ORIGIN_WEB}/deslinde/RES-42`,
      },
      {
        pasajeroId: 202,
        nombre: 'Pedro Gómez',
        deslindeFirmado: false,
        enlaceDirectoFirma: `${ORIGIN_WEB}/deslinde/RES-42`,
      },
    ]);
    // El enlace público usa el shortId, nunca el id numérico secuencial.
    expect(salida.enlaceDeslindePublico).not.toContain('/deslinde/42');
  });

  it('consultar_preguntas_frecuentes filtra por categoría y término de búsqueda', async () => {
    const todas = salidaDe(
      await client.callTool({ name: 'consultar_preguntas_frecuentes', arguments: {} })
    );
    expect(todas.total).toBe(2);
    expect(todas.faqs.map((f: any) => f.id)).toEqual([1, 2]);

    const porCategoria = salidaDe(
      await client.callTool({
        name: 'consultar_preguntas_frecuentes',
        arguments: { categoria: 'SEGURIDAD' },
      })
    );
    expect(porCategoria.total).toBe(1);
    expect(porCategoria.faqs[0]).toMatchObject({
      id: 2,
      categoria: 'SEGURIDAD',
      pregunta: '¿Cuál es el peso máximo?',
      respuesta: 'El límite máximo por pasajero es 120 kg.',
    });

    const porBusqueda = salidaDe(
      await client.callTool({
        name: 'consultar_preguntas_frecuentes',
        arguments: { buscar: 'ropa' },
      })
    );
    expect(porBusqueda.total).toBe(1);
    expect(porBusqueda.faqs[0].id).toBe(1);

    const sinResultados = salidaDe(
      await client.callTool({
        name: 'consultar_preguntas_frecuentes',
        arguments: { categoria: 'PAGO' },
      })
    );
    expect(sinResultados).toEqual({ total: 0, faqs: [] });
  });

  it('las consultas de recepción exponen reglas operativas, contacto y promociones activas', async () => {
    const reglas = salidaDe(
      await client.callTool({ name: 'consultar_reglas_operativas', arguments: {} })
    );
    expect(reglas.totalReglas).toBe(1);
    expect(reglas.reglas[0]).toMatchObject({
      id: 1,
      titulo: 'Límite de Peso',
      descripcion: 'Máximo 120 kg.',
      categoria: 'SEGURIDAD',
      obligatorio: true,
    });

    const contacto = salidaDe(
      await client.callTool({ name: 'consultar_contacto_escuela', arguments: {} })
    );
    expect(contacto).toMatchObject({
      nombre: 'Parapente Iquique',
      telefono: '+56912345678',
      email: 'contacto@parapente.cl',
    });

    const promos = salidaDe(
      await client.callTool({ name: 'consultar_promociones_activas', arguments: {} })
    );
    expect(promos.total).toBe(1);
    expect(promos.promociones[0]).toMatchObject({
      id: 1,
      nombre: 'Primavera',
      codigo: 'PRIMAVERA26',
    });
  });

  it('consultar_reserva retorna isError con mensaje claro cuando la API falla', async () => {
    vi.mocked(api.getReserva).mockRejectedValueOnce(new Error('Reserva no encontrada en la API'));

    const resultado = await client.callTool({
      name: 'consultar_reserva',
      arguments: { reservaId: 999 },
    });

    expect(resultado.isError).toBe(true);
    expect(textoDe(resultado)).toBe('Error al consultar reserva: Reserva no encontrada en la API');
  });

  it('agendar_vuelos_reserva reporta el conflicto de concurrencia (409) como error controlado', async () => {
    vi.mocked(api.agendarGrupo).mockRejectedValueOnce(
      Object.assign(new Error('La versión de la reserva cambió'), { status: 409 })
    );

    const resultado = await client.callTool({
      name: 'agendar_vuelos_reserva',
      arguments: { reservaId: 42, fechaHora: '2026-09-10T14:00:00.000Z', version: 1 },
    });

    expect(resultado.isError).toBe(true);
    expect(textoDe(resultado)).toContain('Conflicto de concurrencia (409)');
  });
});
