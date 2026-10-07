import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '../../test/render';
import PilotosPage from './page';
import * as usePilotosHook from '../../hooks/usePilotos';
import type { PilotoDTO } from '@parapente/shared';

vi.mock('../../services/api', () => {
  const mockApi = {

    get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(),
    vuelos: { listar: vi.fn(), crear: vi.fn(), actualizar: vi.fn(), eliminar: vi.fn(), actualizarEstado: vi.fn(), agendarGrupo: vi.fn(), asignacionAutomatica: vi.fn() },
    pilotos: { listar: vi.fn(), obtenerDisponibilidad: vi.fn(), guardarDisponibilidad: vi.fn(), resetDisponibilidad: vi.fn(), crear: vi.fn(), actualizar: vi.fn() },
    pasajeros: { listar: vi.fn() },
    reservas: { listar: vi.fn(), agregarPago: vi.fn(), eliminarPago: vi.fn() },
    configuracion: { listar: vi.fn().mockResolvedValue([]), resolver: vi.fn().mockResolvedValue({}), crear: vi.fn(), actualizar: vi.fn(), eliminar: vi.fn() },
    equipos: { listar: vi.fn(), crear: vi.fn(), actualizar: vi.fn(), eliminar: vi.fn(), agregarMantenimiento: vi.fn(), eliminarMantenimiento: vi.fn() },
    plantillas: { listar: vi.fn(), crear: vi.fn(), actualizar: vi.fn(), eliminar: vi.fn(), renderizar: vi.fn() },
    meteorologia: { listar: vi.fn(), obtenerActual: vi.fn(), obtenerHistorial: vi.fn(), registrar: vi.fn() },
    gastos: { listar: vi.fn(), crear: vi.fn(), eliminar: vi.fn() },
    auditoria: { listar: vi.fn() },
    // Namespaces leídos por services/apiOutbox a nivel de módulo (ADR 009):
    tarifas: { listar: vi.fn(), crear: vi.fn(), actualizar: vi.fn(), eliminar: vi.fn() },
    promociones: { listar: vi.fn(), crear: vi.fn(), actualizar: vi.fn(), eliminar: vi.fn() },
    faqs: { listar: vi.fn(), crear: vi.fn(), actualizar: vi.fn(), eliminar: vi.fn() },
    deslindes: { listar: vi.fn(), crear: vi.fn(), actualizar: vi.fn(), eliminar: vi.fn(), activar: vi.fn() },
    reglasOperativas: { listar: vi.fn(), upsert: vi.fn(), eliminar: vi.fn() },
    public: { deslindeActivo: vi.fn(), faqsPublicas: vi.fn(), reglasOperativas: vi.fn() },
    empresa: { obtenerPublico: vi.fn(), obtener: vi.fn(), actualizar: vi.fn() }

  };
  return {
    __esModule: true,
    default: mockApi,
    apiRaw: mockApi
  };
});

vi.mock('../../hooks/usePilotos', () => ({
  usePilotos: vi.fn(),
}));

const mockPilotosList = [
  {
    id: 1,
    nombre: 'Rodrigo Morales',
    email: 'rodrigo@parapente.com',
    telefono: '+56987654321',
    peso: 78,
    activo: true,
    tieneLicencia: true,
    prioridad: 1,
    categoria: 'MASTER',
    pesoMinimoPasajero: 30,
    pesoMaximoPasajero: 110,
    tarifaPorVuelo: 25000,
    disponibilidadTotal: true,
    excepciones: [],
  },
  {
    id: 2,
    nombre: 'Camila Sepúlveda',
    email: 'camila@parapente.com',
    telefono: '+56976543210',
    peso: 62,
    activo: true,
    tieneLicencia: true,
    prioridad: 2,
    categoria: 'SENIOR',
    pesoMinimoPasajero: 30,
    pesoMaximoPasajero: 95,
    tarifaPorVuelo: 22000,
    disponibilidadTotal: true,
    excepciones: [],
  },
];

describe('Página de Pilotos (/pilotos) - Pruebas Unitarias y de Componente', () => {
  const mockFetchPilotos = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePilotosHook.usePilotos).mockReturnValue({
      pilotos: mockPilotosList as unknown as PilotoDTO[],
      loading: false,
      refetch: mockFetchPilotos,
    } as unknown as ReturnType<typeof usePilotosHook.usePilotos>);
  });

  it('1. Debe renderizar la lista de pilotos, categorías y datos de contacto', () => {
    render(<PilotosPage />);

    expect(screen.getByText('Gestión de Pilotos')).toBeInTheDocument();
    expect(screen.getAllByText('Rodrigo Morales')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Camila Sepúlveda')[0]).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Nuevo Piloto/i })).toBeInTheDocument();
  });

  it('2. Debe abrir el modal de creación al presionar "Nuevo Piloto"', () => {
    render(<PilotosPage />);

    const nuevoBtn = screen.getByRole('button', { name: /Nuevo Piloto/i });
    fireEvent.click(nuevoBtn);

    expect(screen.getByText('Nuevo Piloto')).toBeInTheDocument();
    expect(screen.getByText('Categoría')).toBeInTheDocument();
    expect(screen.getByText(/Prioridad Orden/i)).toBeInTheDocument();
  });

  it('3. Debe manejar una lista vacía sin errores de renderizado', () => {
    vi.mocked(usePilotosHook.usePilotos).mockReturnValue({
      pilotos: [] as unknown as PilotoDTO[],
      loading: false,
      refetch: mockFetchPilotos,
    } as unknown as ReturnType<typeof usePilotosHook.usePilotos>);

    render(<PilotosPage />);

    expect(screen.getByText('Gestión de Pilotos')).toBeInTheDocument();
    expect(screen.queryByText('Rodrigo Morales')).not.toBeInTheDocument();
  });
});
