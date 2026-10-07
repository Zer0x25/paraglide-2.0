import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../plugins/prisma';
import { FastifyInstance } from 'fastify';
import { LoginPayload, GoogleLoginPayload } from '@parapente/shared';
import { config } from '../config';

export class AuthService {
  private fastify: FastifyInstance;

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;
  }

  async login(payload: LoginPayload) {
    const user = await prisma.user.findFirst({
      where: { email: payload.email, deletedAt: null },
    });

    if (!user) {
      const err: any = new Error('Credenciales inválidas');
      err.statusCode = 401;
      throw err;
    }

    if (!user.password) {
      const err: any = new Error('Esta cuenta usa inicio de sesión con Google');
      err.statusCode = 401;
      throw err;
    }

    const isValid = await bcrypt.compare(payload.password, user.password);

    if (!isValid) {
      const err: any = new Error('Credenciales inválidas');
      err.statusCode = 401;
      throw err;
    }

    const userPayload = {
      id: user.id,
      email: user.email,
      nombre: user.nombre,
      role: user.role,
      pilotoId: user.pilotoId,
    };

    // ADR 013: single-session. Incrementamos sessionVersion en cada login
    // para invalidar cualquier JWT previo de este usuario (nuevo login
    // revoca las sesiones anteriores). El nuevo valor viaja como claim `sv`.
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { sessionVersion: { increment: 1 } },
    });

    const token = this.fastify.jwt.sign(
      { ...userPayload, sv: updated.sessionVersion },
      { expiresIn: '7d' },
    );

    return {
      token,
      user: userPayload,
    };
  }

  async loginGoogle(payload: GoogleLoginPayload) {
    if (!config.googleClientId) {
      const err: any = new Error('Login con Google no configurado');
      err.statusCode = 500;
      throw err;
    }

    const client = new OAuth2Client(config.googleClientId);
    let ticket;
    try {
      ticket = await client.verifyIdToken({
        idToken: payload.credential,
        audience: config.googleClientId,
      });
    } catch {
      const err: any = new Error('Token de Google inválido');
      err.statusCode = 401;
      throw err;
    }

    const gPayload = ticket.getPayload();
    if (!gPayload?.email || !gPayload.sub) {
      const err: any = new Error('Token de Google inválido');
      err.statusCode = 401;
      throw err;
    }
    if (gPayload.email_verified === false) {
      const err: any = new Error('Email de Google no verificado');
      err.statusCode = 401;
      throw err;
    }

    const email = gPayload.email;
    const googleId = gPayload.sub;
    const nombre = gPayload.name || gPayload.given_name || email.split('@')[0];

    // 1) Buscar por googleId
    let user = await prisma.user.findFirst({
      where: { googleId, deletedAt: null },
    });

    // 2) Si no, buscar por email y vincular
    if (!user) {
      const byEmail = await prisma.user.findFirst({
        where: { email, deletedAt: null },
      });
      if (byEmail) {
        // Si ya tenía otro googleId distinto -> conflicto
        if (byEmail.googleId && byEmail.googleId !== googleId) {
          const err: any = new Error('Esta cuenta ya está vinculada a otra cuenta de Google');
          err.statusCode = 409;
          throw err;
        }
        if (!byEmail.googleId) {
          user = await prisma.user.update({
            where: { id: byEmail.id },
            data: { googleId },
          });
        } else {
          user = byEmail;
        }
      }
    }

    // 3) Si no existe ninguno, crear usuario nuevo (RECEPCION por defecto)
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          nombre,
          role: 'RECEPCION',
          googleId,
          password: null,
        },
      });
    }

    const userPayload = {
      id: user.id,
      email: user.email,
      nombre: user.nombre,
      role: user.role,
      pilotoId: user.pilotoId,
    };

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { sessionVersion: { increment: 1 } },
    });

    const token = this.fastify.jwt.sign(
      { ...userPayload, sv: updated.sessionVersion },
      { expiresIn: '7d' },
    );

    return {
      token,
      user: userPayload,
    };
  }
}
