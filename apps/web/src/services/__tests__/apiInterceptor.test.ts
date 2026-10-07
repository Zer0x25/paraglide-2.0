import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import Cookies from 'js-cookie';
import { apiRaw } from '../api';

vi.mock('js-cookie', () => ({
  default: {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
  },
}));

describe('api response interceptor - 401 handling', () => {
  const handlers = (apiRaw.interceptors.response as unknown as {
    handlers: Array<{ rejected?: (err: unknown) => Promise<unknown> }>;
  }).handlers;
  const errorHandler = handlers[handlers.length - 1]?.rejected;

  // jsdom no implementa navegación real: stub de location para que el
  // redirect imperativo del interceptor no ensucie stderr ni navegue.
  const locationStub = { pathname: '/', href: '' };
  const originalLocation = window.location;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    locationStub.pathname = '/';
    locationStub.href = '';
    Object.defineProperty(window, 'location', {
      value: locationStub,
      writable: true,
      configurable: true,
    });
  });

  afterAll(() => {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  it('no debe borrar cookies de sesion si el 401 proviene de un endpoint publico (/public/*)', async () => {
    expect(errorHandler).toBeDefined();
    if (!errorHandler) throw new Error('errorHandler no definido');

    const publicError = {
      response: {
        status: 401,
        data: { message: 'Este enlace ha caducado o no es válido.' },
      },
      config: {
        url: '/public/pantalla?token=abc-123',
      },
      message: 'Request failed with status code 401',
    };

    await expect(errorHandler(publicError)).rejects.toThrow();
    expect(Cookies.remove).not.toHaveBeenCalledWith('token');
    expect(locationStub.href).toBe('');
  });

  it('debe borrar cookies y user si el 401 proviene de un endpoint autenticado', async () => {
    expect(errorHandler).toBeDefined();
    if (!errorHandler) throw new Error('errorHandler no definido');

    const authError = {
      response: {
        status: 401,
        data: { message: 'No Authorization was found in request.headers' },
      },
      config: {
        url: '/pantalla/link?tipo=TV',
      },
      message: 'Request failed with status code 401',
    };

    localStorage.setItem('user', JSON.stringify({ id: 1, role: 'ADMIN' }));

    await expect(errorHandler(authError)).rejects.toThrow();
    expect(Cookies.remove).toHaveBeenCalledWith('token');
    expect(localStorage.getItem('user')).toBeNull();
    expect(locationStub.href).toBe('/login');
  });
});
