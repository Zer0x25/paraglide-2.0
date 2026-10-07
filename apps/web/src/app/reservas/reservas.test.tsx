import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../test/render';
import ReservasPage from './page';
import * as useReservasHook from '../../hooks/useReservas';
import type { ReservaDTO } from '@parapente/shared';

vi.mock('../../hooks/useReservas', () => ({
  useReservas: vi.fn(),
}));

vi.mock('../../services/api', () => {
  const mockApi = {
    get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(),
    vuelos: { listar: vi.fn().mockResolvedValue([]), crear: vi.fn(), actualizar: vi.fn(), eliminar: vi.fn(), actualizarEstado: vi.fn(), agendarGrupo: vi.fn(), asignacionAutomatica: vi.fn() },
    pilotos: { listar: vi.fn().mockResolvedValue([]), obtenerDisponibilidad: vi.fn(), guardarDisponibilidad: vi.fn(), resetDisponibilidad: vi.fn(), crear: vi.fn(), actualizar: vi.fn() },
    pasajeros: { listar: vi.fn().mockResolvedValue([]) },
    reservas: { listar: vi.fn().mockResolvedValue([]), agregarPago: vi.fn(), eliminarPago: vi.fn() },
    configuracion: { listar: vi.fn().mockResolvedValue([]), crear: vi.fn(), actualizar: vi.fn(), eliminar: vi.fn(), resolver: vi.fn().mockResolvedValue({}) },
    equipos: { listar: vi.fn().mockResolvedValue([]), crear: vi.fn(), actualizar: vi.fn(), eliminar: vi.fn(), agregarMantenimiento: vi.fn(), eliminarMantenimiento: vi.fn() },
    plantillas: { listar: vi.fn().mockResolvedValue([]), crear: vi.fn(), actualizar: vi.fn(), eliminar: vi.fn(), renderizar: vi.fn() },
    meteorologia: { listar: vi.fn().mockResolvedValue([]), obtenerActual: vi.fn().mockResolvedValue(null), obtenerHistorial: vi.fn().mockResolvedValue([]), registrar: vi.fn(), pronosticoOpenMeteo: vi.fn().mockResolvedValue(null) },
    gastos: { listar: vi.fn().mockResolvedValue([]), crear: vi.fn(), eliminar: vi.fn() },
    auditoria: { listar: vi.fn().mockResolvedValue([]) },
    tarifas: { listar: vi.fn().mockResolvedValue({ data: [] }), crear: vi.fn(), actualizar: vi.fn(), eliminar: vi.fn() },
    promociones: { listar: vi.fn().mockResolvedValue({ data: [] }), crear: vi.fn(), actualizar: vi.fn(), eliminar: vi.fn() },
    faqs: { listar: vi.fn().mockResolvedValue([]), crear: vi.fn(), actualizar: vi.fn(), eliminar: vi.fn() },
    deslindes: { listar: vi.fn().mockResolvedValue([]), crear: vi.fn(), actualizar: vi.fn(), eliminar: vi.fn(), activar: vi.fn() },
    reglasOperativas: { listar: vi.fn().mockResolvedValue([]), upsert: vi.fn(), eliminar: vi.fn() },
    public: { deslindeActivo: vi.fn(), faqsPublicas: vi.fn(), reglasOperativas: vi.fn() },
    empresa: { obtenerPublico: vi.fn(), obtener: vi.fn(), actualizar: vi.fn() }
  };
  return {
    __esModule: true,
    default: mockApi,
    typedApi: mockApi,
    apiRaw: mockApi,
  };
});

vi.mock('../../hooks/useMeteorologia', () => ({
  useMeteorologia: vi.fn(() => ({
    pronostico: null,
    estadoActual: null,
    historial: [],
    loading: false,
    error: null,
    refetch: vi.fn(),
  })),
}));

const todayIso = new Date().toISOString();
const tomorrowIso = new Date(Date.now() + 86400000).toISOString();

const mockReservas = [
  {
    id: 1,
    numeroReserva: '260815-0001',
    nombreTitular: 'Mayte Valdés Rubio',
    telefono: '+56912345678',
    email: 'mayte@example.com',
    fechaAgenda: todayIso,
    estadoPago: 'ABONADO',
    estado: 'ACTIVA',
    version: 1,
    valorTotal: 100000,
    abono: 50000,
    createdAt: todayIso,
    pasajeros: [
      {
        id: 1,
        rutDni: '12345678-9',
        nombre: 'Adela Ocampo',
        peso: 70,
        firmaDeslinde: true,
        vuelos: [
          { id: 1, fechaHora: todayIso, estado: 'AGENDADO', pilotoId: 1 }
        ]
      }
    ],
    pagos: [
      { id: 1, monto: 50000, metodoPago: 'TRANSFERENCIA', fecha: todayIso }
    ]
  },
  {
    id: 2,
    numeroReserva: '260815-0002',
    nombreTitular: 'Carlos Santander',
    telefono: '+56987654321',
    email: 'carlos@example.com',
    fechaAgenda: tomorrowIso,
    estadoPago: 'PENDIENTE',
    estado: 'ACTIVA',
    version: 1,
    valorTotal: 60000,
    abono: 0,
    createdAt: todayIso,
    pasajeros: [
      {
        id: 2,
        rutDni: '18765432-1',
        nombre: 'Carlos Santander Jr',
        peso: 85,
        firmaDeslinde: false,
        vuelos: []
      }
    ],
    pagos: []
  }
];

describe('Página de Reservas (/reservas) - Pruebas Unitarias y de Componente', () => {
  const mockRefetch = vi.fn();
  const mockSetFiltros = vi.fn();
  const mockFetchNextPage = vi.fn();
  const mockCreateReserva = vi.fn();
  const mockUpdateReserva = vi.fn();
  const mockDeleteReserva = vi.fn();
  const mockCancelarReserva = vi.fn();
  const mockDesagendarReserva = vi.fn();

  const mockUseReservas = (overrides: Partial<ReturnType<typeof useReservasHook.useReservas>> = {}) => {
    vi.mocked(useReservasHook.useReservas).mockReturnValue({
      reservas: mockReservas as unknown as ReservaDTO[],
      total: mockReservas.length,
      filtros: { tab: 'PROXIMAS' },
      loading: false,
      error: null,
      refetch: mockRefetch,
      setFiltros: mockSetFiltros,
      fetchNextPage: mockFetchNextPage,
      hasNextPage: false,
      isFetchingNextPage: false,
      createReserva: mockCreateReserva,
      updateReserva: mockUpdateReserva,
      deleteReserva: mockDeleteReserva,
      cancelarReserva: mockCancelarReserva,
      cancelando: false,
      desagendarReserva: mockDesagendarReserva,
      desagendando: false,
      ...overrides,
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseReservas();
  });

  it('1. Debe renderizar la lista de reservas con números correlativos y titulares', () => {
    render(<ReservasPage />);

    expect(screen.getByText('Mayte Valdés Rubio')).toBeInTheDocument();
    expect(screen.getByText('#260815-0001')).toBeInTheDocument();
    expect(screen.getByText('Carlos Santander')).toBeInTheDocument();
    expect(screen.getByText('#260815-0002')).toBeInTheDocument();
  });

  it('2. Debe delegar la búsqueda al servidor (Pilar 5.3) al escribir en el campo de búsqueda', async () => {
    render(<ReservasPage />);

    const searchInput = screen.getByPlaceholderText(/Buscar por titular, RUT, pasajero o código\.\.\./i);
    fireEvent.change(searchInput, { target: { value: 'Mayte' } });

    await waitFor(() => expect(mockSetFiltros).toHaveBeenCalledWith({ q: 'Mayte' }));
  });

  it('2b. Las pestañas temporales también viajan al servidor', () => {
    render(<ReservasPage />);

    fireEvent.click(screen.getByRole('button', { name: /Pasadas \/ Historial/i }));
    expect(mockSetFiltros).toHaveBeenCalledWith({ tab: 'PASADAS' });
  });

  it('3. Debe manejar lista vacía mostrando el contenedor correspondiente sin romperse', () => {
    mockUseReservas({
      reservas: [],
      total: 0,
    });

    render(<ReservasPage />);

    expect(screen.getByText('No se encontraron reservas')).toBeInTheDocument();
  });

  it('4. Debe abrir el modal de nueva reserva al hacer clic en "Nueva Reserva"', () => {
    render(<ReservasPage />);

    const newBtn = screen.getByRole('button', { name: /Nueva Reserva/i });
    fireEvent.click(newBtn);

    expect(screen.getByText('Crear Nueva Reserva')).toBeInTheDocument();
  });

  it('5. Fase 2b: una reserva CANCELADA muestra badge CANCELADA y no ofrece botón Cancelar ni eliminar', () => {
    const reservaCancelada = {
      ...mockReservas[0],
      id: 3,
      numeroReserva: '260815-0003',
      nombreTitular: 'Titular Cancelado',
      estado: 'CANCELADA',
      motivoCancelacion: 'Mal clima',
      version: 2,
    };

    mockUseReservas({
      reservas: [reservaCancelada] as unknown as ReservaDTO[],
      total: 1,
    });

    render(<ReservasPage />);

    // Badge de ciclo de vida visible para la reserva cancelada
    expect(screen.getByText('CANCELADA')).toBeInTheDocument();

    // El badge del encabezado también refleja el estado cancelado
    expect(screen.getByText('✗ Cancelada')).toBeInTheDocument();

    // Sin acción de cancelación disponible para una reserva ya cancelada
    expect(screen.queryByRole('button', { name: /Cancelar Reserva/i })).not.toBeInTheDocument();

    // Reserva terminal (CANCELADA/COMPLETADA): no ofrece eliminar ni editar
    expect(screen.queryByTitle(/Eliminar Reserva/i)).not.toBeInTheDocument();
    expect(screen.queryByTitle(/Editar Reserva/i)).not.toBeInTheDocument();
  });

  it('6. Fase 2b: una reserva COMPLETADA muestra "✓ Completada" en el encabezado y no cae a "Sin Agendar"', () => {
    const reservaCompletada = {
      ...mockReservas[0],
      id: 4,
      numeroReserva: '260815-0004',
      nombreTitular: 'Titular Completado',
      estado: 'COMPLETADA',
      version: 3,
      pasajeros: [
        {
          ...mockReservas[0].pasajeros[0],
          id: 4,
          vuelos: [{ id: 4, fechaHora: todayIso, estado: 'COMPLETADO', pilotoId: 1 }]
        }
      ]
    };

    mockUseReservas({
      reservas: [reservaCompletada] as unknown as ReservaDTO[],
      total: 1,
    });

    render(<ReservasPage />);

    // El badge del encabezado refleja el ciclo de vida y NO el derivado de agendamiento
    expect(screen.getByText('✓ Completada')).toBeInTheDocument();
    expect(screen.queryByText('📅 Sin Agendar')).not.toBeInTheDocument();
  });

  it('7. Fase 2b: una reserva CANCELADA con vuelos COMPLETADO conservados como historial muestra "✗ Cancelada" y no "✓ Completada"', () => {
    // cancelar() conserva los vuelos COMPLETADO como historial real; el badge
    // del encabezado debe respetar el estado formal CANCELADA por encima del
    // fallback `todosVolaron`.
    const reservaCanceladaConHistorial = {
      ...mockReservas[0],
      id: 5,
      numeroReserva: '260815-0005',
      nombreTitular: 'Titular Cancelada Con Historial',
      estado: 'CANCELADA',
      version: 2,
      pasajeros: [
        {
          ...mockReservas[0].pasajeros[0],
          id: 5,
          vuelos: [{ id: 5, fechaHora: todayIso, estado: 'COMPLETADO', pilotoId: 1 }]
        }
      ]
    };

    mockUseReservas({
      reservas: [reservaCanceladaConHistorial] as unknown as ReservaDTO[],
      total: 1,
    });

    render(<ReservasPage />);

    expect(screen.getByText('✗ Cancelada')).toBeInTheDocument();
    expect(screen.queryByText('✓ Completada')).not.toBeInTheDocument();
  });

  it('8. Permite crear reserva sin exigir fecha ni bloque y con flag esGiftCard opcional', async () => {
    mockCreateReserva.mockResolvedValueOnce({
      id: 10,
      numeroReserva: '260830-0010',
      nombreTitular: 'Regalo Giftcard',
      esGiftCard: true,
      estadoPago: 'PENDIENTE',
      estado: 'SIN_AGENDAR',
      valorTotal: 80000,
      abono: 0,
      pasajeros: [{ id: 10, nombre: 'Beneficiario' }],
      pagos: [],
    });

    render(<ReservasPage />);

    fireEvent.click(screen.getByRole('button', { name: /Nueva Reserva/i }));
    expect(screen.getByText('Crear Nueva Reserva')).toBeInTheDocument();

    // Marcar ticket de Giftcard
    const giftCardCheckbox = screen.getByRole('checkbox');
    fireEvent.click(giftCardCheckbox);

    // Llenar campos requeridos
    fireEvent.change(screen.getByPlaceholderText('Ej: Juan Pérez'), { target: { value: 'Regalo Giftcard' } });
    fireEvent.change(screen.getByPlaceholderText('Nombre y Apellido'), { target: { value: 'Beneficiario' } });

    fireEvent.click(screen.getByRole('button', { name: 'Crear Reserva' }));

    await waitFor(() => {
      expect(mockCreateReserva).toHaveBeenCalledWith(
        expect.objectContaining({
          nombreTitular: 'Regalo Giftcard',
          esGiftCard: true,
          fechaAgenda: null,
          horaAgenda: null,
          pasajeros: expect.arrayContaining([
            expect.objectContaining({ nombre: 'Beneficiario' })
          ])
        })
      );
    });
  });

  describe('Paginación on-demand y scroll infinito', () => {
    it('9. Debe mostrar botón "Cargar más reservas" cuando hasNextPage es true y disparar fetchNextPage al hacer clic', () => {
      mockUseReservas({
        total: 50,
        hasNextPage: true,
      });

      render(<ReservasPage />);

      const loadMoreBtn = screen.getByRole('button', { name: /Cargar más reservas/i });
      expect(loadMoreBtn).toBeInTheDocument();

      fireEvent.click(loadMoreBtn);
      expect(mockFetchNextPage).toHaveBeenCalledTimes(1);
    });

    it('10. Debe mostrar indicador de carga "Cargando más reservas..." cuando isFetchingNextPage es true', () => {
      mockUseReservas({
        total: 50,
        hasNextPage: true,
        isFetchingNextPage: true,
      });

      render(<ReservasPage />);

      expect(screen.getByText('Cargando más reservas...')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Cargar más reservas/i })).not.toBeInTheDocument();
    });

    it('11. Debe mostrar mensaje de finalización cuando hasNextPage es false y hay reservas cargadas', () => {
      mockUseReservas({
        total: mockReservas.length,
        hasNextPage: false,
      });

      render(<ReservasPage />);

      expect(screen.getByText(/Has llegado al final de las reservas \(2 reservas\)/i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Cargar más reservas/i })).not.toBeInTheDocument();
    });

    it('12. Debe disparar fetchNextPage cuando el IntersectionObserver del centinela detecta intersección', () => {
      let sentinelCallback: IntersectionObserverCallback | null = null;
      const originalIO = global.IntersectionObserver;

      class TestIntersectionObserver {
        private cb: IntersectionObserverCallback;
        constructor(cb: IntersectionObserverCallback) {
          this.cb = cb;
        }
        observe = vi.fn((target: Element) => {
          // Capturar el callback del centinela (div h-4 w-full), ignorando observadores de Next.js <Link>
          if (target.tagName === 'DIV' && target.classList?.contains('h-4')) {
            sentinelCallback = this.cb;
          }
        });
        unobserve = vi.fn();
        disconnect = vi.fn();
      }
      global.IntersectionObserver = TestIntersectionObserver as unknown as typeof IntersectionObserver;

      mockUseReservas({
        total: 50,
        hasNextPage: true,
      });

      render(<ReservasPage />);

      expect(sentinelCallback).toBeTypeOf('function');

      // Simular evento de intersección del centinela
      sentinelCallback!([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);

      expect(mockFetchNextPage).toHaveBeenCalledTimes(1);

      global.IntersectionObserver = originalIO;
    });

    it('13. Debe permitir desagendar una reserva agendada y disparar desagendarReserva al confirmar', async () => {
      const reservaAgendada = {
        ...mockReservas[0],
        id: 8,
        numeroReserva: '260815-0008',
        nombreTitular: 'Titular Agendado',
        estado: 'AGENDADA' as const,
        version: 1,
        pasajeros: [
          {
            ...mockReservas[0].pasajeros[0],
            id: 80,
            vuelos: [{ id: 801, fechaHora: todayIso, estado: 'AGENDADO', pilotoId: 1 }],
          },
        ],
      };

      mockUseReservas({
        reservas: [reservaAgendada] as unknown as ReservaDTO[],
        total: 1,
      });

      render(<ReservasPage />);

      // Desagendar ahora vive en el menú ⋮ junto a Editar/Eliminar
      const menuBtn = screen.getByRole('button', { name: /Acciones de reserva/i });
      fireEvent.click(menuBtn);

      const desagendarBtn = screen.getByRole('menuitem', { name: /Desagendar/i });
      expect(desagendarBtn).toBeInTheDocument();

      fireEvent.click(desagendarBtn);

      expect(screen.getByText('Desagendar Reserva')).toBeInTheDocument();
      expect(screen.getByText(/Se liberarán 1 vuelo\(s\) y pilotos asignados/i)).toBeInTheDocument();

      const confirmBtn = screen.getByRole('button', { name: /Sí, Desagendar/i });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(mockDesagendarReserva).toHaveBeenCalledWith(8, {
          version: 1,
        });
      });
      // El cierre del modal ocurre tras el await de la mutación; esperarlo
      // dentro de act(...) evita el warning "not wrapped in act".
      await waitFor(() => {
        expect(screen.queryByText('Desagendar Reserva')).not.toBeInTheDocument();
      });
    });

    it('14. Debe permitir cancelar una reserva con chip de motivo rápido (Mal tiempo) y emitir devolución integrada', async () => {
      const reservaConAbono = {
        ...mockReservas[0],
        id: 9,
        numeroReserva: '260815-0009',
        nombreTitular: 'Titular Clima',
        estado: 'AGENDADA' as const,
        abono: 50000,
        montoDevuelto: 0,
        version: 1,
        pasajeros: [
          {
            ...mockReservas[0].pasajeros[0],
            id: 90,
            vuelos: [{ id: 901, fechaHora: todayIso, estado: 'AGENDADO', pilotoId: 1 }],
          },
        ],
      };

      mockUseReservas({
        reservas: [reservaConAbono] as unknown as ReservaDTO[],
        total: 1,
      });

      render(<ReservasPage />);

      const cancelarBtn = screen.getByRole('button', { name: /Cancelar Reserva/i });
      expect(cancelarBtn).toBeInTheDocument();
      fireEvent.click(cancelarBtn);

      expect(screen.getByRole('heading', { name: 'Cancelar Reserva' })).toBeInTheDocument();
      expect(screen.getByText(/Devolución de Dinero Inmediata/i)).toBeInTheDocument();

      // Clic en chip rápido de mal tiempo
      const chipClima = screen.getByRole('button', { name: /🌧️ Mal tiempo/i });
      fireEvent.click(chipClima);

      const confirmBtn = screen.getByRole('button', { name: /Confirmar Cancelación y Devolución/i });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(mockCancelarReserva).toHaveBeenCalledWith(9, {
          motivo: expect.stringContaining('Mal tiempo'),
          version: 1,
          devolucion: expect.objectContaining({
            monto: 50000,
            metodoPago: 'TRANSFERENCIA',
          }),
        });
      });
    });
  });
});
