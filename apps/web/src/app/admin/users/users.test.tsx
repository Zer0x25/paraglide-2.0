import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '../../../test/render';
import AdminUsersPage from './page';
import typedApi from '../../../services/api';
import { useAuthStore } from '../../../store/authStore';
import type { UserListableDTO, PilotoDTO } from '@parapente/shared';

vi.mock('../../../services/api', () => {
  const fn = () => vi.fn();
  const mockApi = {
    users: {
      listar: fn(),
      obtener: fn(),
      crear: fn(),
      actualizar: fn(),
      eliminar: fn(),
      cambiarPassword: fn(),
    },
    pilotos: {
      listar: fn(),
    },
  };
  return { __esModule: true, default: mockApi, apiRaw: {} };
});

const mockUsers = [
  {
    id: 1,
    email: 'admin@parapente.com',
    nombre: 'Admin Principal',
    role: 'ADMIN',
    pilotoId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 2,
    email: 'piloto1@parapente.com',
    nombre: 'Juan Piloto',
    role: 'PILOTO',
    pilotoId: 10,
    createdAt: '2026-01-02T00:00:00.000Z',
  },
];

describe('AdminUsersPage - Edición de usuario', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: { id: 1, email: 'admin@parapente.com', nombre: 'Admin Principal', role: 'ADMIN' },
      token: 'fake-token',
    });

    vi.mocked(typedApi.users.listar).mockResolvedValue({
      data: mockUsers as unknown as UserListableDTO[],
      pagination: { page: 1, pageSize: 20, total: 2, totalPages: 1, hasMore: false, nextPage: null, nextCursor: null },
    });

    vi.mocked(typedApi.pilotos.listar).mockResolvedValue({
      data: [{ id: 10, nombre: 'Piloto Test' }] as unknown as PilotoDTO[],
      pagination: { page: 1, pageSize: 100, total: 1, totalPages: 1, hasMore: false, nextPage: null, nextCursor: null },
    });
  });

  it('1. Al editar a otro usuario, muestra todos los campos (nombre, email, contraseña, rol, piloto)', async () => {
    render(<AdminUsersPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Juan Piloto').length).toBeGreaterThan(0);
    });

    // Abrir modal de edición para Juan Piloto (id: 2)
    const editBtns = screen.getAllByLabelText('Editar piloto1@parapente.com');
    fireEvent.click(editBtns[0]);

    const dialog = within(screen.getByRole('dialog'));

    // Modal abierto con título 'Editar usuario'
    expect(dialog.getByText('Editar usuario')).toBeInTheDocument();

    // Todos los campos deben estar presentes dentro del modal
    expect(dialog.getByPlaceholderText('Ej: María García')).toBeInTheDocument();
    expect(dialog.getByPlaceholderText('usuario@parapente.cl')).toBeInTheDocument();
    expect(dialog.getByPlaceholderText('Dejar vacío para no cambiar')).toBeInTheDocument();
    expect(dialog.getByText('Rol')).toBeInTheDocument();
    expect(dialog.getByText('Piloto vinculado (opcional)')).toBeInTheDocument();
  });

  it('2. El modal de nuevo usuario desactiva el autorrellenado de contraseñas guardadas del navegador', async () => {
    render(<AdminUsersPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Admin Principal').length).toBeGreaterThan(0);
    });

    // Abrir modal de nuevo usuario
    fireEvent.click(screen.getByRole('button', { name: /Nuevo usuario/i }));

    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByText('Nuevo usuario')).toBeInTheDocument();

    const emailInput = dialog.getByPlaceholderText('usuario@parapente.cl');
    const passwordInput = dialog.getByPlaceholderText('Mínimo 6 caracteres');

    expect(emailInput).toHaveAttribute('autoComplete', 'off');
    expect(passwordInput).toHaveAttribute('autoComplete', 'new-password');
  });

  it('3. Al editarse a sí mismo (el admin actual), SOLO muestra el campo nombre y oculta el resto de opciones', async () => {
    render(<AdminUsersPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Admin Principal').length).toBeGreaterThan(0);
    });

    // Abrir modal de edición para sí mismo (id: 1)
    const editBtns = screen.getAllByLabelText('Editar admin@parapente.com');
    fireEvent.click(editBtns[0]);

    const dialog = within(screen.getByRole('dialog'));

    // Modal abierto con título de edición propia
    expect(dialog.getByText('Editar mi usuario')).toBeInTheDocument();

    // El campo Nombre DEBE estar presente
    const nombreInput = dialog.getByPlaceholderText('Ej: María García');
    expect(nombreInput).toBeInTheDocument();
    expect(nombreInput).toHaveValue('Admin Principal');

    // El resto de opciones NO debe aparecer en el modal
    expect(dialog.queryByPlaceholderText('usuario@parapente.cl')).not.toBeInTheDocument();
    expect(dialog.queryByPlaceholderText('Dejar vacío para no cambiar')).not.toBeInTheDocument();
    expect(dialog.queryByText('Rol')).not.toBeInTheDocument();
    expect(dialog.queryByText('Piloto vinculado (opcional)')).not.toBeInTheDocument();
  });

  it('4. Guarda únicamente el nombre actualizado cuando el admin se edita a sí mismo', async () => {
    vi.mocked(typedApi.users.actualizar).mockResolvedValue({
      id: 1,
      email: 'admin@parapente.com',
      nombre: 'Admin Modificado',
      role: 'ADMIN',
      pilotoId: null,
    } as unknown as UserListableDTO);

    render(<AdminUsersPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Admin Principal').length).toBeGreaterThan(0);
    });

    const editBtns = screen.getAllByLabelText('Editar admin@parapente.com');
    fireEvent.click(editBtns[0]);

    const nombreInput = screen.getByPlaceholderText('Ej: María García');
    fireEvent.change(nombreInput, { target: { value: 'Admin Modificado' } });

    const guardarBtn = screen.getByRole('button', { name: 'Guardar' });
    fireEvent.click(guardarBtn);

    await waitFor(() => {
      expect(typedApi.users.actualizar).toHaveBeenCalledWith(1, { nombre: 'Admin Modificado' });
    });

    // useAuthStore debe haberse sincronizado con el nuevo nombre
    expect(useAuthStore.getState().user?.nombre).toBe('Admin Modificado');
  });
});
