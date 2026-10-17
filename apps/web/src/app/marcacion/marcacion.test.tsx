import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@/test/render';
import { MarcacionPageView } from './components/MarcacionPageView';
import type { MarcacionController } from './hooks/useMarcacionController';
import type { MarcacionRow, PasajeroMarcacion, ReservaMarcacion, VueloMarcacion } from './types';

const reserva = {
  id: 24,
  numeroReserva: '261017-01',
  nombreTitular: 'Ana Titular',
  telefono: '+56912345678',
  estado: 'CONFIRMADA',
  estadoPago: 'PAGADO',
  abono: 50000,
  version: 3,
  pasajeros: [],
} as unknown as ReservaMarcacion;

const pasajero = {
  id: 2401,
  nombre: 'Camila Pasajera',
  rutDni: '12.345.678-9',
  telefono: '+56912345678',
  peso: 65,
  firmaDeslinde: true,
  estado: 'POR_VOLAR',
  vuelos: [],
} as unknown as PasajeroMarcacion;

const vuelo = {
  id: 301,
  fechaHora: '2026-10-17T14:00:00-03:00',
  estado: 'AGENDADO',
  piloto: { id: 5, nombre: 'Carlos Piloto' },
} as unknown as VueloMarcacion;

const fila: MarcacionRow = {
  key: '24:2401',
  reserva,
  pasajero,
  vuelo,
  vuelosDia: [vuelo],
  estado: 'VUELO_COMPLETADO',
  tieneCambio: true,
};

function crearController(overrides: Partial<MarcacionController> = {}) {
  return {
    fecha: '2026-10-17',
    setFecha: vi.fn(),
    hoy: '2026-10-17',
    moverFecha: vi.fn(() => '2026-10-18'),
    busqueda: '',
    setBusqueda: vi.fn(),
    filtro: 'TODOS',
    setFiltro: vi.fn(),
    filasDelDia: [fila],
    filasFiltradas: [fila],
    filaSeleccionada: fila,
    setSelectedKey: vi.fn(),
    resumen: { total: 1, pendientes: 0, volados: 1, noVolaron: 0, borradores: 1 },
    reservasQuery: {
      isFetching: false,
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    },
    mutacion: { isPending: false },
    cambiarEstadoBorrador: vi.fn(),
    puedeEditar: vi.fn(() => true),
    puedeMarcarNoVolado: vi.fn(() => true),
    contarBorradores: vi.fn(() => 1),
    reservasEnCola: {},
    guardarMarcaciones: vi.fn(),
    normalizarEstado: vi.fn((estado?: MarcacionRow['estado'] | null) => estado ?? 'POR_VOLAR'),
    horaLocalHHMM: vi.fn(() => '11:00'),
    ...overrides,
  } as unknown as MarcacionController;
}

describe('Marcación de pista', () => {
  it('muestra los paneles laterales y permite registrar y guardar el resultado', () => {
    const controller = crearController();

    render(<MarcacionPageView c={controller} autorizado />);

    expect(
      screen.getByRole('complementary', { name: 'Filtros y resumen de jornada' }),
    ).toBeVisible();
    expect(
      screen.getByRole('complementary', { name: 'Detalle y marcación del pasajero' }),
    ).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Camila Pasajera' })).toBeInTheDocument();
    expect(controller.contarBorradores).toHaveBeenCalledWith(reserva.id);

    fireEvent.click(screen.getByRole('button', { name: 'Voló' }));
    expect(controller.cambiarEstadoBorrador).toHaveBeenCalledWith(fila, 'VUELO_COMPLETADO');

    fireEvent.click(screen.getByRole('button', { name: 'Guardar marcación' }));
    expect(controller.guardarMarcaciones).toHaveBeenCalledWith(reserva, fila.key);
  });

  it('restringe la vista a perfiles autorizados', () => {
    render(<MarcacionPageView c={{} as MarcacionController} autorizado={false} />);

    expect(screen.getByRole('heading', { name: 'Acceso restringido' })).toBeInTheDocument();
    expect(screen.queryByText('Pasajeros agendados')).not.toBeInTheDocument();
  });
});
