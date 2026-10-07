import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test/render';
import { CalendarioView } from '../CalendarioView';
import { CalendarioModals } from '../CalendarioModals';
import type { useCalendarioController } from '../../hooks/useCalendarioController';

vi.mock('../../VistaAgendas', () => ({
  default: () => <div data-testid="mock-vista-agendas">Vista Agendas Mock</div>,
}));

vi.mock('react-big-calendar', async () => {
  const actual = await vi.importActual('react-big-calendar');
  return {
    ...actual,
    Calendar: () => <div data-testid="mock-rbc-calendar">RBC Calendar Mock</div>,
  };
});

vi.mock('../VueloModal', () => ({
  VueloModal: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div data-testid="mock-vuelo-modal">Vuelo Modal Mock</div> : null),
}));

vi.mock('@/components/SyncCalendarModal', () => ({
  SyncCalendarModal: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div data-testid="mock-sync-modal">Sync Modal Mock</div> : null),
}));

vi.mock('@/components/ConfigBloquesModal', () => ({
  ConfigBloquesModal: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div data-testid="mock-config-modal">Config Modal Mock</div> : null),
}));

vi.mock('@/components/PagosModal', () => ({
  PagosModal: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div data-testid="mock-pagos-modal">Pagos Modal Mock</div> : null),
}));

describe('Componentes modulares de Calendario', () => {
  const createMockController = (overrides: Partial<ReturnType<typeof useCalendarioController>> = {}) => {
    return {
      loading: false,
      mostrarAgendas: false,
      date: new Date('2026-09-01T12:00:00Z'),
      vuelos: [],
      pilotos: [],
      getActiveConfigForDate: vi.fn(),
      getDateKey: vi.fn(() => '2026-09-01'),
      setDate: vi.fn(),
      handleAgendarDesdeAgenda: vi.fn(),
      handleEditarVuelo: vi.fn(),
      eventos: [],
      view: 'month',
      setView: vi.fn(),
      calendarMin: new Date(),
      calendarMax: new Date(),
      calendarStep: 60,
      handleSelectSlot: vi.fn(),
      handleSelectEvent: vi.fn(),
      setMostrarAgendas: vi.fn(),
      eventStyleGetter: vi.fn(),
      isMobile: false,
      isModalOpen: false,
      setIsModalOpen: vi.fn(),
      isSyncModalOpen: false,
      setIsSyncModalOpen: vi.fn(),
      isConfigModalOpen: false,
      setIsConfigModalOpen: vi.fn(),
      isPagosModalOpen: false,
      setIsPagosModalOpen: vi.fn(),
      selectedReservaPagos: null,
      setSelectedReservaPagos: vi.fn(),
      handlePagosSuccess: vi.fn(),
      ...overrides,
    } as unknown as ReturnType<typeof useCalendarioController>;
  };

  describe('CalendarioView', () => {
    it('debe mostrar mensaje de carga cuando loading es true', () => {
      const c = createMockController({ loading: true });
      render(<CalendarioView controller={c} />);

      expect(screen.getByText('Cargando calendario...')).toBeInTheDocument();
    });

    it('debe renderizar RBC Calendar en vista normal', () => {
      const c = createMockController({ loading: false, mostrarAgendas: false });
      render(<CalendarioView controller={c} />);

      expect(screen.getByTestId('mock-rbc-calendar')).toBeInTheDocument();
    });

    it('debe renderizar VistaAgendas cuando mostrarAgendas es true', () => {
      const c = createMockController({ loading: false, mostrarAgendas: true });
      render(<CalendarioView controller={c} />);

      expect(screen.getByTestId('mock-vista-agendas')).toBeInTheDocument();
    });
  });

  describe('CalendarioModals', () => {
    it('no debe renderizar modales cuando todos están cerrados', () => {
      const c = createMockController();
      render(<CalendarioModals controller={c} />);

      expect(screen.queryByTestId('mock-vuelo-modal')).not.toBeInTheDocument();
      expect(screen.queryByTestId('mock-sync-modal')).not.toBeInTheDocument();
      expect(screen.queryByTestId('mock-config-modal')).not.toBeInTheDocument();
      expect(screen.queryByTestId('mock-pagos-modal')).not.toBeInTheDocument();
    });

    it('debe renderizar VueloModal cuando isModalOpen es true', () => {
      const c = createMockController({ isModalOpen: true });
      render(<CalendarioModals controller={c} />);

      expect(screen.getByTestId('mock-vuelo-modal')).toBeInTheDocument();
    });

    it('debe renderizar SyncCalendarModal cuando isSyncModalOpen es true', () => {
      const c = createMockController({ isSyncModalOpen: true });
      render(<CalendarioModals controller={c} />);

      expect(screen.getByTestId('mock-sync-modal')).toBeInTheDocument();
    });

    it('debe renderizar ConfigBloquesModal cuando isConfigModalOpen es true', () => {
      const c = createMockController({ isConfigModalOpen: true });
      render(<CalendarioModals controller={c} />);

      expect(screen.getByTestId('mock-config-modal')).toBeInTheDocument();
    });

    it('debe renderizar PagosModal cuando isPagosModalOpen es true', () => {
      const c = createMockController({ isPagosModalOpen: true });
      render(<CalendarioModals controller={c} />);

      expect(screen.getByTestId('mock-pagos-modal')).toBeInTheDocument();
    });
  });
});
