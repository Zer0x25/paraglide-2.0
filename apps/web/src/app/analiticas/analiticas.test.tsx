import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../test/render';
import AnaliticasPage from './page';
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

// ADR 009: la página registra gastos vía typedApiOutbox (outbox offline).
// Se mockea completo porque apiOutbox lee `typedApi.*` a nivel de módulo.
vi.mock('../../services/apiOutbox', () => ({
  typedApiOutbox: {
    gastos: { crear: vi.fn().mockResolvedValue({ id: 1 }) },
  },
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children } : { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children } : { children: React.ReactNode }) => <div data-testid="bar-chart">{React.Children.toArray(children)}</div>,
  Bar: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
  Legend: () => <div />,
  PieChart: ({ children } : { children: React.ReactNode }) => <div data-testid="pie-chart">{React.Children.toArray(children)}</div>,
  Pie: () => <div />,
  Cell: () => <div />,
}));

const mockMetricas = {
  totalCompletados: 15,
  ingresosTotales: 750000,
  pagosPilotos: 375000,
  gastosOperativos: 50000,
  pagoEscuela: 325000,
  margenNetoPorcentaje: '43.3',
  distribucionPilotos: [
    { pilotoNombre: 'Rodrigo Morales', vuelos: 10, totalGanado: 250000 },
    { pilotoNombre: 'Camila Sepúlveda', vuelos: 5, totalGanado: 125000 },
  ],
  gastosPorCategoria: [
    { categoria: 'Combustible', monto: 50000, porcentaje: 100 },
  ],
  pilotosTop: [
    { id: 1, nombre: 'Rodrigo Morales', vuelos: 10, comisiones: 250000 }
  ]
};

describe('Página de Analíticas (/analiticas) - Pruebas Unitarias y de Componente', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockResolvedValue(mockMetricas as unknown as Awaited<ReturnType<typeof api.get>>);
  });

  it('1. Debe renderizar los KPIs financieros y el título de analíticas', async () => {
    render(<AnaliticasPage />);

    expect(screen.getByText('Panel de Analíticas y Finanzas')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Ingresos Totales')).toBeInTheDocument();
      expect(screen.getByText('Pagos a Pilotos')).toBeInTheDocument();
      expect(screen.getByText('Gastos Operativos')).toBeInTheDocument();
      expect(screen.getByText('Margen Neto Escuela')).toBeInTheDocument();
    });
  });

  it('2. Debe abrir el modal de registro de gasto al hacer clic en "Registrar Gasto"', async () => {
    render(<AnaliticasPage />);

    await waitFor(() => {
      expect(screen.getByText('Panel de Analíticas y Finanzas')).toBeInTheDocument();
      expect(screen.getByText('Ingresos Totales')).toBeInTheDocument();
    });

    const registrarGastoBtn = screen.getByRole('button', { name: /Registrar Gasto/i });
    fireEvent.click(registrarGastoBtn);

    expect(screen.getAllByText('Registrar Gasto')[0]).toBeInTheDocument();
    expect(screen.getByText('Categoría')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Guardar Gasto/i })).toBeInTheDocument();
  });
});
