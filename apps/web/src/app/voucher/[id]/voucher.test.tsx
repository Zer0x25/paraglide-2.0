import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../../../test/render';
import VoucherPublicoPage from './page';
import axios from 'axios';

// Factory basada en importOriginal con instancia compartida: el automock de
// axios deja axios.create() → undefined y services/api.ts explota en
// .interceptors (gotcha conocido, igual que pantalla.test). `create` debe
// devolver la MISMA instancia mockeada porque services/api construye apiRaw
// con axios.create() y si cae en el create real dispara fetch de red reales.
vi.mock('axios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('axios')>();
  const instance = {
    ...actual.default,
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  };
  Object.assign(instance, { create: () => instance });
  return { ...actual, default: instance, create: () => instance };
});
vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,mocked') }
}));
vi.mock('../../../hooks/useEmpresaPublico', () => ({
  useEmpresaPublico: () => ({ empresa: { nombre: 'Parapente School' }, isLoading: false }),
}));

const mockReservaVoucher = {
  id: 1,
  numeroReserva: '260815-0001',
  nombreTitular: 'Mayte Valdés',
  telefono: '+56912345678',
  email: 'mayte@example.com',
  fechaReserva: '2026-08-15T15:00:00.000Z',
  estadoPago: 'PAGADO',
  valorTotal: 50000,
  abono: 50000,
  pasajeros: [
    {
      id: 1,
      nombre: 'Adela Ocampo',
      rutDni: '12345678-9',
      peso: 70,
      firmaDeslinde: true,
    }
  ]
};

describe('Página Pública de Voucher (/voucher/[id]) - Pruebas Unitarias y de Componente', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Debe renderizar el Boarding Pass de vuelo con titular, número de reserva y pasajeros', async () => {
    vi.mocked(axios.get).mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('/public/reservas/')) {
        return Promise.resolve({ data: mockReservaVoucher } as unknown as Awaited<ReturnType<typeof import('axios').default.get>>);
      }
      if (typeof url === 'string' && url.includes('/public/reglas-operativas')) {
        return Promise.resolve({ data: [{ clave: 'puntoDeEncuentro', valor: 'Zona de Despegue' }] } as unknown as Awaited<ReturnType<typeof import('axios').default.get>>);
      }
      return Promise.resolve({ data: {} } as unknown as Awaited<ReturnType<typeof import('axios').default.get>>);
    });

    render(<VoucherPublicoPage params={Promise.resolve({ id: '1' })} />);

    await waitFor(() => {
      expect(screen.getByText('VUELO EN PARAPENTE')).toBeInTheDocument();
      expect(screen.getByText('#260815-0001')).toBeInTheDocument();
      expect(screen.getByText('Mayte Valdés')).toBeInTheDocument();
      expect(screen.getByText('Google Calendar')).toBeInTheDocument();
      expect(screen.getByText(/Calendario \(\.ics\)/i)).toBeInTheDocument();
    });
  });

  it('2. Debe mostrar mensaje de error si el voucher no existe', async () => {
    vi.mocked(axios.get).mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('/public/reservas/')) {
        return Promise.reject(new Error('404 Not Found'));
      }
      return Promise.resolve({ data: [] } as unknown as Awaited<ReturnType<typeof import('axios').default.get>>);
    });

    render(<VoucherPublicoPage params={Promise.resolve({ id: '999' })} />);

    await waitFor(() => {
      expect(screen.getByText('Voucher no encontrado')).toBeInTheDocument();
    });
  });

  it('3. Debe renderizar el desglose de tarifa y promoción cuando están presentes', async () => {
    const mockReservaConPromo = {
      ...mockReservaVoucher,
      id: 2,
      valorTotal: 180000,
      abono: 180000,
      descuento: 60000,
      tarifa: { id: 1, nombre: 'Vuelo Tándem Standard', precio: 80000 },
      promocion: { id: 10, nombre: 'Black Friday', tipoDescuento: 'MONTO_FIJO', valor: 20000 },
      pasajeros: [
        { id: 1, nombre: 'Adela Ocampo', rutDni: '12345678-9', peso: 70, firmaDeslinde: true },
        { id: 2, nombre: 'Juan Pérez', rutDni: '98765432-1', peso: 75, firmaDeslinde: false },
        { id: 3, nombre: 'Carlos Ruiz', rutDni: '11223344-5', peso: 80, firmaDeslinde: false },
      ],
    };

    vi.mocked(axios.get).mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('/public/reservas/')) {
        return Promise.resolve({ data: mockReservaConPromo } as unknown as Awaited<ReturnType<typeof import('axios').default.get>>);
      }
      return Promise.resolve({ data: [] } as unknown as Awaited<ReturnType<typeof import('axios').default.get>>);
    });

    render(<VoucherPublicoPage params={Promise.resolve({ id: '2' })} />);

    await waitFor(() => {
      expect(screen.getByText('Detalle de la Experiencia Contratada')).toBeInTheDocument();
      expect(screen.getByText('Vuelo Tándem Standard')).toBeInTheDocument();
      expect(screen.getByText(/3 vuelos ×/i)).toBeInTheDocument();
      expect(screen.getByText('Black Friday')).toBeInTheDocument();
      expect(screen.getByText(/-\$60\.000/)).toBeInTheDocument();
    });
  });
});
