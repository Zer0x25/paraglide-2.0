import { create } from 'zustand';
import Cookies from 'js-cookie';
import { UserDTO, UserSchema } from '@parapente/shared';
import { resolveStorage } from '@/services/storage/idbStorage';

interface AuthState {
  token: string | null;
  user: UserDTO | null;
  setAuth: (token: string, user: UserDTO) => void;
  logout: () => void;
  initialize: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,

  setAuth: (token, user) => {
    Cookies.set('token', token, { expires: 7 }); // 7 days
    const lastUserId = localStorage.getItem('last_user_id');
    if (lastUserId && lastUserId !== String(user.id)) {
      resolveStorage().removeItem('parapente-query-cache').catch(() => {});
    }
    localStorage.setItem('last_user_id', String(user.id));
    localStorage.setItem('user', JSON.stringify(user));
    set({ token, user });
  },

  logout: () => {
    Cookies.remove('token');
    localStorage.removeItem('user');
    set({ token: null, user: null });
  },

  initialize: () => {
    const token = Cookies.get('token');
    const userStr = localStorage.getItem('user');
    let user: UserDTO | null = null;

    if (userStr) {
      try {
        // Validar con Zod: si el shape de UserDTO cambió o los datos
        // están corruptos, se descartan en lugar de romper la UI.
        const parsed = UserSchema.safeParse(JSON.parse(userStr));
        if (parsed.success) {
          user = parsed.data;
        } else {
          console.warn('authStore: user en localStorage inválido, descartado', parsed.error.issues);
          localStorage.removeItem('user');
        }
      } catch (e) {
        console.error('Failed to parse user from local storage', e);
        localStorage.removeItem('user');
      }
    }

    if (token && user) {
      set({ token, user });
    }
  }
}));
