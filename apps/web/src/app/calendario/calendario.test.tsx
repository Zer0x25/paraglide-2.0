import type React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '../../test/render';
import { queryClient } from '../../test/render';
import CalendarioPage from './page';
import api from '../../services/api';
import type { CalendarEvent } from './hooks/types';
import type { ConfiguracionBloqueDTO, ResolucionDiaDTO } from '@parapente/shared';

// El mock de RBC no renderiza el calendario real, así que capturamos las props
// que la página le pasa para poder simular gestos del usuario (drill-down del día).
// `vi.hoisted` garantiza que la variable exista antes de ejecutar la factory del mock.
const rbcProps = vi.hoisted(() => ({
  onDrillDown: null as ((date: Date) => void) | null,
}));

vi.mock('../../services/api', () => {
  const mockApi = {

    get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(),
    vuelos: { listar: vi.fn(), crear: vi.fn(), actualizar: vi.fn(), eliminar: vi.fn(), actualizarEstado: vi.fn(), agendarGrupo: vi.fn(), asignacionAutomatica: vi.fn() },
    pilotos: { listar: vi.fn(), obtenerDisponibilidad: vi.fn(), guardarDisponibilidad: vi.fn(), resetDisponibilidad: vi.fn(), crear: vi.fn(), actualizar: vi.fn() },
    pasajeros: { listar: vi.fn() },
    reservas: { listar: vi.fn(), agregarPago: vi.fn(), eliminarPago: vi.fn() },
    configuracion: { listar: vi.fn(), crear: vi.fn(), actualizar: vi.fn(), eliminar: vi.fn(), resolver: vi.fn() },
    equipos: { listar: vi.fn(), crear: vi.fn(), actualizar: vi.fn(), eliminar: vi.fn(), agregarMantenimiento: vi.fn(), eliminarMantenimiento: vi.fn() },
    plantillas: { listar: vi.fn(), crear: vi.fn(), actualizar: vi.fn(), eliminar: vi.fn(), renderizar: vi.fn() },
    meteorologia: { listar: vi.fn(), obtenerActual: vi.fn(), obtenerHistorial: vi.fn(), registrar: vi.fn() },
    gastos: { listar: vi.fn(), crear: vi.fn(), eliminar: vi.fn() },
    auditoria: { listar: vi.fn() },
    // Namespaces leídos por services/apiOutbox a nivel de módulo (ADR 009):
    tarifas: { listar: vi.fn(), crear: vi.fn(), actualizar: vi.fn(), eliminar: vi.fn() },
    promociones: { listar: vi.fn(), crear: vi.fn(), actualizar: vi.fn(), eliminar: vi.fn() },
    faqs: { listar: vi.fn(), crear: vi.fn(), actualizar: vi.fn(), eliminar: vi.fn() },
    deslindes: { listar: vi.fn(), crear: vi.fn(), actualizar: vi.fn(), eliminar: vi.fn(), activar: vi.fn() },
    reglasOperativas: { listar: vi.fn(), upsert: vi.fn(), eliminar: vi.fn() },
    public: { deslindeActivo: vi.fn(), faqsPublicas: vi.fn(), reglasOperativas: vi.fn() },
    empresa: { obtenerPublico: vi.fn(), obtener: vi.fn(), actualizar: vi.fn() }

  };
  return {
    __esModule: true,
    default: mockApi,
    apiRaw: mockApi
  };
});

vi.mock('react-big-calendar', async () => {
  const actual = await vi.importActual('react-big-calendar');
  type MockCalendarProps = {
    events?: CalendarEvent[];
    onDrillDown?: (date: Date) => void;
    components?: { event?: React.ComponentType<{ event: CalendarEvent }> };
  };
  return {
    ...actual,
    Calendar: (props: MockCalendarProps) => {
      // Expone el callback de drill-down para que los tests simulen el clic en el
      // número de un día (el gesto principal del usuario en la vista mensual).
      rbcProps.onDrillDown = props.onDrillDown ?? null;
      const EventComp = props.components?.event;
      return (
        <div data-testid="mock-calendar">
          {props.events?.map((ev: CalendarEvent, idx: number) => (
            <div key={idx} data-testid="calendar-event">
              {EventComp ? <EventComp event={ev} /> : ev.title}
            </div>
          ))}
        </div>
      );
    },
  };
});

const mockVuelos = [
  {
    id: 1,
    pilotoId: 1,
    pasajeroId: 1,
    fechaHora: new Date().toISOString(),
    estado: 'AGENDADO',
    valorPactado: 50000,
    version: 1,
    piloto: { nombre: 'Rodrigo Morales' },
    pasajero: { nombre: 'Adela Ocampo' }
  }
];

const mockPilotos = [
  {
    id: 1,
    nombre: 'Rodrigo Morales',
    activo: true,
    prioridad: 1,
    disponibilidad: [],
    excepciones: [],
    disponibilidadTotal: true,
  }
];

const mockPasajeros = [
  { id: 1, nombre: 'Adela Ocampo', reservaId: 1, peso: 70 },
  { id: 2, nombre: 'Pasajero De Otra Reserva', reservaId: 2, peso: 80 }
];

const mockReservas = [
  { id: 1, numeroReserva: '260815-0001', nombreTitular: 'Mayte Valdés', fechaReserva: '2026-08-15' },
  { id: 2, numeroReserva: '260815-0002', nombreTitular: 'Otro Titular', fechaReserva: '2026-08-15' }
];

describe('Página de Calendario (/calendario) - Pruebas Unitarias y de Componente', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();

    vi.mocked(api.vuelos.listar).mockResolvedValue({ data: mockVuelos, pagination: {} } as unknown as Awaited<ReturnType<typeof api.vuelos.listar>>);
    vi.mocked(api.pilotos.listar).mockResolvedValue({ data: mockPilotos, pagination: {} } as unknown as Awaited<ReturnType<typeof api.pilotos.listar>>);
    vi.mocked(api.pasajeros.listar).mockResolvedValue({ data: mockPasajeros, pagination: {} } as unknown as Awaited<ReturnType<typeof api.pasajeros.listar>>);
    vi.mocked(api.reservas.listar).mockResolvedValue({ data: mockReservas, pagination: {} } as unknown as Awaited<ReturnType<typeof api.reservas.listar>>);
    vi.mocked(api.configuracion.listar).mockResolvedValue([] as unknown as Awaited<ReturnType<typeof api.configuracion.listar>>);
    // Sin reglas resueltas para ningún día: configDia → null en la vista agendas
    vi.mocked(api.configuracion.resolver).mockResolvedValue({} as unknown as Awaited<ReturnType<typeof api.configuracion.resolver>>);
    vi.mocked(api.pilotos.obtenerDisponibilidad).mockResolvedValue({ excepciones: [], disponibilidadTotal: true } as unknown as Awaited<ReturnType<typeof api.pilotos.obtenerDisponibilidad>>);
  });

  it('1. Debe renderizar el calendario y controles principales', async () => {
    render(<CalendarioPage />);

    expect(screen.getByText('Calendario de Vuelos')).toBeInTheDocument();
    // Agendar Vuelo oculto: ahora se agenda desde las fichas de VistaAgendas
    expect(screen.queryByRole('button', { name: /Agendar Vuelo/i })).not.toBeInTheDocument();
    expect(screen.getByText('Configurar Bloques')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('mock-calendar')).toBeInTheDocument();
    });
  });

  it('2. Debe abrir el modal para agendar un vuelo al hacer click en una ficha disponible de VistaAgendas', async () => {
    const configConBloques = [
      {
        id: 1,
        nombre: 'Horario Base',
        bloqueado: false,
        horarios: [
          { horaInicio: '09:00', horaFin: '10:00' },
          { horaInicio: '10:00', horaFin: '11:00' },
        ],
      },
    ] as unknown as ConfiguracionBloqueDTO[];
    vi.mocked(api.configuracion.listar).mockResolvedValue(configConBloques);
    vi.mocked(api.configuracion.resolver).mockImplementation(async (params: { desde?: string; hasta?: string }) => {
      // Generar resolución para el rango solicitado (desde/hasta) con el mismo horario base.
      // Se extiende el rango ±1 día para cubrir el desfase UTC ↔ America/Santiago
      // (ADR 007). Sin este margen, el lookup por dateKeyLocal puede fallar en CI
      // cuando el mes UTC difiere del mes en Santiago.
      const desde = params?.desde ?? new Date().toISOString().slice(0, 10);
      const hasta = params?.hasta ?? desde;
      const cursor = new Date(`${desde}T00:00:00.000Z`);
      cursor.setUTCDate(cursor.getUTCDate() - 1);
      const fin = new Date(`${hasta}T00:00:00.000Z`);
      fin.setUTCDate(fin.getUTCDate() + 1);
      const out: Record<string, ResolucionDiaDTO> = {};
      while (cursor <= fin) {
        const k = cursor.toISOString().slice(0, 10);
        out[k] = {
          fecha: k,
          configuracionId: 1,
          numero: 1,
          numeroInactiva: null,
          nombre: 'Horario Base',
          bloqueado: false,
          horarios: configConBloques[0].horarios,
        };
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
      return out as unknown as Awaited<ReturnType<typeof api.configuracion.resolver>>;
    });
    // disponibilidad on-demand usada por VistaAgendas
    vi.mocked(api.pilotos.obtenerDisponibilidad).mockResolvedValue({
      excepciones: [],
      disponibilidadTotal: true,
    } as unknown as Awaited<ReturnType<typeof api.pilotos.obtenerDisponibilidad>>);

    render(<CalendarioPage />);

    // Pasar a VistaAgendas (botón inicial: Vista Agenda)
    const toggleBtn = screen.getByRole('button', { name: /Vista Agenda/i });
    fireEvent.click(toggleBtn);

    await waitFor(() => {
      expect(screen.queryByTestId('mock-calendar')).not.toBeInTheDocument();
    });

    // Esperar a que VistaAgendas resuelva el bloque del día (09:00)
    await waitFor(() => {
      expect(screen.getByText(/09:00.*10:00/)).toBeInTheDocument();
    });

    // Ficha disponible (bloque vacío) muestra "Agendar" y es clickeable
    const fichaBtns = await screen.findAllByRole('button', { name: /Agendar/i });
    expect(fichaBtns.length).toBeGreaterThan(0);
    fireEvent.click(fichaBtns[0]);

    await waitFor(() => {
      expect(screen.getByText(/Agendar Nuevo Vuelo/i)).toBeInTheDocument();
      expect(screen.getByText(/Seleccionar Reserva \/ Grupo/i)).toBeInTheDocument();
    });
  });

  it('3. Debe abrir el modal de sincronización universal al presionar el botón correspondiente', async () => {
    render(<CalendarioPage />);

    const syncBtn = screen.getByRole('button', { name: /Sincronizar Calendario/i });
    fireEvent.click(syncBtn);

    await waitFor(() => {
      expect(screen.getByText(/Sincronización de Calendario/i)).toBeInTheDocument();
    });
  });

  it('4. Debe alternar a la vista Agendas y reemplazar el calendario RBC por VistaAgendas', async () => {
    render(<CalendarioPage />);

    // Vista por defecto: calendario RBC (mock)
    await waitFor(() => {
      expect(screen.getByTestId('mock-calendar')).toBeInTheDocument();
    });

    const toggleBtn = screen.getByRole('button', { name: /Vista Agenda/i });
    fireEvent.click(toggleBtn);

    await waitFor(() => {
      expect(screen.queryByTestId('mock-calendar')).not.toBeInTheDocument();
    });

    // VistaAgendas renderizada con configDia null (resolver → {} y listar → [])
    expect(screen.getByText('Sin bloques configurados')).toBeInTheDocument();

    // Botón ahora es Vista Mensual; volver restaura el calendario RBC
    expect(screen.getByRole('button', { name: /Vista Mensual/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Vista Mensual/i }));
    await waitFor(() => {
      expect(screen.getByTestId('mock-calendar')).toBeInTheDocument();
    });
  });

  it('5. Clic en un día del mes (drill-down) abre la vista Agendas de ese día', async () => {
    render(<CalendarioPage />);

    // Vista por defecto: calendario RBC (mock)
    await waitFor(() => {
      expect(screen.getByTestId('mock-calendar')).toBeInTheDocument();
    });

    // Simula el clic en el NÚMERO del día (onDrillDown de RBC) → 30 ago 2026 local.
    act(() => {
      rbcProps.onDrillDown?.(new Date(2026, 7, 30));
    });

    // RBC queda fuera del DOM y VistaAgendas lo reemplaza.
    await waitFor(() => {
      expect(screen.queryByTestId('mock-calendar')).not.toBeInTheDocument();
      expect(screen.getByText(/30 de agosto/i)).toBeInTheDocument();
    });

    // configDia null (resolver → {} y listar → []) → estado vacío de la vista.
    expect(screen.getByText('Sin bloques configurados')).toBeInTheDocument();

    // El toggle ahora es "Vista Mensual" y queda activo.
    expect(screen.getByRole('button', { name: /Vista Mensual/i })).toHaveClass('bg-blue-600');
  });

  it('6. El select de agendamiento solo lista reservas con pasajeros pendientes y excluye estados terminales', async () => {
    const configConBloques = [
      {
        id: 1,
        nombre: 'Horario Base',
        bloqueado: false,
        horarios: [
          { horaInicio: '09:00', horaFin: '10:00' },
          { horaInicio: '10:00', horaFin: '11:00' },
        ],
      },
    ] as unknown as ConfiguracionBloqueDTO[];
    vi.mocked(api.configuracion.listar).mockResolvedValue(configConBloques);
    vi.mocked(api.configuracion.resolver).mockImplementation(async (params: { desde?: string; hasta?: string }) => {
      // Misma lógica de extensión ±1 día que en test 2 (TZ UTC ↔ Santiago)
      const desde = params?.desde ?? new Date().toISOString().slice(0, 10);
      const hasta = params?.hasta ?? desde;
      const cursor = new Date(`${desde}T00:00:00.000Z`);
      cursor.setUTCDate(cursor.getUTCDate() - 1);
      const fin = new Date(`${hasta}T00:00:00.000Z`);
      fin.setUTCDate(fin.getUTCDate() + 1);
      const out: Record<string, ResolucionDiaDTO> = {};
      while (cursor <= fin) {
        const k = cursor.toISOString().slice(0, 10);
        out[k] = {
          fecha: k,
          configuracionId: 1,
          numero: 1,
          numeroInactiva: null,
          nombre: 'Horario Base',
          bloqueado: false,
          horarios: configConBloques[0].horarios,
        };
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
      return out as unknown as Awaited<ReturnType<typeof api.configuracion.resolver>>;
    });
    vi.mocked(api.pilotos.obtenerDisponibilidad).mockResolvedValue({
      excepciones: [],
      disponibilidadTotal: true,
    } as unknown as Awaited<ReturnType<typeof api.pilotos.obtenerDisponibilidad>>);

    const reservasMezcla = [
      {
        id: 10, numeroReserva: 'R-10', nombreTitular: 'Sin Agendar Total', estado: 'SIN_AGENDAR', fechaReserva: '2026-08-15',
        pasajeros: [{ id: 100, nombre: 'Pax 1', vuelos: [] }],
      },
      {
        id: 11, numeroReserva: 'R-11', nombreTitular: 'Agendada Parcial', estado: 'AGENDADA', fechaReserva: '2026-08-15',
        pasajeros: [
          { id: 111, nombre: 'Pax 1', vuelos: [{ id: 1111, estado: 'AGENDADO' }] },
          { id: 112, nombre: 'Pax 2', vuelos: [] },
        ],
      },
      {
        id: 12, numeroReserva: 'R-12', nombreTitular: 'Con Vuelo Cancelado', estado: 'SIN_AGENDAR', fechaReserva: '2026-08-15',
        pasajeros: [{ id: 120, nombre: 'Pax 1', vuelos: [{ id: 1212, estado: 'CANCELADO' }] }],
      },
      {
        id: 13, numeroReserva: 'R-13', nombreTitular: 'Completada', estado: 'COMPLETADA', fechaReserva: '2026-08-15',
        pasajeros: [{ id: 130, nombre: 'Pax 1', vuelos: [{ id: 1313, estado: 'COMPLETADO' }] }],
      },
      {
        id: 14, numeroReserva: 'R-14', nombreTitular: 'Cancelada', estado: 'CANCELADA', fechaReserva: '2026-08-15',
        pasajeros: [{ id: 140, nombre: 'Pax 1', vuelos: [] }],
      },
      {
        id: 15, numeroReserva: 'R-15', nombreTitular: 'Parcial Con Pendiente', estado: 'AGENDADA', fechaReserva: '2026-08-15',
        pasajeros: [{ id: 150, nombre: 'Pax 1', vuelos: [{ id: 1515, estado: 'AGENDADO' }] }, { id: 151, nombre: 'Pax 2', vuelos: [] }],
      },
      {
        // Legacy: r.estado undefined debe pasar el gate (tratada como SIN_AGENDAR)
        id: 16, numeroReserva: 'R-16', nombreTitular: 'Legacy Sin Estado', fechaReserva: '2026-08-15',
        pasajeros: [{ id: 160, nombre: 'Pax 1', vuelos: [] }],
      },
      {
        id: 17, numeroReserva: 'R-17', nombreTitular: 'Sin Pasajeros', estado: 'SIN_AGENDAR', fechaReserva: '2026-08-15',
        pasajeros: [],
      },
      {
        // Contradicción inversa: SIN_AGENDAR pero todos los pasajeros ya con vuelo → nada que agendar
        id: 18, numeroReserva: 'R-18', nombreTitular: 'Todo Ya Agendado', estado: 'SIN_AGENDAR', fechaReserva: '2026-08-15',
        pasajeros: [{ id: 180, nombre: 'Pax 1', vuelos: [{ id: 1818, estado: 'AGENDADO' }] }],
      },
    ] as unknown as Awaited<ReturnType<typeof api.reservas.listar>>['data'];
    vi.mocked(api.reservas.listar).mockResolvedValue({ data: reservasMezcla, pagination: {} } as unknown as Awaited<ReturnType<typeof api.reservas.listar>>);

    render(<CalendarioPage />);

    // Pasar a VistaAgendas y abrir el modal de agendamiento desde una ficha
    const toggleBtn = screen.getByRole('button', { name: /Vista Agenda/i });
    fireEvent.click(toggleBtn);

    await waitFor(() => {
      expect(screen.queryByTestId('mock-calendar')).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText(/09:00.*10:00/)).toBeInTheDocument();
    });

    const fichaBtns = await screen.findAllByRole('button', { name: /Agendar/i });
    expect(fichaBtns.length).toBeGreaterThan(0);
    fireEvent.click(fichaBtns[0]);

    await waitFor(() => {
      expect(screen.getByText(/Seleccionar Reserva \/ Grupo/i)).toBeInTheDocument();
    });

    // Solo las agendables aparecen, con etiqueta corregida (CANCELADO no cuenta como agendado)
    expect(screen.getByRole('option', { name: /R-10.*Sin Agendar Total.*📅 Pendiente/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /R-11.*Agendada Parcial.*⏳ Parcial 1\/2/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /R-12.*Con Vuelo Cancelado.*📅 Pendiente/ })).toBeInTheDocument();
    // Reserva con vuelos pendientes entra al desplegable
    expect(screen.getByRole('option', { name: /R-15.*Parcial Con Pendiente.*⏳ Parcial 1\/2/ })).toBeInTheDocument();
    // Legacy sin estado: pasa el gate como SIN_AGENDAR
    expect(screen.getByRole('option', { name: /R-16.*Legacy Sin Estado.*📅 Pendiente/ })).toBeInTheDocument();

    // Estados terminales y sin pasajeros pendientes excluidos del desplegable
    expect(screen.queryByRole('option', { name: /R-13/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /R-14/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /R-17/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /R-18/ })).not.toBeInTheDocument();
  });

  it('5. Debe abrir el modal para editar un vuelo al hacer click en una reserva agendada en VistaAgendas', async () => {
    render(<CalendarioPage />);

    // Pasar a VistaAgendas
    const toggleBtn = screen.getByRole('button', { name: /Vista Agenda/i });
    fireEvent.click(toggleBtn);

    await waitFor(() => {
      expect(screen.queryByTestId('mock-calendar')).not.toBeInTheDocument();
    });

    // Esperar a que se renderice el vuelo (mockVuelos)
    const tarjetaVuelo = await screen.findByText('Adela Ocampo');
    expect(tarjetaVuelo).toBeInTheDocument();

    // Click en la tarjeta de la reserva/vuelo
    fireEvent.click(tarjetaVuelo);

    // Verificar que VueloModal se abre con el título "Editar Vuelo"
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Editar Vuelo/i })).toBeInTheDocument();
    });

    // 1. El pool de pasajeros debe estar limitado a la reserva del vuelo (Reserva 1)
    expect(screen.getByRole('option', { name: /Adela Ocampo/i })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Pasajero De Otra Reserva/i })).not.toBeInTheDocument();

    // 2. Al cambiar la fecha o el bloque horario, el piloto asignado se debe deseleccionar
    const pilotoSelect = screen.getByDisplayValue(/Rodrigo Morales/i) as HTMLSelectElement;
    expect(pilotoSelect.value).toBe('1');

    const fechaInput = screen.getByLabelText(/Fecha/i);
    fireEvent.change(fechaInput, { target: { value: '2026-08-20' } });

    expect(pilotoSelect.value).toBe('');

    // 3. El bloque de estado del vuelo no debe estar presente (ruido visual)
    expect(screen.queryByText(/3\. Estado del Vuelo/i)).not.toBeInTheDocument();

    // 4. El botón de eliminar agenda debe existir
    expect(screen.getByRole('button', { name: /Eliminar Agenda/i })).toBeInTheDocument();
  });
});
