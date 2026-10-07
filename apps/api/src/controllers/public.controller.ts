import { FastifyRequest, FastifyReply } from 'fastify';
import { FirmaDeslindePayloadSchema } from '@parapente/shared';
import { publicService, RegistrarFirmaDTO } from '../services/public.service';

export class PublicController {
  getHealth(_request: FastifyRequest, reply: FastifyReply) {
    return reply.send(publicService.getHealth());
  }

  async getDeslindeActivo(_request: FastifyRequest, reply: FastifyReply) {
    const deslinde = await publicService.getDeslindeActivo();
    return reply.send(deslinde);
  }

  async getEmpresa(_request: FastifyRequest, reply: FastifyReply) {
    const empresa = await publicService.getEmpresa();
    return reply.send(empresa);
  }

  async getFaqs(_request: FastifyRequest, reply: FastifyReply) {
    const faqs = await publicService.getFaqs();
    return reply.send(faqs);
  }

  async getReglasOperativas(_request: FastifyRequest, reply: FastifyReply) {
    const reglas = await publicService.getReglasOperativas();
    return reply.send(reglas);
  }

  async getReserva(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { id } = request.params;
    const reserva = await publicService.getReservaPublica(id);
    if (!reserva) {
      return reply.status(404).send({ error: 'Reserva no encontrada' });
    }
    return reply.send(reserva);
  }

  async getVoucherPdf(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { id } = request.params;
    const result = await publicService.generarVoucherPdf(id);
    if (!result) {
      return reply.status(404).send({ error: 'Reserva no encontrada' });
    }
    return reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="${result.filename}"`)
      .header('Content-Length', String(result.buffer.length))
      .send(result.buffer);
  }

  async postFirmaDeslinde(
    request: FastifyRequest<{ Params: { id: string }; Body: RegistrarFirmaDTO }>,
    reply: FastifyReply
  ) {
    const { id } = request.params;
    const body = (request.body as any) || {};

    // Validación estricta del payload público (Zod): sin ella el endpoint
    // aceptaba cuerpos arbitrarios directamente contra la base de datos.
    const parsed = FirmaDeslindePayloadSchema.safeParse(body);
    if (!parsed.success) {
      const detalles = parsed.error.issues.map((i) => i.message).join('; ');
      return reply.status(400).send({ error: `Datos de firma inválidos: ${detalles}` });
    }
    // Normaliza nulls del schema Zod a undefined del contrato del servicio.
    const datosFirma: RegistrarFirmaDTO = {
      firmaBase64: parsed.data.firmaBase64,
      rutDni: parsed.data.rutDni ?? undefined,
      contactoEmergencia: parsed.data.contactoEmergencia ?? undefined,
      telefonoEmergencia: parsed.data.telefonoEmergencia ?? undefined,
      condicionFisica: parsed.data.condicionFisica ?? undefined,
      pesoVerificado: parsed.data.pesoVerificado ?? undefined,
    };

    try {
      const res = await publicService.registrarFirmaDeslinde(id, datosFirma, {
        ip: request.ip,
        userAgent: request.headers['user-agent'] || null,
      });
      return reply.send(res);
    } catch (err: any) {
      const msg = String(err?.message ?? '').toLowerCase();
      if (err.statusCode === 400 || msg.includes('cancelada') || msg.includes('cerrada') || msg.includes('no se puede') || msg.includes('requerida')) {
        return reply.status(400).send({ error: err.message });
      }
      if (err.statusCode === 404 || msg.includes('no encontrado')) {
        return reply.status(404).send({ error: err.message });
      }
      return reply.status(500).send({ error: err.message || 'Error al registrar firma de deslinde' });
    }
  }

  async getPantalla(request: FastifyRequest<{ Querystring: { token?: string } }>, reply: FastifyReply) {
    const rawToken = request.query ? request.query.token : undefined;
    const authHeader = request.headers.authorization;
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    const token = rawToken || bearerToken;

    try {
      const data = await publicService.getPantalla(token);
      return reply.send(data);
    } catch (err: any) {
      if (err.statusCode === 401 || err.code?.startsWith('LINK_')) {
        return reply.code(401).send({
          error: err.code || 'LINK_INVALIDO',
          message: err.message,
        });
      }
      return reply.status(500).send({ error: err.message });
    }
  }
}

export const publicController = new PublicController();
