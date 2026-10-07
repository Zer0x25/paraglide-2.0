import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuditoriaService } from '../auditoria.service';

vi.mock('../../plugins/prisma', () => {
  return {
    prisma: {
      logAuditoria: {
        create: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
      },
    },
  };
});

import { prisma } from '../../plugins/prisma';

describe('Auditoria & Activity Log Service (Unit Tests)', () => {
  let service: AuditoriaService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuditoriaService();
  });

  it('log debería registrar una entrada de auditoría correctamente', async () => {
    (prisma.logAuditoria.create as any).mockResolvedValue({
      id: 1,
      fechaHora: new Date(),
      accion: 'REGISTRAR_PAGO',
      entidad: 'PAGO',
      entidadId: '10',
      descripcion: 'Abono registrado por $50.000 CLP',
      usuarioNombre: 'Admin',
    });

    const res = await service.log({
      accion: 'REGISTRAR_PAGO',
      entidad: 'PAGO',
      entidadId: '10',
      descripcion: 'Abono registrado por $50.000 CLP',
      usuarioNombre: 'Admin',
    });

    expect(prisma.logAuditoria.create).toHaveBeenCalled();
    expect(res?.accion).toBe('REGISTRAR_PAGO');
  });

  it('getLogs debería consultar los logs con filtros de entidad y acción y devolver paginación', async () => {
    (prisma.logAuditoria.findMany as any).mockResolvedValue([
      { id: 1, accion: 'CREAR_RESERVA', entidad: 'RESERVA' },
    ]);
    (prisma.logAuditoria.count as any).mockResolvedValue(1);

    const res = await service.getLogs({ filtroEntidad: 'RESERVA', filtroAccion: 'CREAR_RESERVA', busqueda: 'Juan', page: 1, pageSize: 10 });
    expect(prisma.logAuditoria.findMany).toHaveBeenCalled();
    expect(res.data.length).toBe(1);
    expect(res.pagination.total).toBe(1);
    expect(res.pagination.totalPages).toBe(1);
  });
});
