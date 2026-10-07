import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../plugins/prisma';
import { Prisma } from '@prisma/client';
import { CreateConfiguracionPayloadSchema, aDiaCalendario, dateKeyLocal } from '@parapente/shared';
import { logAudit } from '../services/auditoria.service';
import {
  validarSolapamientos,
  resolverRango,
  errorHttp,
} from '../services/configuracion.service';

interface HorarioItem {
  horaInicio: string;
  horaFin: string;
}

interface UpdateConfiguracionBody {
  nombre?: string;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  fechaExacta?: string | null;
  bloqueado?: boolean;
  horarios?: HorarioItem[];
  version?: number;
}

/** Cap de días por consulta del resolver (protección anti-scan). */
const RESOLVER_MAX_DIAS = 400;

const configuracionBloquesRoutes: FastifyPluginAsync = async (fastify) => {
  // Resolver qué configuración aplica a cada día de un rango.
  // Registrar ANTES de las rutas paramétricas ('/:id').
  fastify.get<{ Querystring: Record<string, string> }>(
    '/resolver',
    { preHandler: fastify.authorize(['ADMIN', 'RECEPCION']) },
    async (request, reply) => {
      const query = (request.query ?? {}) as Record<string, string>;
      const desde = query.desde ?? '';
      const hasta = query.hasta ?? '';

      const formatoFecha = /^\d{4}-\d{2}-\d{2}$/;
      if (!formatoFecha.test(desde) || !formatoFecha.test(hasta)) {
        return reply.status(400).send({ error: 'Formato de fecha inválido. Use YYYY-MM-DD.' });
      }
      if (desde > hasta) {
        return reply.status(400).send({ error: '"desde" debe ser anterior o igual a "hasta"' });
      }
      const dias =
        Math.round(
          (Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000
        ) + 1;
      if (dias > RESOLVER_MAX_DIAS) {
        return reply
          .status(400)
          .send({ error: `El rango no puede superar ${RESOLVER_MAX_DIAS} días` });
      }

      return reply.send(await resolverRango(desde, hasta));
    },
  );

  // Archivar en lote las configuraciones expiradas (fechaFin/fechaExacta < hoy).
  fastify.post(
    '/limpiar-expiradas',
    { preHandler: fastify.authorize(['ADMIN']) },
    async (request, reply) => {
      // updateMany NO pasa por el plugin soft-delete → filtro manual de deletedAt.
      // fechaFin/fechaExacta son columnas date-only (DateTime almacenado como
      // medianoche UTC del día civil, ver schema ConfiguracionBloque). Comparar
      // contra `new Date()` las expiraba antes de tiempo (a las 20:00/21:00
      // locales de D-1) y el último día del rango desaparecía del calendario.
      // Límite correcto: inicio de HOY como medianoche UTC → archiva solo días
      // estrictamente anteriores a hoy bajo la convención date-only (patrón F11).
      const inicioHoyUtc = new Date(`${dateKeyLocal()}T00:00:00.000Z`);
      const res = await prisma.configuracionBloque.updateMany({
        where: {
          deletedAt: null,
          archivada: false,
          OR: [{ fechaFin: { lt: inicioHoyUtc } }, { fechaExacta: { lt: inicioHoyUtc } }],
        },
        data: { archivada: true, archivadaEn: new Date() },
      });

      await logAudit(request, {
        accion: 'ARCHIVAR',
        entidad: 'CONFIGURACION',
        descripcion: `Limpieza de configuraciones expiradas: ${res.count} archivadas`,
      });
      return reply.send({ archivadas: res.count });
    },
  );

  // Obtener todas las configuraciones (array plano, contrato actual).
  // orderBy determinista compatible con la numeración (numerarConfigs):
  // createdAt asc como orden estable y desempate determinista.
  fastify.get('/', async (_request, reply) => {
    try {
      const configuraciones = await prisma.configuracionBloque.findMany({
        include: { horarios: true },
        orderBy: [
          { createdAt: 'asc' },
          { id: 'asc' },
        ],
      });
      return reply.send(configuraciones);
    } catch (err) {
      console.warn('Advertencia DB en /configuracion-bloques:', err);
      return reply.send([]);
    }
  });

  // Crear una nueva configuración
  fastify.post('/', { preHandler: fastify.authorize(['ADMIN']) }, async (request, reply) => {
    const parsed = CreateConfiguracionPayloadSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.errors });
    }
    const data = parsed.data;
    const nombre = data.nombre;
    const bloqueado = data.bloqueado;
    const horarios = data.horarios ?? [];

    try {
      const nuevaConfiguracion = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // Reglas de negocio centralizadas (indefinido único, solapamiento de
        // rangos, exacta duplicada). Solo configs activas participan.
        await validarSolapamientos(tx, data);

        return tx.configuracionBloque.create({
          data: {
            nombre,
            fechaInicio: data.fechaInicio ? new Date(data.fechaInicio) : undefined,
            fechaFin: data.fechaFin ? new Date(data.fechaFin) : undefined,
            fechaExacta: data.fechaExacta ? new Date(data.fechaExacta) : undefined,
            bloqueado,
            horarios: {
              create: horarios.map((h) => ({ horaInicio: h.horaInicio, horaFin: h.horaFin })),
            },
          },
          include: { horarios: true },
        });
      });

      await logAudit(request, {
        accion: 'CREAR',
        entidad: 'CONFIGURACION',
        entidadId: nuevaConfiguracion.id,
        descripcion: `Configuración de bloques "${nombre}" creada${bloqueado ? ' (día bloqueado)' : ''}`,
        detalles: JSON.stringify({
          fechaInicio: data.fechaInicio || null,
          fechaFin: data.fechaFin || null,
          fechaExacta: data.fechaExacta || null,
          bloqueado,
          horarios,
        }),
      });

      return reply.code(201).send(nuevaConfiguracion);
    } catch (error: any) {
      if (error?.statusCode === 400) {
        return reply.status(400).send({ error: error.message });
      }
      throw error;
    }
  });

  // Editar configuración
  fastify.patch<{ Params: { id: string }; Body: UpdateConfiguracionBody }>(
    '/:id',
    { preHandler: fastify.authorize(['ADMIN']) },
    async (request, reply) => {
      const { id } = request.params;
      const { nombre, fechaInicio, fechaFin, fechaExacta, bloqueado, horarios, version } =
        request.body;
      const numericId = Number(id);

      try {
        const configActualizada = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          const actual = await tx.configuracionBloque.findUnique({
            where: { id: numericId, deletedAt: null },
            include: { horarios: { where: { deletedAt: null } } },
          });
          if (!actual) throw errorHttp(404, 'Configuración no encontrada');
          // Snapshot histórico (Fase 2-B): una archivada sigue resolviendo días
          // pasados vía /resolver — editarla corrompería el calendario histórico.
          if (actual.archivada) {
            throw errorHttp(400, 'No se puede editar una configuración archivada. El historial del calendario debe permanecer intacto.');
          }
          if (version !== undefined && version !== actual.version) {
            throw errorHttp(
              409,
              'Los datos de configuración cambiaron en otro dispositivo. Recarga e intenta de nuevo.'
            );
          }

          // Valores EFECTIVOS tras aplicar el patch (para validar el estado final).
          const efectivo = {
            nombre: nombre ?? actual.nombre,
            fechaInicio: fechaInicio !== undefined ? fechaInicio : actual.fechaInicio,
            fechaFin: fechaFin !== undefined ? fechaFin : actual.fechaFin,
            fechaExacta: fechaExacta !== undefined ? fechaExacta : actual.fechaExacta,
          };
          await validarSolapamientos(tx, efectivo, numericId);

          // ── SNAPSHOT AL EDITAR (regla maestra: el pasado es inmutable) ──
          // Si la regla ya gobernó días pasados, la versión actual se ARCHIVA
          // (conserva fechas/horarios originales para /resolver histórico) y
          // se crea una NUEVA fila con los cambios que solo aplica al futuro.
          const hoy = dateKeyLocal();
          const esIndefinida =
            actual.fechaExacta == null && actual.fechaInicio == null && actual.fechaFin == null;
          const gobiernaPasado =
            (actual.fechaExacta != null && aDiaCalendario(actual.fechaExacta) < hoy) ||
            (actual.fechaInicio != null && aDiaCalendario(actual.fechaInicio) < hoy) ||
            esIndefinida;

          if (gobiernaPasado) {
            await tx.configuracionBloque.update({
              where: { id: numericId },
              data: { archivada: true, archivadaEn: new Date(), version: { increment: 1 } },
            });
            const nueva = await tx.configuracionBloque.create({
              data: {
                nombre: efectivo.nombre,
                fechaInicio: efectivo.fechaInicio ? new Date(efectivo.fechaInicio as any) : null,
                fechaFin: efectivo.fechaFin ? new Date(efectivo.fechaFin as any) : null,
                fechaExacta: efectivo.fechaExacta ? new Date(efectivo.fechaExacta as any) : null,
                bloqueado: bloqueado ?? actual.bloqueado,
                horarios: {
                  create: (horarios ?? (actual.horarios as any[]).map((h) => ({ horaInicio: h.horaInicio, horaFin: h.horaFin }))).map((h) => ({
                    horaInicio: h.horaInicio,
                    horaFin: h.horaFin,
                  })),
                },
              },
              include: { horarios: true },
            });
            return nueva;
          }

          // Sin pasado gobernado: edición in-place normal
          await tx.configuracionBloque.update({
            where: { id: numericId },
            data: {
              ...(nombre !== undefined && { nombre }),
              ...(bloqueado !== undefined && { bloqueado }),
              ...(fechaInicio !== undefined && { fechaInicio: fechaInicio ? new Date(fechaInicio) : null }),
              ...(fechaFin !== undefined && { fechaFin: fechaFin ? new Date(fechaFin) : null }),
              ...(fechaExacta !== undefined && { fechaExacta: fechaExacta ? new Date(fechaExacta) : null }),
              version: { increment: 1 },
            },
          });

          // Reemplazar horarios si vienen provistos (soft delete: HorarioBloque
          // es soft-deletable; los reemplazados quedan como histórico, ADR 006)
          if (horarios) {
            await tx.horarioBloque.updateMany({
              where: { configuracionBloqueId: numericId, deletedAt: null },
              data: { deletedAt: new Date() },
            });

            if (horarios.length > 0) {
              await tx.horarioBloque.createMany({
                data: horarios.map((h) => ({
                  horaInicio: h.horaInicio,
                  horaFin: h.horaFin,
                  configuracionBloqueId: numericId,
                })),
              });
            }
          }

          return tx.configuracionBloque.findUnique({
            where: { id: numericId, deletedAt: null },
            include: { horarios: { where: { deletedAt: null } } },
          });
        });

        await logAudit(request, {
          accion: 'EDITAR',
          entidad: 'CONFIGURACION',
          entidadId: id,
          descripcion: `Configuración de bloques #${id} modificada`,
          detalles: JSON.stringify({ nombre: nombre ?? null, bloqueado: bloqueado ?? null }),
        });

        return reply.send(configActualizada);
      } catch (error: any) {
        if (error?.code === 'P2002') {
          return reply.status(400).send({ error: 'Ya existe una configuración para esta fecha exacta.' });
        }
        if (error?.statusCode === 400 || error?.statusCode === 404 || error?.statusCode === 409) {
          return reply.status(error.statusCode).send({ error: error.message });
        }
        throw error;
      }
    },
  );

  // Eliminar configuración → ARCHIVAR (snapshot, Fase 2-B).
  //
  // DECISIÓN sobre horarios: se dejan INTACTOS (sin soft delete ni borrado).
  // Motivo: la config archivada sigue resolviendo días pasados vía GET
  // /resolver, que necesita sus horarios para reconstruir el histórico. Borrar
  // los horarios rompería ese snapshot. Los horarios solo se reemplazan vía
  // PATCH mientras la config está activa.
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: fastify.authorize(['ADMIN']) },
    async (request, reply) => {
    const { id } = request.params;
    const numericId = Number(id);

    try {
      const archivada = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const actual = await tx.configuracionBloque.findUnique({ where: { id: numericId, deletedAt: null } });
        if (!actual) throw errorHttp(404, 'Configuración no encontrada');

        const esIndefinida =
          actual.fechaInicio == null && actual.fechaFin == null && actual.fechaExacta == null;
        if (esIndefinida) {
          throw errorHttp(400, 'La configuración indefinida es la base y no se puede eliminar');
        }
        if (actual.archivada) {
          throw errorHttp(400, 'La configuración ya está archivada');
        }

        return tx.configuracionBloque.update({
          where: { id: numericId },
          data: { archivada: true, archivadaEn: new Date(), version: { increment: 1 } },
          include: { horarios: true },
        });
      });

      await logAudit(request, {
        accion: 'ARCHIVAR',
        entidad: 'CONFIGURACION',
        entidadId: id,
        descripcion: `Configuración de bloques #${id} archivada (snapshot conservado)`,
      });
      return reply.send({ message: 'Configuración archivada', configuracion: archivada });
    } catch (error: any) {
      if (error?.statusCode === 400 || error?.statusCode === 404) {
        return reply.status(error.statusCode).send({ error: error.message });
      }
      throw error;
    }
  });
};

export default configuracionBloquesRoutes;
