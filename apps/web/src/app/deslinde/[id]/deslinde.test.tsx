import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../../../test/render';
import DeslindePublicoPage from './page';
import axios from 'axios';

// Factory basada en importOriginal con instancia compartida (igual que
// voucher.test/pantalla.test): services/api construye apiRaw con axios.create()
// y el automock de axios deja create() → undefined (rompe en .interceptors).
// `create` debe devolver la MISMA instancia mockeada o apiRaw haría fetch reales.
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

const mockReservaDeslinde = {
  id: 1,
  numeroReserva: '260815-0001',
  nombreTitular: 'Mayte Valdés',
  fechaReserva: '2026-08-15',
  estadoPago: 'ABONADO',
  pasajeros: [
    {
      id: 1,
      nombre: 'Adela Ocampo',
      rutDni: '12345678-9',
      peso: 70,
      contactoEmergencia: 'Juan Ocampo',
      telefonoEmergencia: '+56911223344',
      firmaDeslinde: false,
    }
  ]
};

describe('Página Pública de Deslinde (/deslinde/[id]) - Pruebas Unitarias y de Componente', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Debe renderizar el formulario de deslinde digital con la lista de pasajeros', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({ data: mockReservaDeslinde } as unknown as Awaited<ReturnType<typeof import('axios').default.get>>);

    render(<DeslindePublicoPage params={Promise.resolve({ id: '1' })} />);

    await waitFor(() => {
      expect(screen.getByText('Deslinde de Responsabilidad')).toBeInTheDocument();
      expect(screen.getByText('Mayte Valdés')).toBeInTheDocument();
      expect(screen.getAllByText('Adela Ocampo')[0]).toBeInTheDocument();
      expect(screen.getByText('Pendiente')).toBeInTheDocument();
    });
  });

  it('2. Debe mostrar error cuando la reserva no existe o el enlace es inválido', async () => {
    vi.mocked(axios.get).mockRejectedValueOnce(new Error('Reserva not found'));

    render(<DeslindePublicoPage params={Promise.resolve({ id: '999' })} />);

    await waitFor(() => {
      expect(screen.getByText('Enlace no disponible')).toBeInTheDocument();
    });
  });
});
