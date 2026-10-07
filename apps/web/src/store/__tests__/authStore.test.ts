import { describe, it, expect, vi, beforeEach } from 'vitest';
import Cookies from 'js-cookie';
import { useAuthStore } from '../authStore';
import type { UserDTO } from '@parapente/shared';

const mockRemoveItem = vi.fn().mockResolvedValue(undefined);
const mockStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: mockRemoveItem,
};

vi.mock('@/services/storage/idbStorage', () => ({
  resolveStorage: vi.fn(() => mockStorage),
}));

vi.mock('js-cookie', () => ({
  default: {
    set: vi.fn(),
    get: vi.fn(),
    remove: vi.fn(),
  },
}));

describe('authStore', () => {
  const mockUser1: UserDTO = {
    id: 1,
    email: 'admin@parapente.com',
    nombre: 'Admin',
    role: 'ADMIN',
    pilotoId: null,
  };

  const mockUser2: UserDTO = {
    id: 2,
    email: 'piloto@parapente.com',
    nombre: 'Piloto',
    role: 'PILOTO',
    pilotoId: 10,
  };

  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ token: null, user: null });
    vi.clearAllMocks();
  });

  it('setAuth guarda el token en cookies, el user y last_user_id en localStorage', () => {
    useAuthStore.getState().setAuth('jwt-token-123', mockUser1);

    expect(Cookies.set).toHaveBeenCalledWith('token', 'jwt-token-123', { expires: 7 });
    expect(localStorage.getItem('user')).toBe(JSON.stringify(mockUser1));
    expect(localStorage.getItem('last_user_id')).toBe('1');
    expect(useAuthStore.getState().token).toBe('jwt-token-123');
    expect(useAuthStore.getState().user).toEqual(mockUser1);
  });

  it('logout limpia el token y el user del store/localStorage pero mantiene last_user_id y no limpia la caché de IndexedDB', () => {
    localStorage.setItem('last_user_id', '1');
    localStorage.setItem('user', JSON.stringify(mockUser1));
    useAuthStore.setState({ token: 'jwt-token-123', user: mockUser1 });

    useAuthStore.getState().logout();

    expect(Cookies.remove).toHaveBeenCalledWith('token');
    expect(localStorage.getItem('user')).toBeNull();
    expect(localStorage.getItem('last_user_id')).toBe('1');
    expect(mockRemoveItem).not.toHaveBeenCalled();
    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('setAuth con un usuario con diferente id llama a resolveStorage().removeItem(\'parapente-query-cache\')', () => {
    localStorage.setItem('last_user_id', '1');

    useAuthStore.getState().setAuth('jwt-token-456', mockUser2);

    expect(mockRemoveItem).toHaveBeenCalledTimes(1);
    expect(mockRemoveItem).toHaveBeenCalledWith('parapente-query-cache');
    expect(localStorage.getItem('last_user_id')).toBe('2');
    expect(localStorage.getItem('user')).toBe(JSON.stringify(mockUser2));
  });

  it('setAuth con el mismo usuario NO borra la caché', () => {
    localStorage.setItem('last_user_id', '1');

    useAuthStore.getState().setAuth('jwt-token-123-new', mockUser1);

    expect(mockRemoveItem).not.toHaveBeenCalled();
    expect(localStorage.getItem('last_user_id')).toBe('1');
    expect(localStorage.getItem('user')).toBe(JSON.stringify(mockUser1));
  });
});
