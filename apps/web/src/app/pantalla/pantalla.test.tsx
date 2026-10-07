import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../../test/render';
import PantallaSalaEsperaPage from './page';
import { apiRaw as api } from '../../services/api';

// page.tsx importa `apiRaw` de services/api, que a su vez ejecuta
// axios.create().interceptors a nivel de módulo. Un automock (`vi.mock('axios')`)
// hace que create() devuelva undefined y la importación explota. Se mockea axios
// con factory basada en el módulo real: create() devuelve UNA instancia mockeada
// compartida, así api.ts se importa sin explotar y los tests controlan las
// respuestas vía `api.get` (la misma instancia que usa la página).
vi.mock('axios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('axios')>();
  const instance = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
    defaults: { headers: { common: {} } },
  };
  return {
    ...actual,
    default: Object.assign(vi.fn(() => instance), actual.default, {
      create: vi.fn(() => instance),
    }),
  };
});
vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,mocked') }
}));

const mockPantallaData = {
  fecha: '2026-08-15',
  totalVuelos: 2,
  completados: 1,
  clima: {
    estadoPista: 'ABIERTA',
    velocidadViento: 14,
    rachaViento: 18,
    direccionViento: 'SO',
    temperatura: 21,
    observaciones: 'Condiciones perfectas.',
  },
  vuelos: [
    {
      id: 1,
      hora: '10:00',
      pilotoNombre: 'Rodrigo Morales',
      pilotoCategoria: 'MASTER',
      pasajeroNombre: 'Adela Ocampo',
      pasajeroFirmaDeslinde: true,
      estado: 'COMPLETADO',
    },
    {
      id: 2,
      hora: '11:00',
      pilotoNombre: 'Camila Sepúlveda',
      pilotoCategoria: 'SENIOR',
      pasajeroNombre: 'Ignacio Valdés',
      pasajeroFirmaDeslinde: false,
      estado: 'AGENDADO',
    },
  ],
};

describe('Página Pública de Pantalla FIDS (/pantalla) - Pruebas Unitarias y de Componente', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    window.history.replaceState({}, '', '/pantalla?token=testtoken');
    // La página llama a dos endpoints: /public/pantalla (datos FIDS) y
    // /pantalla/link (enlaces admin). Respondemos por URL para que cada
    // flujo reciba lo que espera sin depender del orden de llamadas.
    vi.mocked(api.get).mockImplementation((async (url: string) => {
      if (url === '/public/pantalla') {
        return mockPantallaData as unknown as Awaited<ReturnType<typeof api.get>>;
      }
      return { token: 'mock-token' } as unknown as Awaited<ReturnType<typeof api.get>>;
    }) as unknown as typeof api.get);
  });

  it('1. Debe renderizar el panel FIDS público con estado de pista e información meteorológica', async () => {
    render(<PantallaSalaEsperaPage />);

    expect(screen.getByText('PARAGLIDE FLIGHT CENTER')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/PISTA ABIERTA/i)).toBeInTheDocument();
      expect(screen.getByText('Adela Ocampo')).toBeInTheDocument();
      expect(screen.getByText('Ignacio Valdés')).toBeInTheDocument();
      expect(screen.getByText('Rodrigo Morales')).toBeInTheDocument();
      expect(screen.getByText('Camila Sepúlveda')).toBeInTheDocument();
    });
  });

  it('2. Debe mostrar la pantalla restringida si no hay token en la URL', async () => {
    window.history.replaceState({}, '', '/pantalla');
    render(<PantallaSalaEsperaPage />);

    await waitFor(() => {
      expect(screen.getByText('Enlace no disponible')).toBeInTheDocument();
      expect(screen.getByText(/solo el día de tu vuelo/i)).toBeInTheDocument();
    });
  });

  it('3. Debe mostrar la pantalla restringida si el token es inválido o caducó (401)', async () => {
    window.history.replaceState({}, '', '/pantalla?token=caducado');
    vi.mocked(api.get).mockImplementation((async (url: string) => {
      if (url === '/public/pantalla') {
        throw { isAxiosError: true, response: { status: 401, data: { message: 'Enlace caducado' } } } as unknown as Error;
      }
      return { token: 'mock-token' } as unknown as Awaited<ReturnType<typeof api.get>>;
    }) as unknown as typeof api.get);
    render(<PantallaSalaEsperaPage />);

    await waitFor(() => {
      expect(screen.getByText('Enlace no disponible')).toBeInTheDocument();
    });
  });

  it('4. Admin logueado: el panel de enlaces aparece aunque la pantalla esté restringida', async () => {
    document.cookie = 'token=test-admin-token';
    window.history.replaceState({}, '', '/pantalla');
    vi.mocked(api.get).mockImplementation((async (url: string) => {
      if (url === '/public/pantalla') {
        throw { isAxiosError: true, response: { status: 401, data: { message: 'Enlace caducado' } } } as unknown as Error;
      }
      return { token: 'mock-token' } as unknown as Awaited<ReturnType<typeof api.get>>;
    }) as unknown as typeof api.get);
    render(<PantallaSalaEsperaPage />);

    await waitFor(() => {
      expect(screen.getByText('Enlace no disponible')).toBeInTheDocument();
      expect(screen.getByText('Enlaces de acceso')).toBeInTheDocument();
    });
    expect(screen.queryByText(/Inicia sesión/)).not.toBeInTheDocument();
    document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  });
});
