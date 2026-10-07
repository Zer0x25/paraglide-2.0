import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../test/render';
import ReportesPage from './page';
import { apiRaw as api } from '../../services/api';

vi.mock('../../services/api', () => {
  const mockApi = {

    get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(),
    vuelos: { listar: vi.fn(), crear: vi.fn(), actualizar: vi.fn(), eliminar: vi.fn(), actualizarEstado: vi.fn(), agendarGrupo: vi.fn(), asignacionAutomatica: vi.fn() },
    pilotos: { listar: vi.fn(), obtenerDisponibilidad: vi.fn(), guardarDisponibilidad: vi.fn(), resetDisponibilidad: vi.fn(), crear: vi.fn(), actualizar: vi.fn() },
    pasajeros: { listar: vi.fn() },
    reservas: { listar: vi.fn(), agregarPago: vi.fn(), eliminarPago: vi.fn() },
    configuracion: { listar: vi.fn(), crear: vi.fn(), actualizar: vi.fn(), eliminar: vi.fn() },
    equipos: { listar: vi.fn(), crear: vi.fn(), actualizar: vi.fn(), eliminar: vi.fn(), agregarMantenimiento: vi.fn(), eliminarMantenimiento: vi.fn() },
    plantillas: { listar: vi.fn(), crear: vi.fn(), actualizar: vi.fn(), eliminar: vi.fn(), renderizar: vi.fn() },
    meteorologia: { listar: vi.fn(), obtenerActual: vi.fn(), obtenerHistorial: vi.fn(), registrar: vi.fn() },
    gastos: { listar: vi.fn(), crear: vi.fn(), eliminar: vi.fn() },
    auditoria: { listar: vi.fn() }

  };
  return {
    __esModule: true,
    default: mockApi,
    apiRaw: mockApi
  };
});

const mockManifiestoData = {
  fecha: '2026-08-15',
  totalVuelos: 3,
  totalCompletados: 2,
  totalFirmados: 3,
  totalRecaudado: 150000,
  vuelos: [
    {
      id: 1,
      hora: '10:00',
      pasajeroNombre: 'Adela Ocampo',
      pasajeroRut: '12345678-9',
      pasajeroRutDni: '12345678-9',
      pasajeroPeso: 70,
      pilotoNombre: 'Rodrigo Morales',
      pilotoCategoria: 'MASTER',
      pilotoLicencia: true,
      estado: 'COMPLETADO',
      valorPactado: 50000,
      deslindeFirmado: true,
      reservaNumero: '260815-0001',
      contactoEmergencia: '+56911112222',
    }
  ]
};

const mockLiquidacionesData = {
  mes: 7,
  year: 2026,
  totalVuelos: 25,
  totalPagarPilotos: 625000,
  pilotos: [
    {
      pilotoId: 1,
      nombre: 'Rodrigo Morales',
      categoria: 'MASTER',
      tarifaBase: 25000,
      totalVuelos: 15,
      totalGanado: 375000,
      vuelos: [],
    }
  ]
};

describe('Página de Reportes (/reportes) - Pruebas Unitarias y de Componente', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/manifiesto')) {
        return Promise.resolve(mockManifiestoData as unknown as Awaited<ReturnType<typeof api.get>>);
      }
      if (url.includes('/liquidaciones')) {
        return Promise.resolve(mockLiquidacionesData as unknown as Awaited<ReturnType<typeof api.get>>);
      }
      return Promise.resolve({} as unknown as Awaited<ReturnType<typeof api.get>>);
    });
  });

  it('1. Debe renderizar el Manifiesto Diario de Vuelo con resumen y pasajeros', async () => {
    render(<ReportesPage />);

    expect(screen.getByText(/Manifiestos & Reportes/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Adela Ocampo')).toBeInTheDocument();
      expect(screen.getByText('Rodrigo Morales')).toBeInTheDocument();
      expect(screen.getByText('12345678-9')).toBeInTheDocument();
    });
  });

  it('2. Debe permitir cambiar a la pestaña de Liquidaciones de Pilotos', async () => {
    render(<ReportesPage />);

    const liquidacionesTab = screen.getByRole('button', { name: /Liquidación de Pilotos/i });
    fireEvent.click(liquidacionesTab);

    await waitFor(() => {
      expect(screen.getByText(/Desglose Individual por Piloto/i)).toBeInTheDocument();
      expect(screen.getByText('Rodrigo Morales')).toBeInTheDocument();
    });
  });
});
