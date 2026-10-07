import { prisma } from '../plugins/prisma';
import crypto from 'crypto';
import { PasajeroDTO, FirmaDeslindePayload } from '@parapente/shared';
import { listar, ListQuery } from './pagination.util';

export class PasajerosService {
  async getAll(opts: ListQuery & { q?: string } = {}) {
    const where: any = { deletedAt: null };
    if (opts.q?.trim()) {
      where.OR = [
        { nombre: { contains: opts.q.trim(), mode: 'insensitive' } },
        { rutDni: { contains: opts.q.trim(), mode: 'insensitive' } },
      ];
    }
    return listar(
      opts,
      ({ skip, take }) =>
        prisma.pasajero.findMany({
          where,
          include: { vuelos: true, reserva: true },
          orderBy: { createdAt: 'desc' },
          skip,
          take,
        }),
      () => prisma.pasajero.count({ where }),
    );
  }

  async getById(id: number) {
    return prisma.pasajero.findUnique({
      where: { id, deletedAt: null },
      include: { vuelos: { where: { deletedAt: null } }, reserva: true },
    });
  }

  async create(data: PasajeroDTO) {
    const numeroPasajero = data.numeroPasajero ?? `PAX-${Date.now()}-${crypto.randomInt(1000)}`;
    return prisma.pasajero.create({
      data: {
        numeroPasajero,
        tokenPublico: data.tokenPublico ?? crypto.randomBytes(24).toString('hex'),
        shortId: data.shortId ?? crypto.randomUUID().replace(/-/g, '').slice(0, 8),
        nombre: data.nombre,
        rutDni: data.rutDni,
        peso: data.peso,
        telefono: data.telefono,
        contactoEmergencia: data.contactoEmergencia,
        telefonoEmergencia: data.telefonoEmergencia,
        condicionFisica: data.condicionFisica,
        pesoVerificado: data.pesoVerificado,
        firmaDeslinde: data.firmaDeslinde,
        reservaId: data.reservaId,
      },
    });
  }

  async update(id: number, data: Partial<PasajeroDTO>) {
    return prisma.pasajero.update({
      where: { id },
      data,
    });
  }

  async guardarFirma(id: number, payload: FirmaDeslindePayload, meta?: { ip?: string; userAgent?: string }) {
    return prisma.$transaction(async (tx) => {
      if (typeof (tx as any).$queryRaw === 'function') {
        await (tx as any).$queryRaw`SELECT id FROM "Pasajero" WHERE id = ${id} FOR UPDATE`;
      }
      const pasajero = await tx.pasajero.findFirst({
        where: { id, deletedAt: null },
        include: { reserva: true },
      });
      if (!pasajero) {
        throw new Error('Pasajero no encontrado');
      }
      if (pasajero.reserva?.cerradaAt) {
        throw new Error('No se puede firmar deslinde de una reserva cerrada contablemente');
      }
      if (pasajero.reserva?.estado === 'CANCELADA') {
        throw new Error('No se puede firmar deslinde de una reserva cancelada');
      }

      await tx.deslindeFirma.upsert({
        where: { pasajeroId: id },
        create: {
          pasajeroId: id,
          firmaBase64: payload.firmaBase64,
          ip: meta?.ip,
          userAgent: meta?.userAgent,
          versionLegal: 1,
        },
        update: {
          firmaBase64: payload.firmaBase64,
          ip: meta?.ip,
          userAgent: meta?.userAgent,
        },
      });

      return tx.pasajero.update({
        where: { id },
        data: {
          firmaDeslinde: true,
          firmaFecha: new Date(),
          ...(payload.rutDni !== undefined && { rutDni: payload.rutDni }),
          ...(payload.contactoEmergencia !== undefined && { contactoEmergencia: payload.contactoEmergencia }),
          ...(payload.telefonoEmergencia !== undefined && { telefonoEmergencia: payload.telefonoEmergencia }),
          ...(payload.condicionFisica !== undefined && { condicionFisica: payload.condicionFisica }),
          ...(payload.pesoVerificado !== undefined && { pesoVerificado: payload.pesoVerificado }),
        },
      });
    });
  }

  async delete(id: number) {
    return prisma.pasajero.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
  }
}

export const pasajerosService = new PasajerosService();
