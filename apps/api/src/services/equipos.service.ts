import { prisma } from '../plugins/prisma';
import { CreateEquipoPayload, CreateMantenimientoPayload } from '@parapente/shared';
import { checkVersion } from './concurrencia.service';
import { listar, ListQuery } from './pagination.util';

export class EquiposService {
  async getAll(opts: ListQuery & { tipo?: string; estado?: string } = {}) {
    try {
      const where: any = {
        deletedAt: null,
        ...(opts.tipo && opts.tipo !== 'TODOS' ? { tipo: opts.tipo as any } : {}),
        ...(opts.estado && opts.estado !== 'TODOS' ? { estado: opts.estado as any } : {}),
      };
      // await obligatorio: sin él el rechazo no entra en el catch y el
      // fallback de arreglo vacío sería código muerto (500 en cascada).
      return await listar(
        opts,
        ({ skip, take }) =>
          prisma.equipo.findMany({
            where,
            include: {
              pilotoAsignado: {
                select: { id: true, nombre: true },
              },
              mantenimientos: {
                where: { deletedAt: null },
                orderBy: { fecha: 'desc' },
              },
            },
            orderBy: [
              { estado: 'asc' },
              { codigo: 'asc' },
            ],
            skip,
            take,
          }),
        () => prisma.equipo.count({ where }),
      );
    } catch (err) {
      console.warn('Advertencia DB en EquiposService.getAll, retornando arreglo vacío:', err);
      return { data: [], pagination: { page: 1, pageSize: 100, total: 0, totalPages: 0, hasMore: false } };
    }
  }

  async getById(id: number) {
    return prisma.equipo.findUnique({
      where: { id, deletedAt: null },
      include: {
        pilotoAsignado: {
          select: { id: true, nombre: true },
        },
        mantenimientos: {
          where: { deletedAt: null },
          orderBy: { fecha: 'desc' },
        },
      },
    });
  }

  async create(data: CreateEquipoPayload) {
    return prisma.equipo.create({
      data: {
        codigo: data.codigo.trim().toUpperCase(),
        nombre: data.nombre.trim(),
        tipo: data.tipo,
        marca: data.marca,
        modelo: data.modelo,
        numeroSerie: data.numeroSerie,
        anoFabricacion: data.anoFabricacion,
        fechaAdquisicion: data.fechaAdquisicion ? new Date(data.fechaAdquisicion) : null,
        estado: data.estado,
        horasVueloEstimadas: data.horasVueloEstimadas,
        vuelosRealizados: data.vuelosRealizados,
        limiteHorasInspeccion: data.limiteHorasInspeccion,
        fechaUltimaRevision: data.fechaUltimaRevision ? new Date(data.fechaUltimaRevision) : null,
        fechaProximaRevision: data.fechaProximaRevision ? new Date(data.fechaProximaRevision) : null,
        notas: data.notas,
        pilotoAsignadoId: data.pilotoAsignadoId || null,
      },
      include: {
        pilotoAsignado: true,
      },
    });
  }

  async update(id: number, data: CreateEquipoPayload & { version?: number }) {
    const { version, ...rest } = data;
    return prisma.$transaction(async (tx) => {
      const actual = await tx.equipo.findUnique({ where: { id, deletedAt: null } });
      if (!actual) throw new Error('Equipo no encontrado');
      checkVersion(actual.version, version);

      return tx.equipo.update({
        where: { id },
        data: {
          codigo: rest.codigo.trim().toUpperCase(),
          nombre: rest.nombre.trim(),
          tipo: rest.tipo,
          marca: rest.marca,
          modelo: rest.modelo,
          numeroSerie: rest.numeroSerie,
          anoFabricacion: rest.anoFabricacion,
          fechaAdquisicion: rest.fechaAdquisicion ? new Date(rest.fechaAdquisicion) : null,
          estado: rest.estado,
          horasVueloEstimadas: rest.horasVueloEstimadas,
          vuelosRealizados: rest.vuelosRealizados,
          limiteHorasInspeccion: rest.limiteHorasInspeccion,
          fechaUltimaRevision: rest.fechaUltimaRevision ? new Date(rest.fechaUltimaRevision) : null,
          fechaProximaRevision: rest.fechaProximaRevision ? new Date(rest.fechaProximaRevision) : null,
          notas: rest.notas,
          pilotoAsignadoId: rest.pilotoAsignadoId || null,
          version: { increment: 1 },
        },
        include: {
          pilotoAsignado: true,
        },
      });
    });
  }

  async delete(id: number) {
    return prisma.equipo.update({
      where: { id },
      data: { deletedAt: new Date(), version: { increment: 1 } },
    });
  }

  async addMantenimiento(equipoId: number, data: CreateMantenimientoPayload & { version?: number }) {
    return prisma.$transaction(async (tx) => {
      const equipo = await tx.equipo.findUnique({ where: { id: equipoId, deletedAt: null } });
      if (!equipo) throw new Error('Equipo no encontrado');
      checkVersion(equipo.version, data.version, 'El equipo cambió en otro dispositivo. Recarga e intenta de nuevo.');

      const mantenimiento = await tx.mantenimientoEquipo.create({
        data: {
          equipoId,
          fecha: data.fecha ? new Date(data.fecha) : new Date(),
          tipo: data.tipo,
          descripcion: data.descripcion,
          taller: data.taller,
          costo: data.costo,
          comprobante: data.comprobante,
        },
      });

      // Actualizar fechas de revisión del equipo
      await tx.equipo.update({
        where: { id: equipoId },
        data: {
          fechaUltimaRevision: data.fecha ? new Date(data.fecha) : new Date(),
          ...(data.proximaRevision ? { fechaProximaRevision: new Date(data.proximaRevision) } : {}),
          estado: 'OPERATIVO',
          version: { increment: 1 },
        },
      });

      return mantenimiento;
    });
  }

  async deleteMantenimiento(mantenimientoId: number) {
    return prisma.mantenimientoEquipo.update({
      where: { id: mantenimientoId },
      data: { deletedAt: new Date(), version: { increment: 1 } },
    });
  }
}

export const equiposService = new EquiposService();
