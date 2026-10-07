import { prisma } from '../../plugins/prisma';
import { Prisma } from '@prisma/client';
import crypto from 'crypto';
import {
  CreateReservaPayload,
  UpdateReservaPayload,
  PasajeroDTO,
  derivarEstadoPago,
} from '@parapente/shared';
import { checkVersion, ConflictError } from '../concurrencia.service';
import { broadcastDatos } from '../eventos.service';
import { toNum } from '../money.util';
import { calcularValor } from './reservas.precios';

/**
 * Normaliza nombres eliminando tildes/diacríticos, espacios redundantes y convirtiendo a minúsculas.
 * Ej: "  Sebastián  Pérez  " -> "sebastian perez"
 */
export function normalizarNombre(nombre: string | null | undefined): string {
  if (!nombre) return '';
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Normaliza RUT/DNI eliminando puntos, guiones y espacios.
 * Ej: "12.345.678-K" -> "12345678k"
 */
export function normalizarRut(rut: string | null | undefined): string {
  if (!rut) return '';
  return rut.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

/**
 * Determina si dos representaciones de un pasajero corresponden a la misma persona:
 * La identidad legal está definida por su Nombre y RUT/DNI.
 */
export function esMismaPersona(
  a: { nombre: string; rutDni?: string | null },
  b: { nombre: string; rutDni?: string | null }
): boolean {
  const normNombreA = normalizarNombre(a.nombre);
  const normNombreB = normalizarNombre(b.nombre);
  const normRutA = normalizarRut(a.rutDni);
  const normRutB = normalizarRut(b.rutDni);

  if (!normNombreA || !normNombreB) return false;

  // Si ambos tienen RUT registrado
  if (normRutA && normRutB) {
    // Si los RUTs son distintos, son personas legalmente diferentes
    if (normRutA !== normRutB) return false;
    // Mismo RUT: los nombres deben coincidir
    return normNombreA === normNombreB;
  }

  // Si uno o ambos no tienen RUT, la identidad se valida por nombre
  return normNombreA === normNombreB;
}

export async function generarNumeroReserva(): Promise<string> {
  const today = new Date();
  const year = today.getFullYear().toString().slice(-2);
  const month = (today.getMonth() + 1).toString().padStart(2, '0');
  const day = today.getDate().toString().padStart(2, '0');
  const datePrefix = `${year}${month}${day}`; // AAMMDD — día de creación (control consecuente)

  // Buscar todas las reservas del día (incluyendo soft-deleted) con queryRaw para
  // calcular con precisión el siguiente correlativo y evitar colisiones únicas P2002
  const reservasDia = await prisma.$queryRaw<{ numeroReserva: string | null }[]>`
    SELECT "numeroReserva" FROM "Reserva" WHERE "numeroReserva" LIKE ${datePrefix + '%'}
  `;

  let maxCorrelative = 0;
  for (const r of reservasDia) {
    if (!r.numeroReserva) continue;
    if (r.numeroReserva.includes('-')) {
      const parts = r.numeroReserva.split('-');
      const num = parseInt(parts[1], 10);
      if (!isNaN(num) && num > maxCorrelative) maxCorrelative = num;
    } else if (r.numeroReserva.length >= 8) {
      const num = parseInt(r.numeroReserva.slice(6), 10);
      if (!isNaN(num) && num > maxCorrelative) maxCorrelative = num;
    }
  }

  const correlativeStr = (maxCorrelative + 1).toString().padStart(2, '0');
  return `${datePrefix}-${correlativeStr}`;
}

export async function createReserva(data: CreateReservaPayload) {
  // Fase 1: estadoPago es SIEMPRE derivado de los montos (valorTotal, abono, montoDevuelto).
  const raw = data as any;
  const montoDevuelto = toNum(raw.montoDevuelto ?? 0);
  // Abono inicial normalizado (misma regla que la fila creada: NaN/negativo → 0),
  // para que la derivación de estadoPago no use un monto que no se persiste.
  const montoAbonoInicial = Number(data.abono);
  const abonoInicialValido = !isNaN(montoAbonoInicial) && montoAbonoInicial > 0;
  const abonoNormalizado = abonoInicialValido ? montoAbonoInicial : 0;
  // Fase 2: invariante de negocio — no se puede devolver más de lo pagado,
  // incluso en la creación (simulador/agente).
  if (montoDevuelto > abonoNormalizado) {
    throw new Error('No se puede devolver más de lo pagado');
  }
  const finalEstadoPago = derivarEstadoPago(toNum(data.valorTotal), abonoNormalizado, montoDevuelto);

  // Fase 2: campos opcionales de tarificación.
  const tarifaId: number | undefined = typeof raw.tarifaId === 'number' ? raw.tarifaId : undefined;
  const promocionId: number | undefined = typeof raw.promocionId === 'number' ? raw.promocionId : undefined;
  let valorTotalFinal = toNum(data.valorTotal);
  let descuentoFinal: number | undefined;

  if (tarifaId !== undefined) {
    // Server manda: recalcula con la tarifa/promoción vigentes e ignora el
    // valorTotal del cliente si difiere.
    const calculo = await calcularValor({ tarifaId, promocionId, cantidadPasajeros: Math.max(1, data.pasajeros?.length ?? 1) });
    valorTotalFinal = calculo.valorTotal;
    descuentoFinal = calculo.descuento;
  }
  if (descuentoFinal === undefined && typeof raw.descuento === 'number') {
    descuentoFinal = raw.descuento;
  }

  const fechaAgendaParaCrear = data.fechaAgenda ? new Date(data.fechaAgenda as string | Date) : null;
  const horaAgendaParaCrear = data.horaAgenda ? String(data.horaAgenda) : null;

  const maxRetries = 10;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const numeroReserva = await generarNumeroReserva();
      const tokenPublico = crypto.randomBytes(24).toString('hex');
      const shortId = crypto.randomUUID().replace(/-/g, '').slice(0, 8);

      let pasajerosCreate = undefined;
      if (data.pasajeros && data.pasajeros.length > 0) {
        pasajerosCreate = data.pasajeros.map((p, index) => ({
          ...p,
          numeroPasajero: `${numeroReserva}-${(index + 1).toString().padStart(2, '0')}`,
          tokenPublico: crypto.randomBytes(24).toString('hex'),
          shortId: crypto.randomUUID().replace(/-/g, '').slice(0, 8),
        }));
      }

      const montoAbono = abonoInicialValido ? montoAbonoInicial : 0;

      return await prisma.reserva.create({
        data: {
          numeroReserva,
          tokenPublico,
          shortId,
          rutDniTitular: data.rutDniTitular,
          nombreTitular: data.nombreTitular,
          telefono: data.telefono,
          email: data.email,
          esGiftCard: Boolean(data.esGiftCard),
          fechaAgenda: fechaAgendaParaCrear,
          horaAgenda: horaAgendaParaCrear,
          estadoPago: finalEstadoPago as any,
          // Fase 2: ciclo de vida opcional en creación (simulador/agente); default SIN_AGENDAR
          ...(data.estado !== undefined && { estado: data.estado }),
          ...(data.motivoCancelacion !== undefined && { motivoCancelacion: data.motivoCancelacion }),
          ...(data.fechaCancelacion !== undefined && { fechaCancelacion: data.fechaCancelacion ? new Date(data.fechaCancelacion) : null }),
          valorTotal: valorTotalFinal,
          abono: montoAbono,
          ...(montoDevuelto > 0 && { montoDevuelto }),
          // montoDevuelto siempre respaldado por una Devolucion (una sola fuente
          // de verdad: montoDevuelto = suma de devoluciones). Sin la fila, la
          // primera devolución posterior pisaba el monto sembrado.
          ...(montoDevuelto > 0 && {
            devoluciones: {
              create: [{
                monto: montoDevuelto,
                metodoPago: (data as any).metodoPagoDevolucion || (data as any).metodoPago || 'TRANSFERENCIA',
                fecha: new Date(),
                notas: (data as any).notasDevolucion || 'Devolución inicial registrada al crear la reserva',
              }],
            },
          }),
          // Fase 2: snapshot de tarifa/promoción/descuento (solo si tarifaId presente)
          ...(tarifaId !== undefined && { tarifaId }),
          ...(promocionId !== undefined && { promocionId }),
          ...(descuentoFinal !== undefined && { descuento: descuentoFinal }),
          pasajeros: pasajerosCreate ? {
            create: pasajerosCreate,
          } : undefined,
          pagos: abonoInicialValido ? {
            create: [{
              monto: montoAbonoInicial,
              metodoPago: (data as any).metodoPago || 'TRANSFERENCIA',
              fecha: new Date(),
              comprobante: (data as any).comprobantePago || null,
              notas: (data as any).notasPago || 'Abono inicial al crear la reserva',
            }],
          } : undefined,
        },
        include: {
          pasajeros: true,
          pagos: { where: { deletedAt: null }, orderBy: { fecha: 'desc' } },
        },
      });
    } catch (err: any) {
      // P2002: colisión única en campos autogenerados (numeroReserva, numeroPasajero, tokenPublico, shortId)
      const isUniqueCollision = err?.code === 'P2002';
      if (isUniqueCollision && attempt < maxRetries - 1) {
        // Retroceso con jitter exponencial para desincronizar ráfagas concurrentes
        const delay = Math.min(350, 15 * Math.pow(1.4, attempt) + Math.random() * 50);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw new Error('No se pudo generar un número de reserva único tras múltiples intentos.');
}

export async function updateReserva(id: number, data: UpdateReservaPayload & { pasajeros?: Partial<PasajeroDTO>[] }) {
  const {
    id: _unusedId,
    cerradaAt: _unusedCerradaAt,
    snapshotJson: _unusedSnapshotJson,
    // Punto 3: importes derivados — nunca se escriben desde el payload de edición
    // (defensa en profundidad si un cliente legacy aún los envía).
    abono: _unusedAbono,
    montoDevuelto: _unusedMontoDevuelto,
    fechaAgenda,
    horaAgenda,
    esGiftCard,
    pasajeros,
    valorTotal,
    estadoPago,
    version,
    estado,
    motivoCancelacion,
    fechaCancelacion,
    ...datos
  } = data as UpdateReservaPayload & {
    id?: number;
    cerradaAt?: any;
    snapshotJson?: any;
    abono?: number;
    montoDevuelto?: number;
    pasajeros?: Partial<PasajeroDTO>[];
  };

  const resultado = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // findUnique con deletedAt: null (el plugin soft-delete no cubre findUnique/tx, ADR 006)
    const prevReserva = await tx.reserva.findUnique({ where: { id, deletedAt: null } });
    if (!prevReserva) throw new Error('Reserva no encontrada');
    if (prevReserva.cerradaAt) {
      throw new Error(`La reserva #${prevReserva.numeroReserva || prevReserva.id} se encuentra cerrada contablemente y no admite modificaciones`);
    }
    if (prevReserva.estado === 'COMPLETADA') {
      throw new Error('No se puede editar una reserva completada');
    }
    checkVersion(prevReserva.version, version);

    // Punto 3: `abono` ya NO es editable desde la edición de la reserva. Se deriva
    // SIEMPRE de la suma de pagos activos (invariante abono == suma(pagos)); los
    // cambios de dinero ocurren solo vía addPago/deletePago/devoluciones, con su
    // historial contable. Aquí únicamente se re-sincroniza el denormalizado.
    const pagoStats = await tx.pago.aggregate({
      _sum: { monto: true },
      where: { reservaId: id, deletedAt: null },
    });
    const totalPagado = toNum(pagoStats._sum.monto);

    let finalEstadoPago = estadoPago;
    // Fase 2: DEVUELTO prima — la derivación incluye el monto devuelto actual.
    const devueltoPrev = toNum(prevReserva.montoDevuelto);
    if (estadoPago !== undefined) {
      // Fase 1: estadoPago es SIEMPRE derivado. Si el cliente envía uno
      // explícito que no coincide con la derivación, se rechaza (400).
      const vTotal = toNum(valorTotal !== undefined ? valorTotal : prevReserva?.valorTotal);
      if (estadoPago !== derivarEstadoPago(vTotal, totalPagado, devueltoPrev)) {
        throw new Error('El estado de pago se deriva automáticamente de los pagos registrados');
      }
    } else if (valorTotal !== undefined) {
      const vTotal = toNum(valorTotal);
      finalEstadoPago = derivarEstadoPago(vTotal, totalPagado, devueltoPrev);
    }

    let fechaAgendaUpdate: Date | null | undefined = undefined;
    if (fechaAgenda !== undefined) {
      fechaAgendaUpdate = fechaAgenda ? new Date(fechaAgenda as string | Date) : null;
    }

    const dataToUpdate = {
      ...datos,
      ...(valorTotal !== undefined && { valorTotal }),
      // Higiene del invariante: el abono denormalizado se re-sincroniza siempre
      // con la suma real de pagos activos (nunca con un valor del cliente).
      abono: totalPagado,
      ...(finalEstadoPago !== undefined && { estadoPago: finalEstadoPago as any }),
      ...(fechaAgendaUpdate !== undefined && { fechaAgenda: fechaAgendaUpdate }),
      ...(horaAgenda !== undefined && { horaAgenda: horaAgenda || null }),
      ...(esGiftCard !== undefined && { esGiftCard: Boolean(esGiftCard) }),
      version: { increment: 1 },
    };

    if (version !== undefined && version !== null) {
      const updateResult = await tx.reserva.updateMany({
        where: { id, version },
        data: dataToUpdate,
      });

      if (updateResult.count === 0) {
        throw new ConflictError('La reserva cambió en otro dispositivo. Recarga e intenta de nuevo.');
      }
    } else {
      await tx.reserva.update({
        where: { id },
        data: dataToUpdate,
      });
    }

    if (pasajeros) {
      // ADR 006: la extensión de soft-delete no cubre los clientes de transacción;
      // filtrar explícitamente para no mezclar pasajeros ya borrados en el diff.
      const currentPasajeros = await tx.pasajero.findMany({
        where: { reservaId: id, deletedAt: null },
        include: { deslindeFirma: true },
      });
      const currentIds = currentPasajeros.map((p) => p.id);

      // Defensa en profundidad: si ningún pasajero trae ID pero la cantidad coincide con los existentes,
      // asociar por posición para evitar borrar cupos/vuelos si un cliente legacy no manda IDs.
      const normalizedPasajeros = (pasajeros.length > 0 && pasajeros.every((p) => p.id === undefined) && pasajeros.length === currentPasajeros.length)
        ? pasajeros.map((p, idx) => ({ ...p, id: currentPasajeros[idx].id }))
        : pasajeros;

      const payloadIds = normalizedPasajeros.filter((p) => p.id !== undefined).map((p) => p.id as number);

      const idsToDelete = currentIds.filter((pid: number) => !payloadIds.includes(pid));
      if (idsToDelete.length > 0) {
        // Soft delete: un deleteMany físico dispararía el Cascade de DeslindeFirma
        // y Vuelo, destruyendo firmas (dato legal) e historial de vuelos.
        await tx.pasajero.updateMany({
          where: { id: { in: idsToDelete }, deletedAt: null },
          data: { deletedAt: new Date() },
        });
      }

      // El correlativo debe considerar también a los pasajeros soft-deleted:
      // numeroPasajero es @unique y sus valores siguen ocupados.
      const todosLosPasajeros = await tx.pasajero.findMany({
        where: { reservaId: id },
        select: { id: true, numeroPasajero: true },
      });

      let maxCorrelative = 0;
      todosLosPasajeros.forEach((p) => {
        if (p.numeroPasajero && prevReserva.numeroReserva) {
          const prefix = prevReserva.numeroReserva + '-';
          if (p.numeroPasajero.startsWith(prefix)) {
            const correlativoStr = p.numeroPasajero.slice(prefix.length);
            const correlativo = parseInt(correlativoStr, 10);
            if (!isNaN(correlativo) && correlativo > maxCorrelative) {
              maxCorrelative = correlativo;
            }
          }
        }
      });

      let nextPasajeroCorrelative = maxCorrelative + 1;
      const usedSignedPaxIds = new Set<number>();

      for (const p of normalizedPasajeros) {
        // Buscar si existe un pasajero previo que ya haya firmado el deslinde y cuya identidad
        // legal (Nombre + RUT/DNI) coincida con la de este pasajero entrante:
        const matchingSignedPax = currentPasajeros.find(
          (cp) => cp.firmaDeslinde && !usedSignedPaxIds.has(cp.id) && esMismaPersona(cp, p)
        );
        if (matchingSignedPax) {
          usedSignedPaxIds.add(matchingSignedPax.id);
        }

        if (p.id) {
          const currentPax = currentPasajeros.find((cp) => cp.id === p.id);

          let firmaDeslindeFinal = false;
          let firmaFechaFinal: Date | null = null;

          if (matchingSignedPax) {
            firmaDeslindeFinal = true;
            firmaFechaFinal = matchingSignedPax.firmaFecha ?? new Date();

            // Si la firma provenía de otro cupo (ej. se intercambiaron o reordenaron pasajeros),
            // asegurar que la firma digital esté asociada a este cupo p.id:
            if (matchingSignedPax.id !== p.id && matchingSignedPax.deslindeFirma && (tx as any).deslindeFirma) {
              await (tx as any).deslindeFirma.upsert({
                where: { pasajeroId: p.id },
                create: {
                  pasajeroId: p.id,
                  firmaBase64: matchingSignedPax.deslindeFirma.firmaBase64,
                  ip: matchingSignedPax.deslindeFirma.ip,
                  userAgent: matchingSignedPax.deslindeFirma.userAgent,
                  versionLegal: matchingSignedPax.deslindeFirma.versionLegal,
                  createdAt: matchingSignedPax.deslindeFirma.createdAt,
                },
                update: {
                  firmaBase64: matchingSignedPax.deslindeFirma.firmaBase64,
                  ip: matchingSignedPax.deslindeFirma.ip,
                  userAgent: matchingSignedPax.deslindeFirma.userAgent,
                },
              });
            }
          } else {
            // Si este cupo no coincide en identidad con nadie que haya firmado previamente
            // (se cambió el nombre/RUT o no ha firmado), y el cupo tenía una firma digital previa, se elimina:
            if (currentPax?.firmaDeslinde && (tx as any).deslindeFirma) {
              await (tx as any).deslindeFirma.deleteMany({
                where: { pasajeroId: p.id },
              });
            }
          }

          await tx.pasajero.update({
            where: { id: p.id },
            data: {
              nombre: p.nombre,
              rutDni: p.rutDni,
              peso: p.peso,
              telefono: p.telefono,
              contactoEmergencia: p.contactoEmergencia,
              telefonoEmergencia: p.telefonoEmergencia,
              condicionFisica: p.condicionFisica,
              pesoVerificado: p.pesoVerificado,
              firmaDeslinde: firmaDeslindeFinal,
              firmaFecha: firmaFechaFinal,
            },
          });
        } else if (p.nombre) {
          const numeroPasajero = `${prevReserva.numeroReserva}-${nextPasajeroCorrelative.toString().padStart(2, '0')}`;
          nextPasajeroCorrelative++;

          const firmaDeslindeFinal = Boolean(matchingSignedPax);
          const firmaFechaFinal = matchingSignedPax?.firmaFecha ?? (matchingSignedPax ? new Date() : null);

          const nuevoPasajero = await tx.pasajero.create({
            data: {
              numeroPasajero,
              tokenPublico: crypto.randomBytes(24).toString('hex'),
              shortId: crypto.randomUUID().replace(/-/g, '').slice(0, 8),
              nombre: p.nombre,
              rutDni: p.rutDni,
              peso: p.peso,
              telefono: p.telefono,
              contactoEmergencia: p.contactoEmergencia,
              telefonoEmergencia: p.telefonoEmergencia,
              condicionFisica: p.condicionFisica,
              pesoVerificado: p.pesoVerificado,
              firmaDeslinde: firmaDeslindeFinal,
              firmaFecha: firmaFechaFinal,
              reservaId: id,
            },
          });

          if (matchingSignedPax?.deslindeFirma && (tx as any).deslindeFirma) {
            await (tx as any).deslindeFirma.create({
              data: {
                pasajeroId: nuevoPasajero.id,
                firmaBase64: matchingSignedPax.deslindeFirma.firmaBase64,
                ip: matchingSignedPax.deslindeFirma.ip,
                userAgent: matchingSignedPax.deslindeFirma.userAgent,
                versionLegal: matchingSignedPax.deslindeFirma.versionLegal,
                createdAt: matchingSignedPax.deslindeFirma.createdAt,
              },
            });
          }
        }
      }
    }

    return tx.reserva.findUnique({
      where: { id, deletedAt: null },
      include: {
        tarifa: true,
        promocion: true,
        pasajeros: {
          where: { deletedAt: null },
          include: {
            vuelos: {
              where: { deletedAt: null },
              include: { piloto: true },
            },
          },
        },
        pagos: {
          where: { deletedAt: null },
          orderBy: { fecha: 'desc' },
        },
        devoluciones: {
          where: { deletedAt: null },
          orderBy: { fecha: 'desc' },
        },
      },
    });
  });

  broadcastDatos('reserva', 'actualizar');
  return resultado;
}
