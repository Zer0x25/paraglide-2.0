import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, queryClient } from '../../test/render';
import LoginPage from './page';
import { apiRaw as api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

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

const { mockPush } = vi.hoisted(() => ({ mockPush: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe('Página de Login (/login) - Pruebas Unitarias y de Componente', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // La caché ['auth-config'] tiene staleTime Infinity (se consulta una vez
    // por sesión); se limpia para que cada test verifique su propia consulta.
    queryClient.clear();
    vi.mocked(api.get).mockResolvedValue({ googleClientId: '' } as unknown as Awaited<ReturnType<typeof api.get>>);
    useAuthStore.getState().logout();
  });

  it('1. Debe renderizar el formulario con campos de email, contraseña y botón', () => {
    render(<LoginPage />);

    expect(screen.getByRole('heading', { name: /Iniciar Sesión/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/usuario@ejemplo\.com/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/••••••••/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ingresar/i })).toBeInTheDocument();
  });

  it('2. Debe procesar un login exitoso y guardar la sesión en el store', async () => {
    const mockAuthResponse = {
      token: 'jwt-test-token-xyz',
      user: {
        id: 1,
        email: 'admin@parapente.com',
        nombre: 'Director de Vuelo',
        role: 'ADMIN',
      },
    };

    vi.mocked(api.post).mockResolvedValueOnce(mockAuthResponse as unknown as Awaited<ReturnType<typeof api.post>>);

    render(<LoginPage />);

    const emailInput = screen.getByPlaceholderText(/usuario@ejemplo\.com/i);
    const passwordInput = screen.getByPlaceholderText(/••••••••/i);
    const submitBtn = screen.getByRole('button', { name: /Ingresar/i });

    fireEvent.change(emailInput, { target: { value: 'admin@parapente.com' } });
    fireEvent.change(passwordInput, { target: { value: 'admin123' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/auth/login', {
        email: 'admin@parapente.com',
        password: 'admin123',
      });
      expect(useAuthStore.getState().token).toBe('jwt-test-token-xyz');
      expect(useAuthStore.getState().user?.email).toBe('admin@parapente.com');
      expect(mockPush).toHaveBeenCalledWith('/');
    });
  });

  it('3. Debe mostrar un mensaje de error si las credenciales son incorrectas (401)', async () => {
    vi.mocked(api.post).mockRejectedValueOnce({
      response: {
        status: 401,
        data: { message: 'Credenciales inválidas' },
      },
    });

    render(<LoginPage />);

    const emailInput = screen.getByPlaceholderText(/usuario@ejemplo\.com/i);
    const passwordInput = screen.getByPlaceholderText(/••••••••/i);
    const submitBtn = screen.getByRole('button', { name: /Ingresar/i });

    fireEvent.change(emailInput, { target: { value: 'wrong@parapente.com' } });
    fireEvent.change(passwordInput, { target: { value: 'badpass' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Credenciales inválidas/i)).toBeInTheDocument();
      expect(useAuthStore.getState().token).toBeNull();
    });
  });

  it('4. Debe consultar la configuración dinámica de autenticación en /auth/config', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ googleClientId: 'google-client-test-id' } as unknown as Awaited<ReturnType<typeof api.get>>);

    render(<LoginPage />);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/auth/config');
    });
  });
});
