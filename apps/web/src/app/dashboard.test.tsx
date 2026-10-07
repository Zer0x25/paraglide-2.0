import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, queryClient } from '../test/render';
import Home from './page';
import { apiRaw as api } from '../services/api';
import * as onlineHook from '@/hooks/useOnlineStatus';

vi.mock('../services/api', () => {
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
    auditoria: { listar: vi.fn() },
    dashboard: {
      stats: vi.fn().mockImplementation(() => mockApi.get('/dashboard/stats')),
    },
  };
  return {
    __esModule: true,
    default: mockApi,
    apiRaw: mockApi
  };
});

describe('Dashboard Principal (/) - Pruebas Unitarias y de Componente', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  it('1. Debe renderizar los KPIs principales cuando la API retorna datos válidos', async () => {
    const mockStats = {
      pilotos: 5,
      pilotosActivos: 4,
      pilotosDisponiblesHoy: 3,
      pasajeros30d: 48,
      promedioDiarioPasajeros: '3.2',
      vuelosTotal: 120,
      vuelosHoy: 6,
      vuelosFuturos: 14,
      reservasRecientes: [
        {
          id: 1,
          numeroReserva: '260815-0001',
          nombreTitular: 'Mayte Valdés Rubio',
          email: 'mayte@example.com',
          estadoPago: 'ABONADO',
          valorTotal: 100000,
        }
      ]
    };

    vi.mocked(api.get).mockResolvedValueOnce(mockStats as unknown as Awaited<ReturnType<typeof api.get>>);

    render(<Home />);

    expect(screen.getByText('Panel de Control')).toBeInTheDocument();
    expect(screen.getByText('Sistema Activo')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('6')).toBeInTheDocument(); // Vuelos de Hoy
      expect(screen.getByText('3')).toBeInTheDocument(); // Pilotos Disponibles Hoy
      expect(screen.getByText('48')).toBeInTheDocument(); // Pasajeros 30d
      expect(screen.getByText('Mayte Valdés Rubio')).toBeInTheDocument();
      expect(screen.getByText(/260815-0001/i)).toBeInTheDocument();
    });
  });

  it('2. Debe manejar de forma segura el fallo o retraso de la API con estado vacío', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('Network error'));

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText('Panel de Control')).toBeInTheDocument();
      expect(screen.getByText('No hay reservas recientes')).toBeInTheDocument();
    });
  });

  it('3. Debe renderizar el estado de modo offline cuando el hook reporta desconexión', async () => {
    vi.spyOn(onlineHook, 'useOnlineStatus').mockReturnValue(false);
    vi.mocked(api.get).mockRejectedValueOnce(new Error('Network error'));

    render(<Home />);

    expect(screen.getByText('Panel de Control')).toBeInTheDocument();
    expect(screen.getByText('Modo Offline (Datos Locales)')).toBeInTheDocument();
    expect(screen.queryByText('Sistema Activo')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Modo offline: sin reservas en caché local')).toBeInTheDocument();
    });
  });

  it('4. Debe renderizar los datos cacheados en modo offline', async () => {
    vi.spyOn(onlineHook, 'useOnlineStatus').mockReturnValue(false);
    const mockStats = {
      pilotos: 3,
      pilotosActivos: 2,
      pilotosDisponiblesHoy: 2,
      pasajeros30d: 15,
      promedioDiarioPasajeros: '1.5',
      vuelosTotal: 40,
      vuelosHoy: 4,
      vuelosFuturos: 8,
      reservasRecientes: [
        {
          id: 99,
          numeroReserva: '260905-0099',
          nombreTitular: 'Cliente Offline IDB',
          email: 'offline@test.com',
          estadoPago: 'PAGADO',
          valorTotal: 50000,
        }
      ]
    };
    queryClient.setQueryData(['dashboard', 'stats'], mockStats);

    render(<Home />);

    expect(screen.getByText('Panel de Control')).toBeInTheDocument();
    expect(screen.getByText('Modo Offline (Datos Locales)')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument(); // Vuelos de Hoy
    expect(screen.getByText('Cliente Offline IDB')).toBeInTheDocument();
    expect(screen.getByText(/260905-0099/i)).toBeInTheDocument();
  });
});
