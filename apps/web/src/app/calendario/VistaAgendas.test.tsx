import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, queryClient } from '../../test/render';
import { addDays } from 'date-fns';
import VistaAgendas from './VistaAgendas';
import { formatCLP } from '../../utils/format';
import { dateKeyLocal, type VueloVista, type PilotoDia } from './agendas.util';

// VistaAgendas resuelve la disponibilidad on-demand (Fase 5) con TanStack Query,
// así que el render sale de test/render (envuelve en QueryClientProvider retry:false).
// Mock mínimo de la API: por defecto devuelve undefined → Promise.all resuelve
// [undefined] → el merge cae al fallback de la prop (fixtures con excepciones
// inline, comportamiento preexistente). El test on-demand setea respuestas reales.
const { obtenerDisponibilidadMock } = vi.hoisted(() => ({
  obtenerDisponibilidadMock: vi.fn(),
}));

vi.mock('../../services/api', () => ({
  __esModule: true,
  default: {
    pilotos: {
      obtenerDisponibilidad: obtenerDisponibilidadMock,
    },
  },
  apiRaw: {},
}));

import { fechaHoraLocalToIso } from '@parapente/shared';

// ---------------------------------------------------------------------------
// Fixtures construidos con fechaHoraLocalToIso (hora local Santiago) para que
// los tests sean robustos tanto en local como en CI con TZ=UTC.
// ---------------------------------------------------------------------------
const isoDe = (y: number, mo: number, d: number, h: number, mi: number): string => {
  const mStr = String(mo + 1).padStart(2, '0');
  const dStr = String(d).padStart(2, '0');
  const hStr = String(h).padStart(2, '0');
  const miStr = String(mi).padStart(2, '0');
  return fechaHoraLocalToIso(`${y}-${mStr}-${dStr}`, `${hStr}:${miStr}`);
};

const FECHA = new Date(fechaHoraLocalToIso('2026-08-29', '12:00')); // 29 de agosto de 2026, 12:00 local Santiago

const vuelo = (overrides: Partial<VueloVista>): VueloVista => ({
  id: 1,
  pilotoId: 1,
  pasajeroId: 10,
  fechaHora: isoDe(2026, 7, 29, 10, 30),
  estado: 'AGENDADO',
  valorPactado: 50000,
  piloto: { nombre: 'Ana Piloto' },
  pasajero: { nombre: 'Juan Pérez' },
  ...overrides,
});

const piloto = (overrides: Partial<PilotoDia>): PilotoDia => ({
  id: 1,
  nombre: 'Ana Piloto',
  activo: true,
  prioridad: 1,
  disponibilidadTotal: true,
  excepciones: [],
  ...overrides,
});

const CONFIG_DIA = {
  bloqueado: false,
  horarios: [{ horaInicio: '10:00', horaFin: '13:00' }],
};

describe('VistaAgendas — render de bloques y carriles', () => {
  it('renderiza nombres de piloto, tarjetas de vuelo, header del bloque y contador', () => {
    const pilotos = [
      piloto({ id: 1, nombre: 'Ana Piloto' }),
      piloto({ id: 2, nombre: 'Beto Piloto' }),
    ];
    const vuelos = [
      vuelo({
        id: 1,
        pilotoId: 1,
        fechaHora: isoDe(2026, 7, 29, 10, 30),
        valorPactado: 50000,
        estado: 'AGENDADO',
        pasajero: { nombre: 'Juan Pérez' },
      }),
      vuelo({
        id: 2,
        pilotoId: 2,
        piloto: { nombre: 'Beto Piloto' },
        fechaHora: isoDe(2026, 7, 29, 11, 15),
        valorPactado: 75000,
        estado: 'COMPLETADO',
        pasajero: { nombre: 'María López' },
      }),
    ];

    render(
      <VistaAgendas fecha={FECHA} vuelos={vuelos} pilotos={pilotos} configDia={CONFIG_DIA} />
    );

    // Header del bloque con hora de inicio/fin
    expect(screen.getByText('10:00 – 13:00')).toBeInTheDocument();
    // Contador de vuelos del bloque
    expect(screen.getByText('2 vuelos')).toBeInTheDocument();

    // Nombres de pilotos (carriles)
    expect(screen.getByText('Ana Piloto')).toBeInTheDocument();
    expect(screen.getByText('Beto Piloto')).toBeInTheDocument();

    // Tarjetas de vuelo: pasajero, hora local y precio formateado
    expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
    expect(screen.getByText('10:30 hs')).toBeInTheDocument();
    expect(screen.getByText(formatCLP(50000))).toBeInTheDocument();
    expect(screen.getByText('AGENDADO')).toBeInTheDocument();

    expect(screen.getByText('María López')).toBeInTheDocument();
    expect(screen.getByText('11:15 hs')).toBeInTheDocument();
    expect(screen.getByText(formatCLP(75000))).toBeInTheDocument();
    expect(screen.getByText('COMPLETADO')).toBeInTheDocument();
  });

  it('muestra badge COMPLETADO si la reserva padre del vuelo está COMPLETADA aunque el vuelo figure AGENDADO', () => {
    const pilotos = [piloto({ id: 1, nombre: 'Ana Piloto' })];
    const vuelos = [
      vuelo({
        id: 10,
        pilotoId: 1,
        fechaHora: isoDe(2026, 7, 29, 10, 30),
        valorPactado: 60000,
        estado: 'AGENDADO',
        pasajero: { nombre: 'Carlos Ruiz' },
        reserva: {
          id: 5,
          numeroReserva: 'RES-005',
          estado: 'COMPLETADA',
          estadoPago: 'PAGADO',
          abono: 60000,
          valorTotal: 60000,
        },
      }),
    ];

    render(
      <VistaAgendas fecha={FECHA} vuelos={vuelos} pilotos={pilotos} configDia={CONFIG_DIA} />
    );

    expect(screen.getByText('Carlos Ruiz')).toBeInTheDocument();
    expect(screen.getByText('COMPLETADO')).toBeInTheDocument();
  });

  it('muestra el carril fantasma "Libres (+N)" para pilotos disponibles sin vuelos en el bloque', () => {
    const pilotos = [
      piloto({ id: 1, nombre: 'Ana Piloto' }),
      piloto({ id: 2, nombre: 'Beto Piloto' }),
      piloto({ id: 3, nombre: 'Carla Piloto' }), // disponible, sin vuelos
      piloto({ id: 4, nombre: 'Dora Piloto' }), // disponible, sin vuelos
    ];
    const vuelos = [
      vuelo({ id: 1, pilotoId: 1, fechaHora: isoDe(2026, 7, 29, 10, 30) }),
      vuelo({ id: 2, pilotoId: 2, piloto: { nombre: 'Beto Piloto' }, fechaHora: isoDe(2026, 7, 29, 11, 0) }),
    ];

    render(
      <VistaAgendas fecha={FECHA} vuelos={vuelos} pilotos={pilotos} configDia={CONFIG_DIA} />
    );

    expect(screen.getByText('Libres (+2)')).toBeInTheDocument();
    expect(screen.getByText('Pilotos disponibles')).toBeInTheDocument();
  });

  it('no muestra carril fantasma cuando todos los pilotos disponibles tienen vuelos', () => {
    const pilotos = [
      piloto({ id: 1, nombre: 'Ana Piloto' }),
      piloto({ id: 2, nombre: 'Beto Piloto' }),
    ];
    const vuelos = [
      vuelo({ id: 1, pilotoId: 1, fechaHora: isoDe(2026, 7, 29, 10, 30) }),
      vuelo({ id: 2, pilotoId: 2, piloto: { nombre: 'Beto Piloto' }, fechaHora: isoDe(2026, 7, 29, 11, 0) }),
    ];

    render(
      <VistaAgendas fecha={FECHA} vuelos={vuelos} pilotos={pilotos} configDia={CONFIG_DIA} />
    );

    expect(screen.queryByText(/Libres \(\+N\)/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Libres \(\+/)).not.toBeInTheDocument();
  });

  it('on-demand: el carril "Libres (+N)" excluye al piloto con excepción real devuelta por obtenerDisponibilidad', async () => {
    // El QueryClient es compartido por el archivo: limpiar el cache para forzar
    // el refetch con el mock del endpoint (si no, reusa el resultado del test
    // anterior y el mock nunca llega a correr).
    queryClient.clear();
    const dateKey = dateKeyLocal(FECHA);

    // Beto (id 2) tiene una excepción REAL para el día visible según el endpoint;
    // los demás devuelven excepciones vacías.
    obtenerDisponibilidadMock.mockImplementation((id: number) =>
      Promise.resolve({
        excepciones: id === 2 ? [{ fecha: dateKey }] : [],
        disponibilidadTotal: true,
      })
    );

    const pilotos = [
      piloto({ id: 1, nombre: 'Ana Piloto' }),
      piloto({ id: 2, nombre: 'Beto Piloto' }),
      piloto({ id: 3, nombre: 'Carla Piloto' }),
    ];
    const vuelos = [vuelo({ id: 1, pilotoId: 1, fechaHora: isoDe(2026, 7, 29, 10, 30) })];

    render(
      <VistaAgendas fecha={FECHA} vuelos={vuelos} pilotos={pilotos} configDia={CONFIG_DIA} />
    );

    // Sin el merge on-demand, Beto sería "libre" → Libres (+2). Con la excepción
    // real aplicada por la query solo Carla queda libre → Libres (+1).
    await waitFor(() => {
      expect(screen.getByText('Libres (+1)')).toBeInTheDocument();
    });
  });

  it('muestra "Sin reservas — +N pilotos disponibles" cuando el bloque no tiene vuelos', () => {
    const pilotos = [piloto({ id: 1, nombre: 'Ana Piloto' })];
    render(
      <VistaAgendas fecha={FECHA} vuelos={[]} pilotos={pilotos} configDia={CONFIG_DIA} />
    );

    expect(screen.getByText('Sin reservas — +1 pilotos disponibles')).toBeInTheDocument();
  });

  it('muestra la sección de vuelos fuera de bloques con sus carriles y tarjetas', () => {
    const pilotos = [piloto({ id: 1, nombre: 'Ana Piloto' })];
    const vuelos = [
      vuelo({
        id: 99,
        pilotoId: 1,
        fechaHora: isoDe(2026, 7, 29, 6, 0), // 06:00 local (fuera del bloque 10:00 - 13:00)
        pasajero: { nombre: 'Pasajero Fuera' },
        valorPactado: 45000,
      }),
    ];

    render(
      <VistaAgendas fecha={FECHA} vuelos={vuelos} pilotos={pilotos} configDia={CONFIG_DIA} />
    );

    expect(screen.getByText('Fuera de bloques configurados')).toBeInTheDocument();
    expect(screen.getByText('1 vuelo')).toBeInTheDocument();
    expect(screen.getByText('Pasajero Fuera')).toBeInTheDocument();
    expect(screen.getByText('06:00 hs')).toBeInTheDocument();
  });
});

describe('VistaAgendas — estados de configuración', () => {
  it('muestra "Día bloqueado" cuando configDia.bloqueado es true', () => {
    render(
      <VistaAgendas
        fecha={FECHA}
        vuelos={[]}
        pilotos={[]}
        configDia={{ bloqueado: true, horarios: [] }}
      />
    );
    expect(screen.getByText('Día bloqueado')).toBeInTheDocument();
    expect(screen.queryByText('10:00 – 13:00')).not.toBeInTheDocument();
  });

  it('muestra "Sin bloques configurados" cuando configDia es null', () => {
    render(<VistaAgendas fecha={FECHA} vuelos={[]} pilotos={[]} configDia={null} />);
    expect(screen.getByText('Sin bloques configurados')).toBeInTheDocument();
    expect(screen.queryByText('10:00 – 13:00')).not.toBeInTheDocument();
  });

  it('muestra vuelos asignados incluso si el día no tiene bloques configurados', () => {
    const vuelos = [
      vuelo({
        id: 99,
        pilotoId: 1,
        fechaHora: isoDe(2026, 7, 29, 8, 0),
        pasajero: { nombre: 'Pasajero Huérfano' },
      }),
    ];
    render(<VistaAgendas fecha={FECHA} vuelos={vuelos} pilotos={[]} configDia={null} />);
    expect(screen.getByText('Sin bloques configurados')).toBeInTheDocument();
    expect(screen.getByText('Vuelos asignados este día')).toBeInTheDocument();
    expect(screen.getByText('Pasajero Huérfano')).toBeInTheDocument();
  });
});

describe('VistaAgendas — navegación de día', () => {
  let onNavigate: ReturnType<typeof vi.fn<(d: Date) => void>>;

  beforeEach(() => {
    onNavigate = vi.fn<(d: Date) => void>();
  });

  const renderConNav = (fecha = FECHA) =>
    render(
      <VistaAgendas
        fecha={fecha}
        vuelos={[]}
        pilotos={[]}
        configDia={CONFIG_DIA}
        onNavigate={onNavigate}
      />
    );

  it('"Sig" navega a fecha + 1 día', () => {
    renderConNav();
    fireEvent.click(screen.getByRole('button', { name: /Sig/ }));
    expect(onNavigate).toHaveBeenCalledTimes(1);
    const arg = onNavigate.mock.calls[0][0] as Date;
    expect(arg.getTime()).toBe(addDays(FECHA, 1).getTime());
  });

  it('"Ant" navega a fecha - 1 día', () => {
    renderConNav();
    fireEvent.click(screen.getByRole('button', { name: /Ant/ }));
    expect(onNavigate).toHaveBeenCalledTimes(1);
    const arg = onNavigate.mock.calls[0][0] as Date;
    expect(arg.getTime()).toBe(addDays(FECHA, -1).getTime());
  });

  it('"Hoy" (cuando la fecha no es hoy) navega al día de hoy', () => {
    renderConNav(addDays(new Date(), -2));
    const hoyBtn = screen.getByRole('button', { name: 'Hoy' });
    expect(hoyBtn).not.toBeDisabled();

    fireEvent.click(hoyBtn);
    expect(onNavigate).toHaveBeenCalledTimes(1);
    const arg = onNavigate.mock.calls[0][0] as Date;

    // Compara dateKey local (misma técnica que el componente), no instancias.
    const dateKey = (d: Date) => {
      const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
      return local.toISOString().split('T')[0];
    };
    expect(dateKey(arg)).toBe(dateKey(new Date()));
  });

  it('"Hoy" está deshabilitado cuando la fecha visible es hoy', () => {
    renderConNav(new Date());
    expect(screen.getByRole('button', { name: 'Hoy' })).toBeDisabled();
    expect(onNavigate).not.toHaveBeenCalled();
  });
});

describe('VistaAgendas — edición de vuelos/reservas', () => {
  let onEditar: ReturnType<typeof vi.fn<(vuelo: VueloVista) => void>>;

  beforeEach(() => {
    onEditar = vi.fn<(vuelo: VueloVista) => void>();
  });

  it('Llama a onEditar con el objeto vuelo correspondiente al hacer click en la tarjeta de un vuelo agendado', () => {
    const pilotos = [piloto({ id: 1, nombre: 'Ana Piloto' })];
    const targetVuelo = vuelo({
      id: 42,
      pilotoId: 1,
      fechaHora: isoDe(2026, 7, 29, 11, 0),
      pasajero: { nombre: 'Carlos Ruiz' },
      valorPactado: 60000,
    });

    render(
      <VistaAgendas
        fecha={FECHA}
        vuelos={[targetVuelo]}
        pilotos={pilotos}
        configDia={CONFIG_DIA}
        onEditar={onEditar}
      />
    );

    const tarjeta = screen.getByRole('button', { name: /Carlos Ruiz/i });
    fireEvent.click(tarjeta);

    expect(onEditar).toHaveBeenCalledTimes(1);
    expect(onEditar).toHaveBeenCalledWith(targetVuelo);
  });

  it('Llama a onEditar con el teclado al presionar Enter o Space sobre la tarjeta del vuelo', () => {
    const pilotos = [piloto({ id: 1, nombre: 'Ana Piloto' })];
    const targetVuelo = vuelo({
      id: 42,
      pilotoId: 1,
      fechaHora: isoDe(2026, 7, 29, 11, 0),
      pasajero: { nombre: 'Carlos Ruiz' },
    });

    render(
      <VistaAgendas
        fecha={FECHA}
        vuelos={[targetVuelo]}
        pilotos={pilotos}
        configDia={CONFIG_DIA}
        onEditar={onEditar}
      />
    );

    const tarjeta = screen.getByRole('button', { name: /Carlos Ruiz/i });

    fireEvent.keyDown(tarjeta, { key: 'Enter' });
    expect(onEditar).toHaveBeenCalledTimes(1);
    expect(onEditar).toHaveBeenCalledWith(targetVuelo);

    fireEvent.keyDown(tarjeta, { key: ' ' });
    expect(onEditar).toHaveBeenCalledTimes(2);
    expect(onEditar).toHaveBeenLastCalledWith(targetVuelo);
  });

  it('Si onEditar no está provisto, la tarjeta se renderiza normalmente sin fallar', () => {
    const pilotos = [piloto({ id: 1, nombre: 'Ana Piloto' })];
    const targetVuelo = vuelo({
      id: 42,
      pilotoId: 1,
      fechaHora: isoDe(2026, 7, 29, 11, 0),
      pasajero: { nombre: 'Carlos Ruiz' },
    });

    render(
      <VistaAgendas
        fecha={FECHA}
        vuelos={[targetVuelo]}
        pilotos={pilotos}
        configDia={CONFIG_DIA}
      />
    );

    expect(screen.getByText('Carlos Ruiz')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Carlos Ruiz/i })).not.toBeInTheDocument();
  });

  it('También funciona el click en tarjetas dentro de la sección "Fuera de bloques configurados"', () => {
    const pilotos = [piloto({ id: 1, nombre: 'Ana Piloto' })];
    const vueloFuera = vuelo({
      id: 99,
      pilotoId: 1,
      fechaHora: isoDe(2026, 7, 29, 6, 0),
      pasajero: { nombre: 'Pasajero Temprano' },
    });

    render(
      <VistaAgendas
        fecha={FECHA}
        vuelos={[vueloFuera]}
        pilotos={pilotos}
        configDia={CONFIG_DIA}
        onEditar={onEditar}
      />
    );

    expect(screen.getByText('Fuera de bloques configurados')).toBeInTheDocument();
    const tarjeta = screen.getByRole('button', { name: /Pasajero Temprano/i });
    fireEvent.click(tarjeta);

    expect(onEditar).toHaveBeenCalledTimes(1);
    expect(onEditar).toHaveBeenCalledWith(vueloFuera);
  });
});
