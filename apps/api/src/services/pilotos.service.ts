import { prisma } from '../plugins/prisma';
import { PilotoDTO, dateKeyLocal, fechaHoraLocalToIso } from '@parapente/shared';
import { listar, parseSort, ListQuery } from './pagination.util';
import { checkVersion } from './concurrencia.service';

const SORT_FIELDS = ['prioridad', 'nombre', 'createdAt'] as const;

function licenciaVigente(p: { tieneLicencia: boolean; fechaVencimientoLicencia?: Date | string | null }): boolean {
  if (!p.tieneLicencia) return false;
  if (!p.fechaVencimientoLicencia) return true;
  const vence = new Date(p.fechaVencimientoLicencia as any);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return vence >= hoy;
}

export class PilotosService {
  async getAll(opts: ListQuery & { q?: string; activo?: string; sort?: string } = {}) {
    try {
      const where: any = { deletedAt: null };
      if (opts.q?.trim()) {
        const q = opts.q.trim();
        where.OR = [
          { nombre: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { telefono: { contains: q, mode: 'insensitive' } },
        ];
      }
      if (opts.activo === 'true') where.activo = true;
      if (opts.activo === 'false') where.activo = false;
      const orderBy = parseSort(opts.sort, SORT_FIELDS, { prioridad: 'asc' });
      // await obligatorio: sin él el rechazo no entra en el catch y el
      // fallback de arreglo vacío sería código muerto (500 en cascada).
      return await listar(
        opts,
        ({ skip, take }) => prisma.piloto.findMany({ where, orderBy, skip, take }),
        () => prisma.piloto.count({ where }),
      );
    } catch (err) {
      console.warn('Advertencia DB en PilotosService.getAll, retornando arreglo vacío:', err);
      return { data: [], pagination: { page: 1, pageSize: 100, total: 0, totalPages: 0, hasMore: false } };
    }
  }

  async getDisponibilidad(id: number) {
    const piloto = await prisma.piloto.findUnique({
      where: { id, deletedAt: null },
      select: {
        id: true,
        disponibilidadTotal: true,
        version: true,
        excepciones: true,
        disponibilidadBloques: true,
      },
    });
    if (!piloto) return null;
    return piloto;
  }

  async create(data: PilotoDTO) {
    return prisma.piloto.create({
      data: {
        nombre: data.nombre,
        rutDni: data.rutDni,
        telefono: data.telefono,
        email: data.email,
        peso: data.peso,
        tieneLicencia: data.tieneLicencia,
        numeroLicencia: data.numeroLicencia,
        fechaVencimientoLicencia: data.fechaVencimientoLicencia ? new Date(data.fechaVencimientoLicencia as any) : null,
        prioridad: data.prioridad !== undefined ? data.prioridad : 1,
        categoria: data.categoria || "MASTER",
        pesoMinimoPasajero: data.pesoMinimoPasajero !== undefined ? data.pesoMinimoPasajero : 30,
        pesoMaximoPasajero: data.pesoMaximoPasajero !== undefined ? data.pesoMaximoPasajero : 110,
        disponibilidadTotal: data.disponibilidadTotal !== undefined ? data.disponibilidadTotal : true,
        tarifaPorVuelo: data.tarifaPorVuelo !== undefined ? data.tarifaPorVuelo : 0,
        activo: data.activo,
      },
    });
  }

  async update(id: number, data: Partial<PilotoDTO> & { version?: number }) {
    const { version, ...rest } = data as any;
    if (typeof version === 'number') {
      const actual = await prisma.piloto.findFirst({ where: { id, deletedAt: null } });
      if (!actual) throw new Error('Piloto no encontrado');
      checkVersion(actual.version, version);
    }
    return prisma.piloto.update({
      where: { id },
      data: { ...rest, version: { increment: 1 } },
    });
  }

  async sugerirPiloto(payload: { fechaHora: string | Date; pesoPasajero?: number | null; pasajeroId?: number | null }) {
    const targetDate = new Date(payload.fechaHora);
    const dateStr = dateKeyLocal(targetDate);
    const startOfDay = new Date(`${dateStr}T00:00:00.000Z`);
    const endOfDay = new Date(`${dateStr}T23:59:59.999Z`);
    // Clave del día siguiente (aritmética calendario pura, sin depender del TZ del proceso)
    const [anio, mes, dia] = dateStr.split('-').map(Number);
    const nextDayKey = new Date(Date.UTC(anio, mes - 1, dia + 1)).toISOString().slice(0, 10);

    let pesoRequerido = payload.pesoPasajero;

    // Si se envió pasajeroId y no el peso directamente, consultar el peso verificado del pasajero
    if (!pesoRequerido && payload.pasajeroId) {
      const pasajero = await prisma.pasajero.findUnique({ where: { id: payload.pasajeroId, deletedAt: null } });
      if (pasajero) {
        pesoRequerido = pasajero.pesoVerificado || pasajero.peso || null;
      }
    }

    // Obtener todos los pilotos activos con sus excepciones y vuelos del día
    const pilotos = await prisma.piloto.findMany({
      where: { activo: true, deletedAt: null },
      include: {
        excepciones: {
          where: {
            fecha: {
              gte: startOfDay,
              lte: endOfDay
            }
          }
        },
        vuelos: {
          where: {
            // Ventana en TZ local sobre instantes reales (fechaHora): las horas
            // 20:00–23:59 locales caerían en el día equivocado con la ventana UTC.
            fechaHora: {
              gte: new Date(fechaHoraLocalToIso(dateStr, '00:00')),
              lt: new Date(fechaHoraLocalToIso(nextDayKey, '00:00'))
            },
            deletedAt: null,
            estado: { not: 'CANCELADO' }
          }
        }
      }
    });

    const candidatos = pilotos.map(piloto => {
      const tieneExcepcion = piloto.excepciones.length > 0;
      const estaDisponible = piloto.disponibilidadTotal ? !tieneExcepcion : tieneExcepcion;
      
      const minPeso = piloto.pesoMinimoPasajero ?? 30;
      const maxPeso = piloto.pesoMaximoPasajero ?? 110;
      const cumplePeso = pesoRequerido ? (pesoRequerido >= minPeso && pesoRequerido <= maxPeso) : true;
      const totalVuelosHoy = piloto.vuelos.length;

      let motivo = 'Disponible para asignación';
      if (!estaDisponible) {
        motivo = 'No disponible (Excepción de fecha registrado)';
      } else if (!cumplePeso && pesoRequerido) {
        motivo = `Rango de peso no apto (${minPeso}kg - ${maxPeso}kg vs ${pesoRequerido}kg pasajero)`;
      } else if (!licenciaVigente(piloto)) {
        motivo = 'Licencia de piloto no vigente';
      }

      return {
        id: piloto.id,
        nombre: piloto.nombre,
        categoria: piloto.categoria || 'MASTER',
        prioridad: piloto.prioridad, // Prioridad de categoría
        tieneLicencia: piloto.tieneLicencia,
        licenciaVigente: licenciaVigente(piloto),
        pesoMinimoPasajero: minPeso,
        pesoMaximoPasajero: maxPeso,
        estaDisponible,
        cumplePeso,
        totalVuelosHoy,
        motivo,
        esElegible: estaDisponible && cumplePeso && licenciaVigente(piloto)
      };
    });

    // Ordenar candidatos: 1) elegibles, 2) prioridad (menor=número=mejor), 3) categoría (menor=número=mejor), 4) balance de carga (menos vuelos hoy primero), 5) empate -> azar
    const CATEGORIA_RANK: Record<string, number> = { MASTER: 1, SENIOR: 2, JUNIOR: 3 };
    const rankCategoria = (c: string) => CATEGORIA_RANK[c?.toUpperCase()] ?? 99;
    candidatos.sort((a, b) => {
      // 1. Primero los elegibles
      if (a.esElegible !== b.esElegible) return a.esElegible ? -1 : 1;
      // 2. Prioridad de categoría (menor número = mayor prioridad: 1 > 2 > 3)
      if (a.prioridad !== b.prioridad) return a.prioridad - b.prioridad;
      // 3. Categoría (menor número = mayor jerarquía: MASTER(1) > SENIOR(2) > JUNIOR(3))
      const rc = rankCategoria(a.categoria) - rankCategoria(b.categoria);
      if (rc !== 0) return rc;
      // 4. Balance de carga: piloto con menos vuelos hoy tiene prioridad
      if (a.totalVuelosHoy !== b.totalVuelosHoy) return a.totalVuelosHoy - b.totalVuelosHoy;
      // 5. Empate total -> al azar (sin sesgo por orden de inserción)
      return Math.random() - 0.5;
    });

    const pilotoRecomendado = candidatos.find(c => c.esElegible) || null;

    return {
      pilotoRecomendado,
      candidatos,
      pesoEvaluado: pesoRequerido || null,
      fechaEvaluada: targetDate.toISOString()
    };
  }

  async toggleDisponibilidad(id: number, fecha: string) {
    const date = new Date(`${fecha}T00:00:00Z`);
    const existing = await prisma.excepcionFecha.findUnique({
      where: {
        pilotoId_fecha: {
          pilotoId: id,
          fecha: date
        }
      }
    });

    if (existing) {
      await prisma.excepcionFecha.delete({ where: { id: existing.id } });
    } else {
      await prisma.excepcionFecha.create({
        data: { pilotoId: id, fecha: date }
      });
    }
    await this.bumpVersion(id);
    return { status: existing ? 'removed' : 'added' };
  }

  async resetDisponibilidad(id: number, desde?: string, hasta?: string) {
    const fechaFiltro =
      desde && hasta
        ? { gte: new Date(`${desde}T00:00:00Z`), lte: new Date(`${hasta}T00:00:00Z`) }
        : desde
          ? { gte: new Date(`${desde}T00:00:00Z`) }
          : hasta
            ? { lte: new Date(`${hasta}T00:00:00Z`) }
            : undefined;
    const whereBase: { pilotoId: number; fecha?: unknown } = { pilotoId: id };
    if (fechaFiltro) (whereBase as Record<string, unknown>).fecha = fechaFiltro;
    await prisma.excepcionFecha.deleteMany({ where: whereBase as never });
    await prisma.pilotoDisponibilidadBloque.deleteMany({ where: whereBase as never });
    await this.bumpVersion(id);
    return { status: 'reset', desde: desde ?? null, hasta: hasta ?? null };
  }

  async getBloquesDisponibilidad(id: number) {
    return prisma.pilotoDisponibilidadBloque.findMany({
      where: { pilotoId: id },
      orderBy: [{ fecha: 'asc' }, { horaInicio: 'asc' }]
    });
  }

  async setBloquesDisponibilidad(id: number, fecha: string, bloques: { horaInicio: string; horaFin: string }[]) {
    const date = new Date(`${fecha}T00:00:00Z`);
    await prisma.$transaction([
      prisma.pilotoDisponibilidadBloque.deleteMany({ where: { pilotoId: id, fecha: date } }),
      ...(bloques.length > 0
        ? [prisma.pilotoDisponibilidadBloque.createMany({
            data: bloques.map((b) => ({ pilotoId: id, fecha: date, horaInicio: b.horaInicio, horaFin: b.horaFin })),
          })]
        : []),
    ]);
    await this.bumpVersion(id);
    return this.getBloquesDisponibilidad(id);
  }

  async saveDisponibilidad(id: number, version: number, fechas: { fecha: string; disponible: boolean; bloques: { horaInicio: string; horaFin: string }[] }[]) {
    const result = await prisma.$transaction(async (tx) => {
      const piloto = await tx.piloto.findUnique({ where: { id, deletedAt: null } });
      if (!piloto) throw new Error('Piloto no encontrado');
      if (piloto.version !== version) return { conflict: true } as const;

      const base = piloto.disponibilidadTotal;
      for (const f of fechas) {
        const date = new Date(`${f.fecha}T00:00:00Z`);
        const hasEx = await tx.excepcionFecha.findUnique({
          where: { pilotoId_fecha: { pilotoId: id, fecha: date } },
        });
        const wantException = base ? !f.disponible : f.disponible;
        if (wantException && !hasEx) {
          await tx.excepcionFecha.create({ data: { pilotoId: id, fecha: date } });
        } else if (!wantException && hasEx) {
          await tx.excepcionFecha.delete({ where: { id: hasEx.id } });
        }

        await tx.pilotoDisponibilidadBloque.deleteMany({ where: { pilotoId: id, fecha: date } });
        if (f.bloques && f.bloques.length > 0) {
          await tx.pilotoDisponibilidadBloque.createMany({
            data: f.bloques.map((b) => ({ pilotoId: id, fecha: date, horaInicio: b.horaInicio, horaFin: b.horaFin })),
          });
        }
      }

      const nuevo = await tx.piloto.update({
        where: { id },
        data: { version: { increment: 1 } },
      });
      return { conflict: false as const, version: nuevo.version };
    });
    return result;
  }

  private async bumpVersion(id: number) {
    await prisma.piloto.update({
      where: { id },
      data: { version: { increment: 1 } },
    });
  }

  async delete(id: number) {
    return prisma.piloto.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
  }
}

export const pilotosService = new PilotosService();
