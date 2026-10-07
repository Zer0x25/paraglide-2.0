import { prisma } from '../../plugins/prisma';
import { reservasService } from '../reservas.service';
import { plantillasService } from '../plantillas.service';
import { fakerES as faker } from '@faker-js/faker';
import { resolverConfiguracion } from '@parapente/shared';

// Horario Base INDEFINIDO — 4 bloques de 1h (09:00–13:00)
const BLOQUES_INDEFINIDO = [
  { horaInicio: '09:00', horaFin: '10:00' },
  { horaInicio: '10:00', horaFin: '11:00' },
  { horaInicio: '11:00', horaFin: '12:00' },
  { horaInicio: '12:00', horaFin: '13:00' },
];

const CATEGORIAS = ['MASTER', 'SENIOR', 'STANDARD'];
const ESTADOS_PISTA = ['ABIERTA', 'ABIERTA', 'ABIERTA', 'PRECAUCION', 'CERRADA'];
const VISIBILIDAD = ['EXCELENTE', 'BUENA', 'REGULAR'];
const DIRECCIONES_VUELO = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
const METODOS_PAGO = ['TRANSFERENCIA', 'EFECTIVO', 'WEBPAY', 'TARJETA'];
const OBSERVACIONES_CLIMA = [
  'Condiciones perfectas para volar.',
  'Vientos moderados en la rampa.',
  'Ráfagas fuertes, precaución.',
  'Cielo despejado y térmica activa.',
];

const EQUIPOS_BASE = [
  { codigo: 'VELA-01', nombre: 'Ozone Magnum 3 41m2', tipo: 'VELA', marca: 'Ozone', modelo: 'Magnum 3', numeroSerie: 'OZ-M3-0001', anoFabricacion: 2021, estado: 'OPERATIVO' },
  { codigo: 'VELA-02', nombre: 'Nova Ion 7 27', tipo: 'VELA', marca: 'Nova', modelo: 'Ion 7', numeroSerie: 'NV-I7-0021', anoFabricacion: 2022, estado: 'REVISION_PENDIENTE' },
  { codigo: 'ARN-PIL-01', nombre: 'Arnés Piloto Woody Valley', tipo: 'ARNES_PILOTO', marca: 'Woody Valley', modelo: 'Nervous 3', numeroSerie: 'WV-4401', anoFabricacion: 2020, estado: 'OPERATIVO' },
  { codigo: 'ARN-PAS-01', nombre: 'Arnés Pasajero Gin Verso', tipo: 'ARNES_PASAJERO', marca: 'Gin', modelo: 'Verso', numeroSerie: 'GN-VS-0312', anoFabricacion: 2021, estado: 'OPERATIVO' },
  { codigo: 'RES-01', nombre: 'Paracaídas de Emergencia', tipo: 'PARACAIDAS_EMERGENCIA', marca: 'Gin', modelo: 'Yeti', numeroSerie: 'GN-YT-0917', anoFabricacion: 2022, estado: 'OPERATIVO' },
];

const TIPOS_MANTENIMIENTO = ['REPLEGADO_PARACAIDAS', 'TEST_POROSIDAD', 'REVISION_LINEAS', 'REPARACION', 'INSPECCION_ANUAL'];

export async function simulateData(params: { months: number; flightsPerDay: number; pilotsCount?: number }) {
  const { months, flightsPerDay, pilotsCount = 10 } = params;

  // 0. Plantillas base de WhatsApp
  await plantillasService.initSeeds();

  // 1. Pilotos
  const pilotos = await Promise.all(
    Array.from({ length: pilotsCount }).map(() =>
      prisma.piloto.create({
        data: {
          nombre: faker.person.fullName(),
          email: faker.internet.email(),
          telefono: faker.phone.number(),
          rutDni: faker.string.numeric(8) + '-' + faker.string.numeric(1),
          peso: faker.number.int({ min: 62, max: 95 }),
          tieneLicencia: true,
          numeroLicencia: `LIC-${faker.string.alphanumeric(6).toUpperCase()}`,
          fechaVencimientoLicencia: faker.helpers.arrayElement([faker.date.future({ years: 2 }), faker.date.future({ years: 2 }), faker.date.past({ years: 1 })]),
          prioridad: faker.number.int({ min: 1, max: 3 }),
          activo: true,
          categoria: faker.helpers.arrayElement(CATEGORIAS) as any,
          tarifaPorVuelo: faker.number.int({ min: 25000, max: 45000 }),
          disponibilidadTotal: true,
        },
      }),
    ),
  );

  // 2. Equipos + historial de mantenimiento (idempotente: reutiliza códigos existentes)
  const equiposExistentes = new Set(
    (await prisma.equipo.findMany({ select: { codigo: true }, where: { deletedAt: null } })).map((e) => e.codigo),
  );

  const fechaAdquisicion = new Date();
  fechaAdquisicion.setFullYear(fechaAdquisicion.getFullYear() - 2);

  const equipos = [];
  for (let i = 0; i < EQUIPOS_BASE.length; i++) {
    const e = EQUIPOS_BASE[i];
    if (equiposExistentes.has(e.codigo)) {
      // findFirst con deletedAt: null (el plugin soft-delete no cubre findUnique, ADR 006)
      const existing = await prisma.equipo.findFirst({ where: { codigo: e.codigo, deletedAt: null } });
      if (existing) {
        equipos.push(existing);
        continue;
      }
    }

    // Un código único puede estar ocupado por una fila soft-deleted (invisible para
    // findFirst con deletedAt: null): restaurarla antes de reutilizar el código,
    // porque create chocaría con el índice único.
    const equipoSoftDeleted = await prisma.equipo.findFirst({
      where: { codigo: e.codigo, deletedAt: { not: null } },
    });
    if (equipoSoftDeleted) {
      const restaurado = await prisma.equipo.update({
        where: { id: equipoSoftDeleted.id },
        data: { deletedAt: null },
      });
      equipos.push(restaurado);
      continue;
    }

    const pilotoAsignado = pilotos[i % pilotos.length];
    const fechaRevision = new Date();
    fechaRevision.setMonth(fechaRevision.getMonth() - faker.number.int({ min: 1, max: 6 }));
    const proximaRevision = new Date(fechaRevision);
    proximaRevision.setMonth(proximaRevision.getMonth() + 6);

    const equipo = await prisma.equipo.create({
      data: {
        ...e,
        tipo: e.tipo as any,
        estado: e.estado as any,
        fechaAdquisicion,
        horasVueloEstimadas: faker.number.float({ min: 20, max: 180 }),
        vuelosRealizados: faker.number.int({ min: 30, max: 400 }),
        limiteHorasInspeccion: 100,
        fechaUltimaRevision: fechaRevision,
        fechaProximaRevision: proximaRevision,
        notas: 'Equipo generado por simulador.',
        pilotoAsignadoId: pilotoAsignado.id,
      },
    });
    equipos.push(equipo);

    // Historial de mantenimientos (2 a 4 por equipo)
    const cantidadMant = faker.number.int({ min: 2, max: 4 });
    for (let m = 0; m < cantidadMant; m++) {
      const fechaMant = new Date();
      fechaMant.setMonth(fechaMant.getMonth() - faker.number.int({ min: 1, max: 18 }));
      await prisma.mantenimientoEquipo.create({
        data: {
          fecha: fechaMant,
          tipo: faker.helpers.arrayElement(TIPOS_MANTENIMIENTO),
          descripcion: 'Mantenimiento generado por simulador.',
          taller: faker.helpers.arrayElement(['Taller Local', 'Servicio Ozone', 'Taller Norte']),
          costo: faker.number.int({ min: 15000, max: 120000 }),
          equipoId: equipo.id,
        },
      });
    }
  }

  // 3. Configuración de bloques y horarios (idempotente) — INDEFINIDO con 4 bloques de 1h
  const normalizeHorarios = (horarios: { horaInicio: string; horaFin: string }[]) =>
    [...horarios].sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
  const bloquesEsperados = normalizeHorarios(BLOQUES_INDEFINIDO);

  const configsIndefinidas = await prisma.configuracionBloque.findMany({
    where: { deletedAt: null, archivada: false, fechaInicio: null, fechaFin: null, fechaExacta: null, bloqueado: false },
    include: { horarios: true },
  });

  let configBase = configsIndefinidas[0] as any;
  const horariosCoinciden = (h: { horaInicio: string; horaFin: string }[]) => {
    const norm = normalizeHorarios(h);
    if (norm.length !== bloquesEsperados.length) return false;
    return norm.every((v, i) => v.horaInicio === bloquesEsperados[i].horaInicio && v.horaFin === bloquesEsperados[i].horaFin);
  };

  if (!configBase) {
    const legacy = await prisma.configuracionBloque.findFirst({
      where: { nombre: 'Horario Regular', deletedAt: null },
      include: { horarios: true },
    });
    const legacyEsIndefinido = legacy && !legacy.archivada && legacy.fechaExacta == null && legacy.fechaInicio == null && legacy.fechaFin == null && !legacy.bloqueado;
    if (legacyEsIndefinido) {
      await prisma.horarioBloque.deleteMany({ where: { configuracionBloqueId: legacy.id } });
      configBase = await prisma.configuracionBloque.update({
        where: { id: legacy.id },
        data: {
          nombre: 'Horario Base',
          bloqueado: false,
          archivada: false,
          fechaInicio: null,
          fechaFin: null,
          fechaExacta: null,
          horarios: { create: BLOQUES_INDEFINIDO },
        },
        include: { horarios: true },
      });
    } else {
      configBase = await prisma.configuracionBloque.create({
        data: {
          nombre: 'Horario Base',
          bloqueado: false,
          horarios: { create: BLOQUES_INDEFINIDO },
        },
        include: { horarios: true },
      });
    }
  } else if (!horariosCoinciden(configBase.horarios ?? [])) {
    await prisma.horarioBloque.deleteMany({ where: { configuracionBloqueId: configBase.id } });
    configBase = await prisma.configuracionBloque.update({
      where: { id: configBase.id },
      data: {
        nombre: configBase.nombre || 'Horario Base',
        horarios: { create: BLOQUES_INDEFINIDO },
      },
      include: { horarios: true },
    });
    if (configsIndefinidas.length > 1) {
      const duplicados = configsIndefinidas.slice(1).map((c: any) => c.id);
      await prisma.configuracionBloque.updateMany({
        where: { id: { in: duplicados } },
        data: { archivada: true, archivadaEn: new Date() },
      });
    }
  }

  const configCerrado = await prisma.configuracionBloque.findFirst({ where: { nombre: 'Cerrado por mantención', deletedAt: null } });
  if (!configCerrado) {
    await prisma.configuracionBloque.create({
      data: {
        nombre: 'Cerrado por mantención',
        fechaExacta: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        bloqueado: true,
      },
    });
  }

  const todasConfigs = await prisma.configuracionBloque.findMany({
    where: { deletedAt: null },
    include: { horarios: true },
  });

  // 4. Vuelos, reservas, pagos, clima y gastos por día
  const totalDays = months * 30;
  let totalVuelos = 0;
  let totalReservas = 0;
  let totalPagos = 0;
  let totalGastos = 0;
  let totalCondiciones = 0;

  for (let dayOffset = totalDays; dayOffset >= -30; dayOffset--) {
    const currentDate = new Date();
    currentDate.setDate(currentDate.getDate() - dayOffset);
    const isPast = dayOffset >= 0;

    // Condición de pista histórica
    if (isPast) {
      const condicionTime = new Date(currentDate);
      condicionTime.setHours(8, 0, 0, 0);
      await prisma.condicionPista.create({
        data: {
          fechaHora: condicionTime,
          estadoPista: faker.helpers.arrayElement(ESTADOS_PISTA) as any,
          velocidadViento: faker.number.float({ min: 5, max: 40 }),
          rachaViento: faker.number.float({ min: 10, max: 50 }),
          direccionViento: faker.helpers.arrayElement(DIRECCIONES_VUELO),
          temperatura: faker.number.float({ min: 8, max: 32 }),
          visibilidad: faker.helpers.arrayElement(VISIBILIDAD),
          techoNubes: faker.number.int({ min: 800, max: 2500 }),
          observaciones: faker.helpers.arrayElement(OBSERVACIONES_CLIMA),
          registradoPor: 'Simulador',
        },
      });
      totalCondiciones++;
    }

    // Gasto diario de combustible
    await prisma.gasto.create({
      data: {
        fecha: currentDate,
        categoria: 'Combustible',
        monto: faker.number.int({ min: 18000, max: 26000 }),
        descripcion: 'Cargo diario de combustible (Simulador)',
      },
    });
    totalGastos++;

    // Resolver configuración del día
    const diaISO = currentDate.toISOString().slice(0, 10);
    const configDelDia = resolverConfiguracion(todasConfigs as any, `${diaISO}T12:00:00.000Z`) as any;
    const bloqueado = Boolean(configDelDia?.bloqueado);
    const horariosDelDia: { horaInicio: string; horaFin: string }[] = bloqueado ? [] : (configDelDia?.horarios ?? []);

    if (bloqueado || horariosDelDia.length === 0) {
      continue;
    }

    const usedPilotTimes = new Set<string>();
    const vuelosGenerar = Math.max(1, faker.number.int({ min: Math.floor(flightsPerDay * 0.5), max: Math.ceil(flightsPerDay * 1.5) }));

    for (let i = 0; i < vuelosGenerar; i++) {
      const estadoPago = faker.helpers.arrayElement(['PAGADO', 'ABONADO', 'PENDIENTE', 'DEVUELTO']);
      const valorTotal = faker.number.int({ min: 80000, max: 150000 });
      let abono = 0;
      let montoDevuelto = 0;
      if (estadoPago === 'DEVUELTO') {
        abono = valorTotal;
        montoDevuelto = abono;
      } else if (estadoPago === 'PAGADO') abono = valorTotal;
      else if (estadoPago === 'ABONADO') abono = faker.number.int({ min: 20000, max: valorTotal - 10000 });

      const isFuture = dayOffset < 0;
      const estadoReserva = isFuture
        ? 'AGENDADA'
        : estadoPago === 'DEVUELTO'
          ? 'CANCELADA'
          : faker.helpers.arrayElement(['COMPLETADA', 'COMPLETADA', 'COMPLETADA', 'CANCELADA']);

      const reserva = await reservasService.create({
        nombreTitular: faker.person.fullName(),
        email: faker.internet.email(),
        telefono: faker.phone.number(),
        estadoPago: estadoPago as any,
        estado: estadoReserva as any,
        ...(estadoReserva === 'CANCELADA' && {
          motivoCancelacion: 'Cancelada por el cliente (simulación)',
          fechaCancelacion: currentDate.toISOString(),
        }),
        valorTotal,
        abono,
        ...(montoDevuelto > 0 && { montoDevuelto }),
        fechaAgenda: currentDate.toISOString(),
        horaAgenda: '11:00',
        pasajeros: [
          {
            nombre: faker.person.fullName(),
            peso: faker.number.int({ min: 50, max: 100 }),
            rutDni: faker.string.numeric(8) + '-' + faker.string.numeric(1),
            condicionFisica: 'Normal',
            firmaDeslinde: true,
          },
        ],
      });
      totalReservas++;

      // El abono ya registra su Pago anidado en reservasService.create (createReserva):
      // un segundo pago.create aquí duplicaba el monto (sum(pagos) = 2×abono).
      if (abono > 0) totalPagos++;

      if (montoDevuelto > 0) {
        await prisma.devolucion.create({
          data: {
            monto: montoDevuelto,
            metodoPago: faker.helpers.arrayElement(METODOS_PAGO) as any,
            fecha: currentDate,
            comprobante: `SIM-${faker.string.numeric(6)}`,
            notas: 'Devolución generada por simulador.',
            reservaId: reserva.id,
          },
        });
      }

      const piloto = faker.helpers.arrayElement(pilotos);
      const vueloTime = new Date(currentDate);
      const hora = faker.number.int({ min: 9, max: 18 });
      const minuto = faker.helpers.arrayElement([0, 15, 30, 45]);
      vueloTime.setHours(hora, minuto, 0, 0);

      const estadoVuelo = estadoReserva === 'CANCELADA'
        ? 'CANCELADO'
        : isFuture
          ? 'AGENDADO'
          : faker.helpers.arrayElement(['COMPLETADO', 'COMPLETADO', 'COMPLETADO', 'CANCELADO']);

      await prisma.vuelo.create({
        data: {
          fechaHora: vueloTime,
          valorPactado: faker.number.int({ min: 45000, max: 65000 }),
          pagoPiloto: piloto.tarifaPorVuelo || 0,
          estado: estadoVuelo,
          reservaId: (reserva as any).id,
          pilotoId: piloto.id,
          pasajeroId: (reserva as any).pasajeros[0].id,
        },
      });
      totalVuelos++;
    }
  }

  return {
    success: true,
    message:
      `Simulación completada: ${pilotos.length} pilotos, ${equipos.length} equipos, ` +
      `${totalReservas} reservas, ${totalVuelos} vuelos, ${totalPagos} pagos, ` +
      `${totalGastos} gastos y ${totalCondiciones} condiciones de pista.`,
  };
}
