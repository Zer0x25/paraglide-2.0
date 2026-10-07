import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test/render';
import { ReservasErrorBanner } from '../ReservasErrorBanner';
import { ReservasTable } from '../ReservasTable';
import type { ReservaConPasajeros } from '@/types/reservaDetalle';

describe('Componentes modulares de Reservas', () => {
  describe('ReservasErrorBanner', () => {
    it('no debe renderizar nada si no hay error', () => {
      render(<ReservasErrorBanner error={null} onRetry={vi.fn()} />);
      expect(screen.queryByText(/Error de conexión:/i)).not.toBeInTheDocument();
    });

    it('debe renderizar mensaje de error y botón de reintentar si hay error', () => {
      const onRetry = vi.fn();
      render(<ReservasErrorBanner error={new Error('Network fail')} onRetry={onRetry} />);

      expect(screen.getByText(/Error de conexión:/i)).toBeInTheDocument();
      const retryBtn = screen.getByRole('button', { name: /Reintentar/i });
      fireEvent.click(retryBtn);
      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe('ReservasTable', () => {
    const defaultProps = {
      loading: false,
      reservas: [] as ReservaConPasajeros[],
      onFetchNextPage: vi.fn(),
      onEdit: vi.fn(),
      onDelete: vi.fn(),
      onOpenFirma: vi.fn(),
      onOpenPagos: vi.fn(),
      onOpenVoucher: vi.fn(),
      onOpenAgendar: vi.fn(),
      onOpenCancelar: vi.fn(),
      onOpenDesagendar: vi.fn(),
      onReabrir: vi.fn(),
      onWhatsAppConfirmation: vi.fn(),
      onWhatsAppPiloto: vi.fn(),
    };

    it('debe mostrar estado de carga cuando loading es true', () => {
      render(<ReservasTable {...defaultProps} loading={true} />);
      expect(screen.getByText('Cargando reservas...')).toBeInTheDocument();
    });

    it('debe mostrar estado vacío cuando no hay reservas', () => {
      render(<ReservasTable {...defaultProps} loading={false} reservas={[]} />);
      expect(screen.getByText('No se encontraron reservas')).toBeInTheDocument();
    });

    it('debe renderizar tarjetas de reserva cuando hay elementos', () => {
      const mockReserva = {
        id: 101,
        numeroReserva: '260901-0101',
        nombreTitular: 'Pasajero Modular Test',
        telefono: '+56911223344',
        email: 'test@modular.cl',
        fechaAgenda: new Date().toISOString(),
        horaAgenda: '10:00',
        estadoPago: 'PENDIENTE',
        estado: 'SIN_AGENDAR',
        version: 1,
        valorTotal: 50000,
        abono: 0,
        montoDevuelto: 0,
        descuento: 0,
        esGiftCard: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        pasajeros: [],
        pagos: [],
      } as unknown as ReservaConPasajeros;

      render(<ReservasTable {...defaultProps} reservas={[mockReserva]} />);

      expect(screen.getByText('Pasajero Modular Test')).toBeInTheDocument();
      expect(screen.getByText('#260901-0101')).toBeInTheDocument();
    });
  });
});
