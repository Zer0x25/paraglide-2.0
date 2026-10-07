import { FastifyRequest, FastifyReply } from 'fastify';
import { plantillasService } from '../services/plantillas.service';
import { pantallaTokensService } from '../services/pantallaTokens.service';
import { config } from '../config';
import { CreatePlantillaMensajePayloadSchema } from '@parapente/shared';

export class PlantillasController {
  async getAll(req: FastifyRequest<{ Querystring: Record<string, string | undefined> }>, reply: FastifyReply) {
    const plantillas = await plantillasService.getAll(req.query || {});
    return reply.send(plantillas);
  }

  async getById(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const id = Number(req.params.id);
    const plantilla = await plantillasService.getById(id);
    if (!plantilla) {
      return reply.code(404).send({ message: 'Plantilla no encontrada' });
    }
    return reply.send(plantilla);
  }

  async create(req: FastifyRequest, reply: FastifyReply) {
    const data = CreatePlantillaMensajePayloadSchema.parse(req.body);
    const nueva = await plantillasService.create(data);
    return reply.code(201).send(nueva);
  }

  async update(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const id = Number(req.params.id);
    const data = req.body as any;
    const actualizada = await plantillasService.update(id, data);
    return reply.send(actualizada);
  }

  async delete(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const id = Number(req.params.id);
    await plantillasService.delete(id);
    return reply.send({ message: 'Plantilla eliminada correctamente' });
  }

  async render(
    req: FastifyRequest<{
      Body: {
        tipo?: string;
        cuerpo?: string;
        variables?: Record<string, string> | string;
        plantillaId?: number;
        plantillaDraft?: { tipo?: string; cuerpo?: string };
      };
    }>,
    reply: FastifyReply
  ) {
    const body = req.body || {};

    // El web envía dos formatos además del contrato original { tipo, cuerpo }:
    //   - preview: { plantillaDraft: { tipo, cuerpo }, variables } (JSON.stringify)
    //   - desde BD: { plantillaId, variables } (JSON.stringify)
    // Normalizamos todos a tipo/cuerpo + variables (objeto).
    let { tipo, cuerpo, variables } = body;
    if (body.plantillaDraft?.cuerpo) {
      cuerpo = body.plantillaDraft.cuerpo;
      tipo = body.plantillaDraft.tipo || tipo;
    }
    if (body.plantillaId != null && !cuerpo && !tipo) {
      const p = await plantillasService.getById(Number(body.plantillaId));
      cuerpo = p?.cuerpo || '';
    }
    let vars: Record<string, string> = {};
    if (typeof variables === 'string') {
      try {
        vars = JSON.parse(variables);
      } catch {
        vars = {};
      }
    } else if (variables && typeof variables === 'object') {
      vars = variables;
    }

    let templateText = cuerpo;
    if (tipo && !templateText) {
      const p = await plantillasService.getByTipo(tipo);
      templateText = p?.cuerpo || '';
    }
    const renderizado = plantillasService.render(templateText || '', vars);
    if (renderizado.includes('{{link_pantalla}}')) {
      const { token } = await pantallaTokensService.getOrCreate('DIARIO');
      const protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
      const host =
        (req.headers['x-forwarded-host'] as string) ||
        (req.headers.host as string) ||
        config.webUrl.replace(/^https?:\/\//, '');
      const urlPantalla = `${protocol}://${host}/pantalla?token=${token}`;
      return reply.send({ texto: renderizado.replaceAll('{{link_pantalla}}', urlPantalla) });
    }
    return reply.send({ texto: renderizado });
  }
}

export const plantillasController = new PlantillasController();
