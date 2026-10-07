import { randomBytes } from 'crypto';
import { dateKeyLocal, fechaHoraLocalToIso } from '@parapente/shared';
import { prisma } from '../plugins/prisma';

export type PantallaTokenTipo = 'DIARIO' | 'TV';

const TV_DURACION_MS = 7 * 24 * 60 * 60 * 1000;

function finDeHoy(): Date {
  // Fin del día civil local (America/Santiago): el token DIARIO debe expirar a
  // la medianoche local, no a la medianoche del servidor (20:00/21:00 local).
  return new Date(new Date(fechaHoraLocalToIso(dateKeyLocal(), '23:59')).getTime() + 59_999);
}

export class PantallaTokensService {
  async getOrCreate(tipo: PantallaTokenTipo, creadoPor?: number) {
    const vigenteHasta = tipo === 'DIARIO' ? finDeHoy() : new Date();
    const existing = await prisma.pantallaToken.findFirst({
      where: { tipo, expiraEn: { gt: vigenteHasta } },
      orderBy: { expiraEn: 'desc' },
    });
    if (existing) {
      return { token: existing.token, expiraEn: existing.expiraEn };
    }
    return this.create(tipo, creadoPor);
  }

  async create(tipo: PantallaTokenTipo, creadoPor?: number) {
    const token = randomBytes(32).toString('hex');
    const expiraEn = tipo === 'DIARIO' ? finDeHoy() : new Date(Date.now() + TV_DURACION_MS);
    await prisma.pantallaToken.create({ data: { tipo, token, expiraEn, creadoPor } });
    return { token, expiraEn };
  }

  async regenerar(tipo: PantallaTokenTipo, creadoPor?: number) {
    const vigenteHasta = tipo === 'DIARIO' ? finDeHoy() : new Date();
    await prisma.pantallaToken.updateMany({
      where: { tipo, expiraEn: { gt: vigenteHasta } },
      data: { expiraEn: new Date() },
    });
    return this.create(tipo, creadoPor);
  }

  async validar(token: string) {
    const row = await prisma.pantallaToken.findUnique({ where: { token } });
    if (!row || row.expiraEn <= new Date()) {
      return null;
    }
    if (row.tipo === 'TV') {
      await prisma.pantallaToken.update({
        where: { id: row.id },
        data: { expiraEn: new Date(Date.now() + TV_DURACION_MS) },
      });
    }
    return { tipo: row.tipo as PantallaTokenTipo };
  }
}

export const pantallaTokensService = new PantallaTokensService();
