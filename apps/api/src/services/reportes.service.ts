import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { prisma } from '../plugins/prisma';
import { toNum } from './money.util';
import {
  ManifiestoDiarioDTO,
  ReporteLiquidacionesDTO,
  dateKeyLocal,
  fechaHoraLocalToIso,
} from '@parapente/shared';

export interface LiquidacionQueryInput {
  mes?: number;
  year?: number;
  pilotoId?: number;
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export class ReportesService {
  async getManifiestoDiario(fecha?: string): Promise<ManifiestoDiarioDTO> {
    const targetDateStr = fecha || dateKeyLocal();

    try {
      const [year, month, day] = targetDateStr.split('-').map(Number);
      // Día civil local (America/Santiago): inicio inclusivo / fin exclusivo
      const startDate = new Date(fechaHoraLocalToIso(targetDateStr, '00:00'));
      const nextDayKey = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
      const endDate = new Date(fechaHoraLocalToIso(nextDayKey, '00:00'));

      const vuelos = await prisma.vuelo.findMany({
        where: {
          deletedAt: null,
          fechaHora: {
            gte: startDate,
            lt: endDate,
          },
        },
        include: {
          piloto: true,
          pasajero: {
            include: {
              reserva: true,
            },
          },
        },
        orderBy: {
          fechaHora: 'asc',
        },
      });

      const vuelosFormateados = vuelos.map((v) => {
        const horaStr = new Date(v.fechaHora).toLocaleTimeString('es-CL', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });

        return {
          id: v.id,
          hora: horaStr,
          fechaHora: v.fechaHora.toISOString(),
          estado: v.estado,
          pilotoId: v.pilotoId,
          pilotoNombre: v.piloto.nombre,
          pilotoLicencia: v.piloto.tieneLicencia,
          pilotoCategoria: v.piloto.categoria,
          pasajeroId: v.pasajeroId,
          pasajeroNombre: v.pasajero.nombre,
          pasajeroRut: v.pasajero.rutDni,
          pasajeroPeso: v.pasajero.peso,
          pasajeroPesoVerificado: v.pasajero.pesoVerificado,
          pasajeroContactoEmergencia: v.pasajero.contactoEmergencia,
          pasajeroTelefonoEmergencia: v.pasajero.telefonoEmergencia,
          pasajeroCondicionFisica: v.pasajero.condicionFisica,
          pasajeroFirmaDeslinde: v.pasajero.firmaDeslinde,
          reservaId: v.pasajero.reservaId,
          reservaNumero: v.pasajero.reserva?.numeroReserva || (v.pasajero.reservaId ? String(v.pasajero.reservaId) : null),
          reservaTitular: v.pasajero.reserva?.nombreTitular,
          reservaTelefono: v.pasajero.reserva?.telefono,
        };
      });

      const totalVuelos = vuelosFormateados.length;
      const totalCompletados = vuelosFormateados.filter((v) => v.estado === 'COMPLETADO').length;
      const totalFirmados = vuelosFormateados.filter((v) => v.pasajeroFirmaDeslinde).length;

      return {
        fecha: targetDateStr,
        totalVuelos,
        totalCompletados,
        totalFirmados,
        vuelos: vuelosFormateados,
      };
    } catch (err) {
      // Documento oficial: nunca entregar un manifiesto vacío inventado.
      console.warn('Advertencia DB en /reportes/manifiesto:', err);
      throw err;
    }
  }

  async generarManifiestoPdf(fecha?: string): Promise<{ buffer: Buffer; filename: string }> {
    const targetDateStr = fecha || dateKeyLocal();
    const [year, month, day] = targetDateStr.split('-').map(Number);
    // Día civil local (America/Santiago): inicio inclusivo / fin exclusivo
    const startDate = new Date(fechaHoraLocalToIso(targetDateStr, '00:00'));
    const nextDayKey = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
    const endDate = new Date(fechaHoraLocalToIso(nextDayKey, '00:00'));

    const vuelos = await prisma.vuelo.findMany({
      where: { deletedAt: null, fechaHora: { gte: startDate, lt: endDate } },
      include: { piloto: true, pasajero: { include: { reserva: true } } },
      orderBy: { fechaHora: 'asc' },
    });

    const totalVuelos = vuelos.length;
    const totalCompletados = vuelos.filter((v) => v.estado === 'COMPLETADO').length;
    const totalFirmados = vuelos.filter((v) => v.pasajero.firmaDeslinde).length;

    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 32, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    // Header
    doc
      .font('Helvetica-Bold')
      .fontSize(13)
      .text('MANIFIESTO DIARIO DE VUELO EN PARAPENTE', { align: 'center' });
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor('#555')
      .text('Control de Operaciones y Seguridad Operacional', { align: 'center' });
    doc.moveDown(0.6);
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor('#111')
      .text(
        `Fecha: ${targetDateStr}  |  Generado: ${new Date().toLocaleString('es-CL')}  |  Vuelos: ${totalVuelos}  |  Completados: ${totalCompletados}  |  Deslindes firmados: ${totalFirmados}/${totalVuelos}`,
        { align: 'center' }
      );
    doc.moveDown(0.8);
    doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).strokeColor('#111').lineWidth(1).stroke();
    doc.moveDown(0.8);

    if (vuelos.length === 0) {
      doc.font('Helvetica').fontSize(10).fillColor('#666').text('No hay vuelos programados para esta fecha.', { align: 'center' });
    } else {
      const colWidths = [42, 115, 135, 78, 42, 110, 62, 58];
      const headers = ['HORA', 'PILOTO', 'PASAJERO', 'RUT / DNI', 'PESO', 'CONTACTO EMERG.', 'DESLINDE', 'ESTADO'];
      const tableLeft = doc.page.margins.left;
      const rowH = 16;
      const headerH = 18;

      const drawHeader = (y: number) => {
        doc.save().rect(tableLeft, y, colWidths.reduce((a, b) => a + b, 0), headerH).fill('#0f172a').restore();
        let x = tableLeft;
        doc.font('Helvetica-Bold').fontSize(6).fillColor('#fff');
        headers.forEach((h, i) => {
          doc.text(h, x + 3, y + 6, { width: colWidths[i] - 6, align: i === 0 || i === 4 || i === 6 || i === 7 ? 'center' : 'left' });
          x += colWidths[i];
        });
        doc.fillColor('#111');
        return y + headerH;
      };

      let y = drawHeader(doc.y);
      doc.font('Helvetica').fontSize(6.5);

      const sanitizeText = (t: string | null | undefined, max = 28) => {
        const s = (t || '—').toString().replace(/\r?\n/g, ' ').trim();
        return s.length > max ? s.slice(0, max - 1) + '…' : s;
      };

      for (let idx = 0; idx < vuelos.length; idx++) {
        const v = vuelos[idx] as unknown as {
          id: number;
          fechaHora: Date;
          estado: string;
          piloto: { nombre: string; tieneLicencia: boolean; categoria: string | null };
          pasajero: {
            nombre: string;
            rutDni: string | null;
            peso: unknown;
            pesoVerificado: unknown;
            contactoEmergencia: string | null;
            telefonoEmergencia: string | null;
            firmaDeslinde: boolean;
            reserva: { numeroReserva: string | null } | null;
            reservaId: number | null;
          };
        };
        if (y + rowH > doc.page.height - doc.page.margins.bottom - 18) {
          doc.addPage();
          y = drawHeader(doc.page.margins.top);
          doc.font('Helvetica').fontSize(6.5).fillColor('#111');
        }
        const bg = idx % 2 === 0 ? '#f8fafc' : '#ffffff';
        doc.save().rect(tableLeft, y, colWidths.reduce((a, b) => a + b, 0), rowH).fill(bg).restore();
        doc.save().rect(tableLeft, y, colWidths.reduce((a, b) => a + b, 0), rowH).strokeColor('#e2e8f0').lineWidth(0.4).stroke().restore();

        const horaStr = new Date(v.fechaHora).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false });
        const peso = (v.pasajero.pesoVerificado as number | null) ?? (v.pasajero.peso as number | null);
        const cells = [
          horaStr,
          `${sanitizeText(v.piloto.nombre, 22)}\n${v.piloto.categoria ? 'Cat:' + v.piloto.categoria : ''}${v.piloto.tieneLicencia ? ' • Lic' : ' • S/Lic'}`.trim(),
          sanitizeText(v.pasajero.nombre, 22) + (v.pasajero.reserva?.numeroReserva ? `\n#${v.pasajero.reserva.numeroReserva}` : v.pasajero.reservaId ? `\n#${v.pasajero.reservaId}` : ''),
          sanitizeText(v.pasajero.rutDni, 14),
          peso != null ? `${peso}kg` : '—',
          sanitizeText(v.pasajero.contactoEmergencia ? `${v.pasajero.contactoEmergencia} ${v.pasajero.telefonoEmergencia || ''}` : '—', 18),
          v.pasajero.firmaDeslinde ? 'Firmado' : 'Pendiente',
          v.estado,
        ];
        let x = tableLeft;
        const isFirmado = v.pasajero.firmaDeslinde;
        for (let c = 0; c < cells.length; c++) {
          const align = c === 0 || c === 4 || c === 6 || c === 7 ? 'center' : 'left';
          if (c === 6) doc.fillColor(isFirmado ? '#065f46' : '#991b1b');
          else if (c === 7) doc.fillColor(v.estado === 'COMPLETADO' ? '#065f46' : v.estado === 'CANCELADO' ? '#991b1b' : '#1e40af');
          else doc.fillColor('#111');
          const txt = cells[c];
          const yy = txt.includes('\n') ? y + 2 : y + 5.5;
          doc.text(txt, x + 3, yy, { width: colWidths[c] - 6, align, lineGap: 1 });
          x += colWidths[c];
        }
        y += rowH;
      }

      doc.moveDown(0.6);
      doc.font('Helvetica-Bold').fontSize(7).fillColor('#334155').text(
        `Totales  ·  Programados: ${totalVuelos}  ·  Completados: ${totalCompletados}  ·  Deslindes firmados: ${totalFirmados}`,
        tableLeft,
        y + 6,
        { align: 'right', width: colWidths.reduce((a, b) => a + b, 0) }
      );
    }

    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(i);
      doc.font('Helvetica').fontSize(6).fillColor('#94a3b8')
        .text(`Página ${i + 1} / ${range.count}  —  Parapente · Manifiesto ${targetDateStr}`, doc.page.margins.left, doc.page.height - 18, { align: 'center' });
    }

    doc.end();
    const buffer = await done;
    const filename = `manifiesto_${targetDateStr}.pdf`;
    return { buffer, filename };
  }

  async getLiquidaciones(query: LiquidacionQueryInput): Promise<ReporteLiquidacionesDTO> {
    // Mes/año por defecto según el día civil local (America/Santiago)
    const [hoyYear, hoyMonth] = dateKeyLocal().split('-').map(Number);
    const targetMonth = query.mes !== undefined ? query.mes : hoyMonth - 1;
    const targetYear = query.year !== undefined ? query.year : hoyYear;

    try {
      const fechaInicio = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-01`;
      const nextMonthFirstDayKey = new Date(Date.UTC(targetYear, targetMonth + 1, 1)).toISOString().slice(0, 10);
      const fechaFin = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).toISOString().slice(0, 10);
      // Mes civil local (America/Santiago): inicio inclusivo / fin exclusivo
      const startDate = new Date(fechaHoraLocalToIso(fechaInicio, '00:00'));
      const endDate = new Date(fechaHoraLocalToIso(nextMonthFirstDayKey, '00:00'));

      const [pilotos, vuelos] = await Promise.all([
        prisma.piloto.findMany({
          where: {
            deletedAt: null,
            ...(query.pilotoId ? { id: query.pilotoId } : {}),
          },
          orderBy: { nombre: 'asc' },
        }),
        prisma.vuelo.findMany({
          where: {
            deletedAt: null,
            fechaHora: { gte: startDate, lt: endDate },
            ...(query.pilotoId ? { pilotoId: query.pilotoId } : {}),
          },
          include: {
            pasajero: true,
          },
          orderBy: { fechaHora: 'asc' },
        }),
      ]);

      let totalVuelosGlobal = 0;
      let totalMontoGlobal = 0;

      const pilotosLiquidacion = pilotos.map((p) => {
        const vuelosPiloto = vuelos.filter((v) => v.pilotoId === p.id);
        const vuelosCompletados = vuelosPiloto.filter((v) => v.estado === 'COMPLETADO');
        
        const totalAPagar = vuelosCompletados.reduce((acc, v) => acc + toNum(v.pagoPiloto || p.tarifaPorVuelo), 0);
        
        totalVuelosGlobal += vuelosCompletados.length;
        totalMontoGlobal += totalAPagar;

        return {
          pilotoId: p.id,
          nombre: p.nombre,
          email: p.email,
          telefono: p.telefono,
          tarifaBase: toNum(p.tarifaPorVuelo),
          totalVuelosCompletados: vuelosCompletados.length,
          totalVuelosAgendados: vuelosPiloto.length,
          totalAPagar,
          vuelos: vuelosPiloto.map((v) => ({
            vueloId: v.id,
            fechaHora: v.fechaHora.toISOString(),
            pasajeroNombre: v.pasajero.nombre,
            valorPactado: toNum(v.valorPactado),
            pagoPiloto: toNum(v.pagoPiloto || p.tarifaPorVuelo),
            estado: v.estado,
          })),
        };
      });

      return {
        periodo: `${MESES[targetMonth]} ${targetYear}`,
        fechaInicio,
        fechaFin,
        totalVuelosGlobal,
        totalMontoGlobal,
        pilotos: pilotosLiquidacion,
      };
    } catch (err) {
      // Documento oficial: nunca entregar un reporte con montos inventados.
      console.warn('Advertencia DB en /reportes/liquidaciones:', err);
      throw err;
    }
  }

  async generarLiquidacionesCsv(query: LiquidacionQueryInput): Promise<{ csvContent: string; filename: string }> {
    // Mes/año por defecto según el día civil local (America/Santiago)
    const [hoyYear, hoyMonth] = dateKeyLocal().split('-').map(Number);
    const targetMonth = query.mes !== undefined ? query.mes : hoyMonth - 1;
    const targetYear = query.year !== undefined ? query.year : hoyYear;

    const fechaInicio = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-01`;
    const nextMonthFirstDayKey = new Date(Date.UTC(targetYear, targetMonth + 1, 1)).toISOString().slice(0, 10);
    // Mes civil local (America/Santiago): inicio inclusivo / fin exclusivo
    const startDate = new Date(fechaHoraLocalToIso(fechaInicio, '00:00'));
    const endDate = new Date(fechaHoraLocalToIso(nextMonthFirstDayKey, '00:00'));

    const vuelos = await prisma.vuelo.findMany({
      where: {
        deletedAt: null,
        fechaHora: { gte: startDate, lt: endDate },
        estado: 'COMPLETADO',
        ...(query.pilotoId ? { pilotoId: query.pilotoId } : {}),
      },
      include: {
        piloto: true,
        pasajero: true,
      },
      orderBy: [
        { piloto: { nombre: 'asc' } },
        { fechaHora: 'asc' },
      ],
    });

    let csvContent = '\uFEFF';
    csvContent += 'ID Vuelo;Fecha;Hora;Piloto;Tarifa Piloto ($ CLP);Pasajero;RUT Pasajero;Valor Pactado ($ CLP);Estado\r\n';

    vuelos.forEach((v) => {
      const fecha = new Date(v.fechaHora).toLocaleDateString('es-CL');
      const hora = new Date(v.fechaHora).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
      const tarifa = toNum(v.pagoPiloto || v.piloto.tarifaPorVuelo);
      
      const sanitize = (text: string | null | undefined) => (text ? `"${text.replace(/"/g, '""')}"` : '""');

      csvContent += `${v.id};${fecha};${hora};${sanitize(v.piloto.nombre)};${tarifa};${sanitize(v.pasajero.nombre)};${sanitize(v.pasajero.rutDni)};${toNum(v.valorPactado)};${v.estado}\r\n`;
    });

    const filename = `liquidaciones_${targetYear}_${String(targetMonth + 1).padStart(2, '0')}.csv`;
    return { csvContent, filename };
  }

  async generarLiquidacionesXlsx(query: LiquidacionQueryInput): Promise<{ buffer: Buffer; filename: string }> {
    // Mes/año por defecto según el día civil local (America/Santiago)
    const [hoyYear, hoyMonth] = dateKeyLocal().split('-').map(Number);
    const targetMonth = query.mes !== undefined ? query.mes : hoyMonth - 1;
    const targetYear = query.year !== undefined ? query.year : hoyYear;

    const fechaInicio = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-01`;
    const nextMonthFirstDayKey = new Date(Date.UTC(targetYear, targetMonth + 1, 1)).toISOString().slice(0, 10);
    const fechaFin = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).toISOString().slice(0, 10);
    // Mes civil local (America/Santiago): inicio inclusivo / fin exclusivo
    const startDate = new Date(fechaHoraLocalToIso(fechaInicio, '00:00'));
    const endDate = new Date(fechaHoraLocalToIso(nextMonthFirstDayKey, '00:00'));

    const vuelos = await prisma.vuelo.findMany({
      where: {
        deletedAt: null,
        fechaHora: { gte: startDate, lt: endDate },
        estado: 'COMPLETADO',
        ...(query.pilotoId ? { pilotoId: query.pilotoId } : {}),
      },
      include: { piloto: true, pasajero: true },
      orderBy: [{ piloto: { nombre: 'asc' } }, { fechaHora: 'asc' }],
    });

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Parapente';
    wb.created = new Date();
    const ws = wb.addWorksheet('Liquidaciones', {
      properties: { tabColor: { argb: 'FF0F172A' } },
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });

    // Título
    ws.mergeCells('A1:J1');
    const titleCell = ws.getCell('A1');
    titleCell.value = `Liquidaciones de Pilotos — ${MESES[targetMonth]} ${targetYear}`;
    titleCell.font = { size: 13, bold: true, color: { argb: 'FF0F172A' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 22;
    ws.mergeCells('A2:J2');
    const sub = ws.getCell('A2');
    sub.value = `Período ${new Date(fechaHoraLocalToIso(fechaInicio, '12:00')).toLocaleDateString('es-CL')} al ${new Date(fechaHoraLocalToIso(fechaFin, '12:00')).toLocaleDateString('es-CL')}  ·  Vuelos liquidados: ${vuelos.length}`;
    sub.font = { size: 8, color: { argb: 'FF64748B' } };
    sub.alignment = { horizontal: 'center' };
    ws.getRow(2).height = 14;

    const headerRow = ws.addRow(['ID Vuelo', 'Fecha', 'Hora', 'Piloto', 'Tarifa Piloto (CLP)', 'Pasajero', 'RUT Pasajero', 'Valor Pactado (CLP)', 'Pago Piloto (CLP)', 'Estado']);
    headerRow.height = 18;
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 8 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } } as unknown as ExcelJS.Fill;
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = { top: { style: 'thin', color: { argb: 'FF334155' } }, bottom: { style: 'thin', color: { argb: 'FF334155' } }, left: { style: 'thin', color: { argb: 'FF334155' } }, right: { style: 'thin', color: { argb: 'FF334155' } } } as unknown as ExcelJS.Borders;
    });

    ws.columns = [
      { key: 'id', width: 10 },
      { key: 'fecha', width: 12 },
      { key: 'hora', width: 9 },
      { key: 'piloto', width: 22 },
      { key: 'tarifa', width: 16 },
      { key: 'pasajero', width: 22 },
      { key: 'rut', width: 14 },
      { key: 'valor', width: 16 },
      { key: 'pago', width: 16 },
      { key: 'estado', width: 12 },
    ];

    let totalTarifa = 0;
    let totalValor = 0;
    let totalPago = 0;

    vuelos.forEach((v) => {
      const d = new Date(v.fechaHora);
      const tarifa = toNum((v as unknown as { piloto: { tarifaPorVuelo: unknown } }).piloto.tarifaPorVuelo);
      const pago = toNum(v.pagoPiloto || (v as unknown as { piloto: { tarifaPorVuelo: unknown } }).piloto.tarifaPorVuelo);
      const valor = toNum(v.valorPactado);
      totalTarifa += tarifa;
      totalPago += pago;
      totalValor += valor;
      const row = ws.addRow([
        v.id,
        d.toLocaleDateString('es-CL'),
        d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
        (v as unknown as { piloto: { nombre: string } }).piloto.nombre,
        tarifa,
        (v as unknown as { pasajero: { nombre: string } }).pasajero.nombre,
        (v as unknown as { pasajero: { rutDni: string | null } }).pasajero.rutDni || '',
        valor,
        pago,
        v.estado,
      ]);
      row.height = 15;
      row.eachCell((cell, col) => {
        cell.font = { size: 8 };
        cell.alignment = { vertical: 'middle', horizontal: col === 4 || col === 6 ? 'left' : col >= 5 && col <= 9 ? 'right' : 'center', wrapText: col === 4 || col === 6 };
        cell.border = { top: { style: 'thin', color: { argb: 'FFE2E8F0' } }, bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }, left: { style: 'thin', color: { argb: 'FFE2E8F0' } }, right: { style: 'thin', color: { argb: 'FFE2E8F0' } } } as unknown as ExcelJS.Borders;
        if (col === 5 || col === 8 || col === 9) cell.numFmt = '#,##0';
        if (row.number % 2 === 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } } as unknown as ExcelJS.Fill;
      });
    });

    if (vuelos.length > 0) {
      const tot = ws.addRow(['', '', '', 'TOTAL', totalTarifa, '', '', totalValor, totalPago, '']);
      tot.height = 16;
      tot.eachCell((cell, col) => {
        cell.font = { bold: true, size: 8, color: { argb: col === 4 ? 'FF0F172A' : 'FF065F46' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } } as unknown as ExcelJS.Fill;
        cell.border = { top: { style: 'medium', color: { argb: 'FF0F172A' } }, bottom: { style: 'medium', color: { argb: 'FF0F172A' } } } as unknown as ExcelJS.Borders;
        cell.alignment = { horizontal: col >= 5 ? 'right' : 'center', vertical: 'middle' };
        if (col === 5 || col === 8 || col === 9) cell.numFmt = '#,##0';
      });
    }

    ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: 10 } };
    ws.views = [{ state: 'frozen', ySplit: 3 }];

    // Hoja resumen por piloto
    const pilotosMap = new Map<string, { nombre: string; tarifa: number; vuelos: number; pago: number }>();
    vuelos.forEach((v) => {
      const nombre = (v as unknown as { piloto: { nombre: string } }).piloto.nombre;
      const tarifa = toNum((v as unknown as { piloto: { tarifaPorVuelo: unknown } }).piloto.tarifaPorVuelo);
      const pago = toNum(v.pagoPiloto || tarifa);
      const cur = pilotosMap.get(nombre) || { nombre, tarifa, vuelos: 0, pago: 0 };
      cur.vuelos += 1;
      cur.pago += pago;
      pilotosMap.set(nombre, cur);
    });
    if (pilotosMap.size > 0) {
      const ws2 = wb.addWorksheet('Resumen por Piloto');
      ws2.mergeCells('A1:D1');
      const t2 = ws2.getCell('A1');
      t2.value = `Resumen por Piloto — ${MESES[targetMonth]} ${targetYear}`;
      t2.font = { size: 12, bold: true, color: { argb: 'FF0F172A' } };
      t2.alignment = { horizontal: 'center' };
      const h2 = ws2.addRow(['Piloto', 'Vuelos Completados', 'Tarifa Base (CLP)', 'Total a Pagar (CLP)']);
      h2.eachCell((c) => {
        c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 8 };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } } as unknown as ExcelJS.Fill;
        c.alignment = { horizontal: 'center', vertical: 'middle' };
      });
      ws2.columns = [{ width: 26 }, { width: 18 }, { width: 18 }, { width: 18 }];
      let totalV = 0;
      let totalP = 0;
      for (const r of pilotosMap.values()) {
        ws2.addRow([r.nombre, r.vuelos, r.tarifa, r.pago]);
        totalV += r.vuelos;
        totalP += r.pago;
      }
      const tr = ws2.addRow(['TOTAL', totalV, '', totalP]);
      tr.eachCell((c) => {
        c.font = { bold: true, size: 8 };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } } as unknown as ExcelJS.Fill;
      });
      ws2.getColumn(3).numFmt = '#,##0';
      ws2.getColumn(4).numFmt = '#,##0';
      ws2.views = [{ state: 'frozen', ySplit: 2 }];
      ws2.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: 4 } };
    }

    const buffer = (await wb.xlsx.writeBuffer()) as unknown as Buffer;
    const filename = `liquidaciones_${targetYear}_${String(targetMonth + 1).padStart(2, '0')}.xlsx`;
    return { buffer, filename };
  }
}

export const reportesService = new ReportesService();
