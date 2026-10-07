import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '../../test/render';
import AuditoriaPage from './page';
import * as useAuditoriaHook from '../../hooks/useAuditoria';
import type { LogAuditoriaDTO } from '@parapente/shared';

vi.mock('../../hooks/useAuditoria', () => ({
  useAuditoria: vi.fn(),
}));

const mockLogsList = [
  {
    id: 1,
    entidad: 'RESERVA',
    entidadId: 10,
    accion: 'CREAR_RESERVA',
    descripcion: 'Creación de reserva para Mayte Valdés (2 pasajeros)',
    usuarioId: 1,
    usuarioNombre: 'Director de Vuelo',
    usuarioEmail: 'admin@parapente.com',
    ip: '127.0.0.1',
    fechaHora: '2026-08-15T10:00:00.000Z',
  },
  {
    id: 2,
    entidad: 'PAGO',
    entidadId: 5,
    accion: 'REGISTRAR_PAGO',
    descripcion: 'Abono de $50.000 vía Transferencia',
    usuarioId: 1,
    usuarioNombre: 'Director de Vuelo',
    usuarioEmail: 'admin@parapente.com',
    ip: '127.0.0.1',
    fechaHora: '2026-08-15T10:05:00.000Z',
  }
];

describe('Página de Auditoría (/auditoria) - Pruebas Unitarias y de Componente', () => {
  const mockRefetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuditoriaHook.useAuditoria).mockReturnValue({
      logs: mockLogsList as unknown as LogAuditoriaDTO[],
      loading: false,
      total: mockLogsList.length,
      page: 1,
      totalPages: 1,
      setPage: vi.fn(),
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof useAuditoriaHook.useAuditoria>);
  });

  it('1. Debe renderizar la bitácora de auditoría y los eventos registrados', () => {
    render(<AuditoriaPage />);

    expect(screen.getByText('Auditoría & Bitácora de Actividades')).toBeInTheDocument();
    expect(screen.getByText(/Creación de reserva para Mayte Valdés/i)).toBeInTheDocument();
    expect(screen.getByText(/Abono de \$50\.000 vía Transferencia/i)).toBeInTheDocument();
  });

  it('2. Debe llamar a refetch con los filtros actualizados al cambiar el selector de entidad', () => {
    render(<AuditoriaPage />);

    const selectEntidad = screen.getByDisplayValue('Todas las Entidades');
    fireEvent.change(selectEntidad, { target: { value: 'RESERVA' } });

    expect(mockRefetch).toHaveBeenCalledWith('RESERVA', 'TODAS', '');
  });
});
