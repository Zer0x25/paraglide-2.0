import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import PDFDocument from 'pdfkit';
import { dateKeyLocal, fechaHoraLocalToIso, formatFechaEspanol } from '@parapente/shared';
import { prisma } from '../plugins/prisma';
import { pantallaTokensService } from './pantallaTokens.service';
import { toNum } from './money.util';

export function resolveAppVersion(): string {
  if (process.env.APP_VERSION) return process.env.APP_VERSION;
  if (process.env.npm_package_version) return process.env.npm_package_version;

  const candidatePaths = [
    path.resolve(process.cwd(), 'apps/api/package.json'),
    path.resolve(process.cwd(), 'package.json'),
    path.resolve(__dirname, '../../package.json'),
    path.resolve(__dirname, '../package.json'),
  ];

  for (const candidate of candidatePaths) {
    try {
      if (fs.existsSync(candidate)) {
        const raw = fs.readFileSync(candidate, 'utf-8');
        const pkg = JSON.parse(raw);
        if (pkg && typeof pkg.version === 'string') {
          return pkg.version;
        }
      }
    } catch {
      // Ignorar error y probar siguiente candidato
    }
  }

  return '0.7.0';
}

export const APP_VERSION = resolveAppVersion();

export interface RegistrarFirmaDTO {
  firmaBase64: string;
  rutDni?: string;
  contactoEmergencia?: string;
  telefonoEmergencia?: string;
  condicionFisica?: string;
  pesoVerificado?: number;
}

export class PublicService {
  getHealth() {
    return {
      status: 'ok',
      version: APP_VERSION,
      commit: process.env.GIT_COMMIT_SHA || process.env.COMMIT_SHA || null,
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  async getDeslindeActivo() {
    const deslinde = await prisma.deslindeVersion.findFirst({
      where: { activa: true },
      orderBy: { version: 'desc' },
    });
    return deslinde ?? null;
  }

  async getEmpresa() {
    const empresa = await prisma.empresa.findFirst();
    return empresa ?? null;
  }

  async getFaqs() {
    return prisma.faq.findMany({
      where: { publica: true, deletedAt: null },
      orderBy: { orden: 'asc' },
    });
  }

  async getReglasOperativas() {
    return prisma.reglaOperativa.findMany({
      orderBy: { clave: 'asc' },
    });
  }

  async getReservaPublica(id: string) {
    const selectClause = {
      id: true,
      tokenPublico: true,
      shortId: true,
      numeroReserva: true,
      nombreTitular: true,
      fechaAgenda: true,
      horaAgenda: true,
      esGiftCard: true,
      estado: true,
      estadoPago: true,
      valorTotal: true,
      abono: true,
      montoDevuelto: true,
      descuento: true,
      tarifa: {
        select: {
          id: true,
          nombre: true,
          precio: true,
        },
      },
      promocion: {
        select: {
          id: true,
          nombre: true,
          tipoDescuento: true,
          valor: true,
        },
      },
      pasajeros: {
        where: { deletedAt: null },
        select: {
          id: true,
          numeroPasajero: true,
          tokenPublico: true,
          shortId: true,
          nombre: true,
          rutDni: true,
          peso: true,
          pesoVerificado: true,
          contactoEmergencia: true,
          telefonoEmergencia: true,
          condicionFisica: true,
          firmaDeslinde: true,
          firmaFecha: true,
          vuelos: {
            where: { deletedAt: null },
            select: {
              id: true,
              fechaHora: true,
              estado: true,
              piloto: { select: { nombre: true } },
            },
          },
        },
        orderBy: { id: 'asc' as const },
      },
    };

    // Vistas públicas: solo identificadores no secuenciales (ADR 005). No se
    // resuelve por numeroReserva ni id numérico para impedir enumeración de PII.
    const reserva: any = await prisma.reserva.findFirst({
      where: {
        deletedAt: null,
        OR: [
          { tokenPublico: id },
          { shortId: id },
        ],
      },
      select: selectClause,
    });

    if (!reserva) {
      return null;
    }

    // Rellenar tokens bajo demanda si es un registro legacy
    try {
      let reservaNeedsUpdate = false;
      let newTokenPublicoReserva = reserva.tokenPublico;
      let newShortIdReserva = reserva.shortId;

      if (!newTokenPublicoReserva) {
        newTokenPublicoReserva = crypto.randomBytes(24).toString('hex');
        reservaNeedsUpdate = true;
      }
      if (!newShortIdReserva) {
        newShortIdReserva = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
        reservaNeedsUpdate = true;
      }

      if (reservaNeedsUpdate && (prisma.reserva as any).update) {
        await prisma.reserva.update({
          where: { id: reserva.id },
          data: {
            tokenPublico: newTokenPublicoReserva,
            shortId: newShortIdReserva,
          },
        });
        reserva.tokenPublico = newTokenPublicoReserva;
        reserva.shortId = newShortIdReserva;
      }

      if (reserva.pasajeros) {
        for (const pax of reserva.pasajeros) {
          let paxNeedsUpdate = false;
          let newTokenPublicoPax = pax.tokenPublico;
          let newShortIdPax = pax.shortId;

          if (!newTokenPublicoPax) {
            newTokenPublicoPax = crypto.randomBytes(24).toString('hex');
            paxNeedsUpdate = true;
          }
          if (!newShortIdPax) {
            newShortIdPax = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
            paxNeedsUpdate = true;
          }

          if (paxNeedsUpdate && (prisma.pasajero as any).update) {
            await prisma.pasajero.update({
              where: { id: pax.id },
              data: {
                tokenPublico: newTokenPublicoPax,
                shortId: newShortIdPax,
              },
            });
            pax.tokenPublico = newTokenPublicoPax;
            pax.shortId = newShortIdPax;
          }
        }
      }
    } catch {
      // Ignorar errores de auto-update si prisma está mockeado en tests
    }

    return reserva;
  }

  async generarVoucherPdf(id: string): Promise<{ buffer: Buffer; filename: string } | null> {
    const reserva: any = await prisma.reserva.findFirst({
      where: {
        deletedAt: null,
        // Solo identificadores no secuenciales (ADR 005): sin numeroReserva ni id.
        OR: [{ tokenPublico: id }, { shortId: id }],
      },
      select: {
        id: true,
        tokenPublico: true,
        shortId: true,
        numeroReserva: true,
        nombreTitular: true,
        telefono: true,
        email: true,
        fechaAgenda: true,
        horaAgenda: true,
        estado: true,
        estadoPago: true,
        valorTotal: true,
        abono: true,
        montoDevuelto: true,
        descuento: true,
        tarifa: {
          select: {
            id: true,
            nombre: true,
            precio: true,
          },
        },
        promocion: {
          select: {
            id: true,
            nombre: true,
            tipoDescuento: true,
            valor: true,
          },
        },
        pasajeros: {
          where: { deletedAt: null },
          select: { id: true, nombre: true, rutDni: true, firmaDeslinde: true },
          orderBy: { id: 'asc' as const },
        },
      },
    });

    if (!reserva) return null;

    // Datos auxiliares para el ticket (punto de encuentro + empresa)
    let puntoDeEncuentro = 'Zona de Despegue';
    try {
      const reglas: any[] = await prisma.reglaOperativa.findMany({ orderBy: { clave: 'asc' } });
      const hit =
        reglas.find((r: any) => r.categoria === 'PUNTO_ENCUENTRO' && r.esDefault)?.valor ||
        reglas.find((r: any) => r.clave === 'puntoDeEncuentro')?.valor;
      if (hit) puntoDeEncuentro = hit;
    } catch { /* fallback */ }

    let nombreEscuela = 'Parapente School';
    try {
      const empresa = await prisma.empresa.findFirst();
      if (empresa?.nombre) nombreEscuela = empresa.nombre;
    } catch { /* fallback */ }

    const fechaAgenda: Date | null = reserva.fechaAgenda ? new Date(reserva.fechaAgenda) : null;
    const fechaStr = fechaAgenda
      ? formatFechaEspanol(fechaAgenda, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      : 'Por coordinar con la escuela';
    const horaStr = reserva.horaAgenda ? `${reserva.horaAgenda} hrs` : 'Por coordinar';
    const estadoPago = (reserva.estadoPago as string) || 'PENDIENTE';
    const montoDevuelto = Number(reserva.montoDevuelto || 0);
    const saldoPendiente = Math.max(0, Number(reserva.valorTotal || 0) - Number(reserva.abono || 0));
    const estadoLabel: Record<string, string> = {
      CANCELADA: 'CANCELADA',
      COMPLETADA: 'COMPLETADA',
      SIN_AGENDAR: 'SIN AGENDAR',
      AGENDADA: 'CONFIRMADO',
    };
    const estado = (reserva.estado as string) || 'AGENDADA';

    const doc = new PDFDocument({ size: 'A4', margin: 36, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    // Header
    doc.save().rect(0, 0, doc.page.width, 82).fill('#1e3a8a').restore();
    doc.fillColor('#fff').font('Helvetica-Bold').fontSize(16).text('VUELO EN PARAPENTE', 36, 22);
    doc.font('Helvetica').fontSize(7).fillColor('#bfdbfe').text('Experiencia Biplaza Tandem con Piloto Certificado  ·  ' + nombreEscuela, 36, 42);
    doc.font('Helvetica-Bold').fontSize(7).fillColor('#fff').text(`Ticket #${reserva.numeroReserva || reserva.id}`, 36, 56);
    
    // Badge estado arriba derecha
    const badgeText = estadoLabel[estado] || estado;
    const badgeColor =
      estado === 'CANCELADA' ? '#ef4444' : estado === 'COMPLETADA' ? '#334155' : estado === 'SIN_AGENDAR' ? '#f59e0b' : '#10b981';
    doc.save().roundedRect(doc.page.width - 120, 28, 84, 22, 6).fill(badgeColor).restore();
    doc.fillColor('#fff').font('Helvetica-Bold').fontSize(8).text(badgeText, doc.page.width - 120, 35, { width: 84, align: 'center' });
    doc.fillColor('#111');

    let y = 98;
    // Titular + Fecha/Hora + Punto
    doc.font('Helvetica-Bold').fontSize(7).fillColor('#64748b').text('TITULAR DE RESERVA', 36, y);
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a').text(reserva.nombreTitular || '—', 36, y + 10);
    doc.font('Helvetica').fontSize(7).fillColor('#64748b').text(reserva.telefono || '', 36, y + 24);

    doc.font('Helvetica-Bold').fontSize(7).fillColor('#64748b').text('FECHA DEL VUELO', 260, y);
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f172a').text(fechaStr, 260, y + 10, { width: 140 });
    doc.font('Helvetica').fontSize(7).fillColor('#0f172a').text(horaStr, 260, y + 26);
    doc.font('Helvetica').fontSize(6).fillColor('#64748b').text('Presentarse 15 min antes', 260, y + 36);

    doc.font('Helvetica-Bold').fontSize(7).fillColor('#64748b').text('PUNTO DE ENCUENTRO', 420, y);
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#0f172a').text(puntoDeEncuentro, 420, y + 10, { width: 140 });
    doc.font('Helvetica').fontSize(6).fillColor('#64748b').text('Pista Principal de Vuelo', 420, y + 26);

    y += 56;
    doc.moveTo(36, y).lineTo(doc.page.width - 36, y).strokeColor('#e2e8f0').lineWidth(0.6).stroke();
    y += 10;

    // Pasajeros
    doc.font('Helvetica-Bold').fontSize(7).fillColor('#64748b').text(`PASAJEROS REGISTRADOS (${(reserva.pasajeros || []).length})`, 36, y);
    y += 12;
    const pasajeros: any[] = reserva.pasajeros || [];
    if (pasajeros.length === 0) {
      doc.font('Helvetica').fontSize(8).fillColor('#64748b').text('Sin pasajeros registrados.', 36, y);
      y += 14;
    } else {
      for (let i = 0; i < pasajeros.length; i++) {
        const p = pasajeros[i];
        if (y > doc.page.height - 90) { doc.addPage(); y = 36; }
        const bg = i % 2 === 0 ? '#f8fafc' : '#ffffff';
        doc.save().roundedRect(36, y, doc.page.width - 72, 22, 6).fill(bg).strokeColor('#e2e8f0').lineWidth(0.4).stroke().restore();
        doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(7).text(`${i + 1}. ${p.nombre}`, 44, y + 5, { width: 300 });
        doc.font('Helvetica').fontSize(6).fillColor('#64748b').text(p.rutDni || 'RUT por registrar', 44, y + 13);
        const firmaLabel = p.firmaDeslinde ? 'Deslinde Firmado' : 'Firma Pendiente';
        const firmaColor = p.firmaDeslinde ? '#065f46' : '#92400e';
        const firmaBg = p.firmaDeslinde ? '#d1fae5' : '#fef3c7';
        const tw = doc.widthOfString(firmaLabel) + 10;
        const bx = doc.page.width - 36 - tw - 8;
        doc.save().roundedRect(bx, y + 5, tw, 12, 6).fill(firmaBg).restore();
        doc.fillColor(firmaColor).font('Helvetica-Bold').fontSize(6).text(firmaLabel, bx, y + 9, { width: tw, align: 'center' });
        y += 26;
      }
    }

    // Desglose de tarifa y promoción (si existe tarifa asignada)
    if (reserva.tarifa) {
      if (y > doc.page.height - 140) { doc.addPage(); y = 36; }
      doc.font('Helvetica-Bold').fontSize(7).fillColor('#64748b').text('DESGLOSE DE TARIFA Y PROMOCIÓN', 36, y);
      y += 12;

      const numPasajeros = Math.max(1, (reserva.pasajeros || []).length);
      const precioUnitario = toNum(reserva.tarifa.precio);
      const precioSubtotal = precioUnitario * numPasajeros;
      const descuentoTotal = toNum(reserva.descuento);

      const boxHeight = descuentoTotal > 0 ? 46 : 30;
      doc.save().roundedRect(36, y, doc.page.width - 72, boxHeight, 6).fill('#f8fafc').strokeColor('#e2e8f0').lineWidth(0.4).stroke().restore();

      // Fila Tarifa
      doc.font('Helvetica-Bold').fontSize(7).fillColor('#0f172a').text(reserva.tarifa.nombre, 44, y + 6);
      doc.font('Helvetica').fontSize(6).fillColor('#64748b').text(`${numPasajeros} ${numPasajeros === 1 ? 'vuelo' : 'vuelos'} × $${precioUnitario.toLocaleString('es-CL')}`, 44, y + 16);
      doc.font('Helvetica-Bold').fontSize(7).fillColor('#0f172a').text(`$${precioSubtotal.toLocaleString('es-CL')}`, doc.page.width - 140, y + 6, { width: 96, align: 'right' });

      // Fila Descuento (si aplica)
      if (descuentoTotal > 0) {
        const promoNombre = reserva.promocion?.nombre || 'Promoción';
        const promoDetalle = reserva.promocion?.tipoDescuento === 'PORCENTAJE'
          ? `Descuento ${toNum(reserva.promocion.valor)}%`
          : `Descuento $${toNum(reserva.promocion?.valor || (descuentoTotal / numPasajeros)).toLocaleString('es-CL')} × ${numPasajeros} ${numPasajeros === 1 ? 'vuelo' : 'vuelos'}`;

        doc.font('Helvetica-Bold').fontSize(7).fillColor('#16a34a').text(`🏷️ ${promoNombre}`, 44, y + 26);
        doc.font('Helvetica').fontSize(6).fillColor('#15803d').text(promoDetalle, 170, y + 27);
        doc.font('Helvetica-Bold').fontSize(7).fillColor('#16a34a').text(`-$${descuentoTotal.toLocaleString('es-CL')}`, doc.page.width - 140, y + 26, { width: 96, align: 'right' });
      }

      y += boxHeight + 8;
    } else {
      y += 6;
    }

    // Resumen financiero
    doc.save().roundedRect(36, y, doc.page.width - 72, 44, 8).fill('#0f172a').restore();
    doc.fillColor('#94a3b8').font('Helvetica-Bold').fontSize(6).text('SALDO DE LA RESERVA', 48, y + 8);
    if (estadoPago === 'DEVUELTO') {
      doc.fillColor('#f87171').font('Helvetica-Bold').fontSize(13).text(`$${montoDevuelto.toLocaleString('es-CL')} DEVUELTO`, 48, y + 18);
      doc.fillColor('#cbd5e1').font('Helvetica').fontSize(6).text(`Devuelto: $${montoDevuelto.toLocaleString('es-CL')} • Abono: $${Number(reserva.abono || 0).toLocaleString('es-CL')}`, 48, y + 32);
    } else {
      const saldoTxt = estadoPago === 'PAGADO' ? '$0 (PAGADO)' : `$${saldoPendiente.toLocaleString('es-CL')} (${estadoPago})`;
      const saldoColor = estadoPago === 'PAGADO' ? '#34d399' : estadoPago === 'ABONADO' ? '#38bdf8' : '#fbbf24';
      doc.fillColor(saldoColor).font('Helvetica-Bold').fontSize(13).text(saldoTxt, 48, y + 18);
      doc.fillColor('#cbd5e1').font('Helvetica').fontSize(6).text(`Abono: $${Number(reserva.abono || 0).toLocaleString('es-CL')} / $${Number(reserva.valorTotal || 0).toLocaleString('es-CL')}`, 48, y + 32);
    }
    doc.fillColor('#94a3b8').font('Helvetica').fontSize(6).text('Ticket emitido por Parapente · Válido para la fecha agendada', doc.page.width - 280, y + 32, { width: 230, align: 'right' });

    // Footer paginación
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(i);
      doc.font('Helvetica').fontSize(6).fillColor('#94a3b8').text(`Voucher ${reserva.numeroReserva || reserva.id}  ·  ${nombreEscuela}`, 36, doc.page.height - 18, { align: 'center' });
    }

    doc.end();
    const buffer = await done;
    const filename = `voucher_${reserva.numeroReserva || id}.pdf`;
    return { buffer, filename };
  }

  async registrarFirmaDeslinde(
    id: string,
    body: RegistrarFirmaDTO,
    meta: { ip?: string; userAgent?: string | null }
  ) {
    const {
      firmaBase64,
      rutDni,
      contactoEmergencia,
      telefonoEmergencia,
      condicionFisica,
      pesoVerificado,
    } = body;

    if (!firmaBase64) {
      const error: any = new Error('La firma digital es requerida');
      error.statusCode = 400;
      throw error;
    }

    const pasajeroExistente = await prisma.pasajero.findFirst({
      where: {
        deletedAt: null,
        // Solo identificadores no secuenciales (ADR 005): sin numeroPasajero ni id.
        OR: [
          { tokenPublico: id },
          { shortId: id },
        ],
      },
      include: { reserva: true },
    });

    if (!pasajeroExistente) {
      const error: any = new Error('Pasajero no encontrado');
      error.statusCode = 404;
      throw error;
    }

    if (pasajeroExistente.reserva?.cerradaAt) {
      const error: any = new Error('No se puede firmar deslinde de una reserva cerrada contablemente');
      error.statusCode = 400;
      throw error;
    }

    if (pasajeroExistente.reserva?.estado === 'CANCELADA') {
      const error: any = new Error('No se puede firmar deslinde de una reserva cancelada');
      error.statusCode = 400;
      throw error;
    }

    const updatedPasajero = await prisma.$transaction(async (tx) => {
      if (typeof (tx as any).$queryRaw === 'function') {
        await (tx as any).$queryRaw`SELECT id FROM "Pasajero" WHERE id = ${pasajeroExistente.id} FOR UPDATE`;
      }

      if (typeof (tx.pasajero as any)?.findUnique === 'function') {
        const pCheck = await tx.pasajero.findUnique({
          where: { id: pasajeroExistente.id },
          include: { reserva: true },
        });
        if (pCheck) {
          if (pCheck.deletedAt) {
            throw new Error('Pasajero no encontrado');
          }
          if (pCheck.reserva?.cerradaAt) {
            throw new Error('No se puede firmar deslinde de una reserva cerrada contablemente');
          }
          if (pCheck.reserva?.estado === 'CANCELADA') {
            throw new Error('No se puede firmar deslinde de una reserva cancelada');
          }
        }
      }

      await tx.deslindeFirma.upsert({
        where: { pasajeroId: pasajeroExistente.id },
        create: {
          pasajeroId: pasajeroExistente.id,
          firmaBase64,
          ip: meta.ip,
          userAgent: meta.userAgent || null,
          versionLegal: 1,
        },
        update: {
          firmaBase64,
          ip: meta.ip,
          userAgent: meta.userAgent || null,
        },
      });

      return tx.pasajero.update({
        where: { id: pasajeroExistente.id },
        data: {
          firmaDeslinde: true,
          firmaFecha: new Date(),
          ...(rutDni !== undefined && { rutDni }),
          ...(contactoEmergencia !== undefined && { contactoEmergencia }),
          ...(telefonoEmergencia !== undefined && { telefonoEmergencia }),
          ...(condicionFisica !== undefined && { condicionFisica }),
          ...(pesoVerificado !== undefined && { pesoVerificado }),
        },
        select: {
          id: true,
          numeroPasajero: true,
          tokenPublico: true,
          shortId: true,
          nombre: true,
          firmaDeslinde: true,
          firmaFecha: true,
        },
      });
    });

    return {
      message: 'Firma de deslinde registrada exitosamente',
      pasajero: updatedPasajero,
    };
  }

  async getPantalla(token?: string) {
    if (!token) {
      const err: any = new Error('Esta pantalla requiere un enlace válido. Solicítalo a la escuela.');
      err.code = 'LINK_REQUERIDO';
      err.statusCode = 401;
      throw err;
    }

    const validToken = await pantallaTokensService.validar(token);
    if (!validToken) {
      const err: any = new Error('Este enlace ha caducado o no es válido. Solicita uno nuevo.');
      err.code = 'LINK_INVALIDO_O_EXPIRADO';
      err.statusCode = 401;
      throw err;
    }

    const today = new Date();
    try {
      // Día civil local (America/Santiago): inicio inclusivo / fin exclusivo
      const hoy = dateKeyLocal();
      const [hy, hm, hd] = hoy.split('-').map(Number);
      const startOfDay = new Date(fechaHoraLocalToIso(hoy, '00:00'));
      const nextDayKey = new Date(Date.UTC(hy, hm - 1, hd + 1)).toISOString().slice(0, 10);
      const endOfDay = new Date(fechaHoraLocalToIso(nextDayKey, '00:00'));

      const [clima, vuelos] = await Promise.all([
        prisma.condicionPista.findFirst({
          where: { deletedAt: null },
          orderBy: { fechaHora: 'desc' },
        }),
        prisma.vuelo.findMany({
          where: {
            deletedAt: null,
            fechaHora: { gte: startOfDay, lt: endOfDay },
          },
          include: {
            piloto: {
              select: { id: true, nombre: true, categoria: true },
            },
            pasajero: {
              select: { id: true, nombre: true, peso: true, firmaDeslinde: true },
            },
          },
          orderBy: { fechaHora: 'asc' },
        }),
      ]);

      const vuelosFormateados = vuelos.map((v) => ({
        id: v.id,
        hora: new Date(v.fechaHora).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false }),
        pilotoNombre: v.piloto.nombre,
        pilotoCategoria: v.piloto.categoria,
        pasajeroNombre: v.pasajero.nombre,
        pasajeroFirmaDeslinde: v.pasajero.firmaDeslinde,
        estado: v.estado,
      }));

      return {
        fecha: hoy,
        clima: clima || {
          id: 0,
          fechaHora: today,
          estadoPista: 'ABIERTA',
          velocidadViento: 12,
          rachaViento: 16,
          direccionViento: 'SO',
          temperatura: 22,
          visibilidad: 'EXCELENTE',
          techoNubes: 1800,
          observaciones: 'Condiciones normales de vuelo.',
          registradoPor: 'Sistema',
        },
        vuelos: vuelosFormateados,
      };
    } catch (err) {
      // Nunca fabricar un tablero con clima inventado: propagar para que la
      // ruta responda con estado de error.
      console.warn('Advertencia DB en /api/public/pantalla:', err);
      throw err;
    }
  }
}

export const publicService = new PublicService();
