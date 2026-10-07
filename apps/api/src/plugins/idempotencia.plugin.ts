import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { Prisma } from '@prisma/client';

/**
 * Plugin de idempotencia del outbox offline (ADR 009).
 *
 * Clave: header `X-Client-Id` (uuid estable de la entrada del outbox del
 * cliente). Cubre mutaciones autenticadas POST/PUT/PATCH/DELETE: si llega un
 * reenvío duplicado (replay concurrente o respuesta perdida tras aplicar la
 * mutación), se devuelve la respuesta original almacenada en lugar de
 * re-ejecutar la ruta — evita duplicados Y el 409 espurio de un DELETE
 * reenviado.
 *
 * Retención de 7 días (TTL_MS) con purga perezosa horaria: como mucho una
 * vez por hora, el primer request que pase lanza el borrado de vencidos en
 * fire-and-forget (nunca bloquea ni falla la petición).
 *
 * Los errores de Prisma se tragan a propósito: si la tabla aún no existe
 * (migración pendiente) la API sigue funcionando, simplemente sin dedupe.
 */

/** Métodos que mutan estado y por tanto son candidatos a dedupe. */
const METODOS_MUTACION = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Ventana de retención de respuestas guardadas (7 días). */
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Frecuencia máxima de purga (1 hora, perezosa: solo cuando pasa tráfico). */
const INTERVALO_PURGA_MS = 60 * 60 * 1000;

/** Epoch ms de la última purga lanzada (estado de módulo, best-effort). */
let ultimaPurga = 0;

declare module 'fastify' {
  interface FastifyRequest {
    /** ClientId marcado en onRequest cuando onSend debe guardar la respuesta. */
    idempotenciaClientId?: string;
  }
}

/** Formato aceptado para X-Client-Id: uuid v4 (lo genera crypto.randomUUID()). */
const PATRON_CLIENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Tope de respuesta almacenada por operación (256 KB): el dedupe es una
 * optimización, no un almacén — mejor perderlo que permitir inflar la tabla. */
const MAX_PAYLOAD_BYTES = 256 * 1024;

const idempotenciaPlugin: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', async (request, reply) => {
    // Solo mutaciones: las lecturas (GET) nunca se deduplican ni se guardan.
    if (!METODOS_MUTACION.has(request.method)) return;

    // Header X-Client-Id: debe ser un uuid (crypto.randomUUID del cliente);
    // cualquier otro formato se ignora (la petición fluye normal, sin dedupe).
    const crudo = request.headers['x-client-id'];
    if (typeof crudo !== 'string' || !PATRON_CLIENT_ID.test(crudo)) return;
    const clientId = crudo.toLowerCase();

    // Identidad del usuario autenticado: parte de la clave compuesta, de modo
    // que un cliente NUNCA reciba la respuesta cacheada de otro usuario.
    const usuarioId = request.user?.id;
    if (typeof usuarioId !== 'number') return;

    // ¿Ya hay una respuesta guardada para esta operación? (replay)
    // Si la tabla no existe todavía, seguimos sin dedupe (.catch → null).
    const previa = await app.prisma.idempotencia
      .findUnique({
        where: { clientId_metodo_url: { clientId, metodo: request.method, url: request.url } },
      })
      .catch(() => null);

    if (previa && previa.usuarioId === usuarioId) {
      // Short-circuit: devolver la respuesta original tal cual; la ruta no
      // se ejecuta (evita duplicados y el 409 espurio del DELETE reenviado).
      reply.status(previa.statusCode);
      return reply.send(previa.respuesta);
    }

    // Primera vez que vemos este clientId: marcar para guardar en onSend.
    request.idempotenciaClientId = clientId;

    // Purga perezosa: como mucho una vez por hora, borrar registros vencidos.
    // Promise.resolve blinda el fire-and-forget: jamás debe lanzar dentro del hook.
    const ahora = Date.now();
    if (ahora - ultimaPurga > INTERVALO_PURGA_MS) {
      ultimaPurga = ahora;
      void Promise.resolve(
        app.prisma.idempotencia.deleteMany({
          where: { createdAt: { lt: new Date(ahora - TTL_MS) } },
        }),
      ).catch(() => {});
    }
  });

  app.addHook('onSend', async (request, reply, payload) => {
    const clientId = request.idempotenciaClientId;
    // Sin marca (GET, header ausente/inválido o replay) → nada que guardar.
    if (!clientId) return payload;

    // Solo respuestas 2xx: los errores no se cachean como idempotentes.
    if (reply.statusCode < 200 || reply.statusCode >= 300) return payload;

    // Tope de tamaño: respuestas enormes no se guardan (superficie DoS).
    const tamano = typeof payload === 'string' ? payload.length : Buffer.isBuffer(payload) ? payload.length : 0;
    if (tamano > MAX_PAYLOAD_BYTES) return payload;

    // El payload llega serializado (string/Buffer). Un body vacío (ej. 204
    // de un DELETE) se guarda como {} para que el replay devuelva el mismo
    // status sin re-ejecutar (evita el 409 espurio del DELETE reenviado).
    // Si no se puede parsear, no guardamos: mejor perder un dedupe que
    // almacenar basura.
    let cuerpo: Prisma.InputJsonValue;
    if (
      payload === undefined ||
      payload === null ||
      (typeof payload === 'string' && payload === '')
    ) {
      cuerpo = {};
    } else if (typeof payload === 'string') {
      try {
        cuerpo = JSON.parse(payload) as Prisma.InputJsonValue;
      } catch {
        return payload;
      }
    } else if (Buffer.isBuffer(payload)) {
      try {
        cuerpo = JSON.parse(payload.toString('utf8')) as Prisma.InputJsonValue;
      } catch {
        return payload;
      }
    } else {
      // Streams u otros payloads no serializables: no guardar.
      return payload;
    }
    // JSON.parse('null') produce null crudo que Prisma rechaza en Json.
    if (cuerpo === null) cuerpo = {};

    // Fire-and-forget blindado con Promise.resolve: jamás bloquea ni altera
    // la respuesta. Un P2002 por carrera significa que otra petición paralela
    // guardó lo mismo: inofensivo.
    void Promise.resolve(
      app.prisma.idempotencia.create({
        data: {
          clientId,
          metodo: request.method,
          url: request.url,
          usuarioId: request.user?.id as number,
          statusCode: reply.statusCode,
          respuesta: cuerpo,
        },
      }),
    ).catch(() => {});

    // onSend SIEMPRE devuelve el payload intacto.
    return payload;
  });
};

export default fp(idempotenciaPlugin, {
  name: 'idempotencia-plugin',
  fastify: '5.x',
});
