import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '../../test/render';
import EquiposPage from './page';
import * as useEquiposHook from '../../hooks/useEquipos';
import type { EquipoDTO } from '@parapente/shared';

vi.mock('../../hooks/useEquipos', () => ({
  useEquipos: vi.fn(),
}));

// Mock EquipoModal para evitar que su useEffect interno llame a api.pilotos.listar()
// y ensucie el stderr con AxiosError: Network Error en CI (no hay servidor).
vi.mock('../../components/EquipoModal', () => ({
  EquipoModal: vi.fn().mockImplementation(
    ({ isOpen, equipo }: { isOpen: boolean; equipo?: { id: number } | null }) =>
      isOpen ? (
        <div data-testid="equipo-modal">
          <h2>{equipo ? 'Editar Equipo de Vuelo' : 'Registrar Nuevo Equipo'}</h2>
        </div>
      ) : null,
  ),
}));

const mockEquiposList = [
  {
    id: 1,
    codigo: 'VELA-01',
    nombre: 'Ozone Magnum 3 41m²',
    tipo: 'VELA',
    marca: 'Ozone',
    modelo: 'Magnum 3',
    numeroSerie: 'MG3-41-9821',
    estado: 'OPERATIVO',
    horasVueloEstimadas: 34.5,
    vuelosRealizados: 86,
    limiteHorasInspeccion: 100,
    pilotoAsignado: { id: 1, nombre: 'Rodrigo Morales' },
    mantenimientos: []
  },
  {
    id: 2,
    codigo: 'RES-01',
    nombre: 'Companion SQR 220 Tandem',
    tipo: 'PARACAIDAS_EMERGENCIA',
    marca: 'Companion',
    modelo: 'SQR 220',
    numeroSerie: 'SQR-220-4109',
    estado: 'REVISION_PENDIENTE',
    horasVueloEstimadas: 95.0,
    vuelosRealizados: 120,
    limiteHorasInspeccion: 100,
    pilotoAsignado: null,
    mantenimientos: []
  }
];

describe('Página de Equipos (/equipos) - Pruebas Unitarias y de Componente', () => {
  const mockCreateEquipo = vi.fn();
  const mockUpdateEquipo = vi.fn();
  const mockDeleteEquipo = vi.fn();
  const mockAddMantenimiento = vi.fn();
  const mockDeleteMantenimiento = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useEquiposHook.useEquipos).mockReturnValue({
      equipos: mockEquiposList as unknown as EquipoDTO[],
      loading: false,
      error: null,
      fetchEquipos: vi.fn(),
      createEquipo: mockCreateEquipo,
      updateEquipo: mockUpdateEquipo,
      deleteEquipo: mockDeleteEquipo,
      addMantenimiento: mockAddMantenimiento,
      deleteMantenimiento: mockDeleteMantenimiento,
    } as unknown as ReturnType<typeof useEquiposHook.useEquipos>);
  });

  it('1. Debe renderizar las tarjetas estadísticas y el listado de equipos', () => {
    render(<EquiposPage />);

    expect(screen.getByText('Control de Equipos & Mantenimiento')).toBeInTheDocument();
    expect(screen.getByText('Ozone Magnum 3 41m²')).toBeInTheDocument();
    expect(screen.getByText('VELA-01')).toBeInTheDocument();
    expect(screen.getByText('Companion SQR 220 Tandem')).toBeInTheDocument();
    expect(screen.getByText('RES-01')).toBeInTheDocument();
  });

  it('2. Debe filtrar equipos cuando se ingresa un término en la búsqueda', () => {
    render(<EquiposPage />);

    const searchInput = screen.getByPlaceholderText(/Buscar por código, modelo, serie, piloto\.\.\./i);
    fireEvent.change(searchInput, { target: { value: 'Ozone' } });

    expect(screen.getByText('Ozone Magnum 3 41m²')).toBeInTheDocument();
    expect(screen.queryByText('Companion SQR 220 Tandem')).not.toBeInTheDocument();
  });

  it('3. Debe abrir el modal de nuevo equipo al hacer clic en "Registrar Equipo"', () => {
    render(<EquiposPage />);

    const nuevoBtn = screen.getByRole('button', { name: /Registrar Equipo/i });
    fireEvent.click(nuevoBtn);

    expect(screen.getByText('Registrar Nuevo Equipo')).toBeInTheDocument();
  });
});
