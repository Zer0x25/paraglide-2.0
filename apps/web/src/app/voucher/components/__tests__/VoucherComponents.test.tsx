import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test/render';
import {
  VoucherActionBar,
  VoucherHeader,
  VoucherFlightCard,
  VoucherLocationCard,
  VoucherPassengerList,
  VoucherTarifaDetail,
  VoucherQrFinancialCard,
  VoucherSafetyInstructions,
  VoucherLoading,
  VoucherNotFound,
} from '../index';

describe('Voucher - Componentes Presentacionales Atómicos (ADR 014)', () => {
  describe('VoucherActionBar', () => {
    it('debe disparar los callbacks al hacer click en los botones de acción', () => {
      const onGoogleCalendar = vi.fn();
      const onAddToCalendar = vi.fn();
      const onShare = vi.fn();
      const onDownloadPdf = vi.fn();

      render(
        <VoucherActionBar
          publicIdentifier="abc-123"
          downloadingPdf={false}
          onGoogleCalendar={onGoogleCalendar}
          onAddToCalendar={onAddToCalendar}
          onShare={onShare}
          onDownloadPdf={onDownloadPdf}
        />
      );

      fireEvent.click(screen.getByTitle('Añadir vuelo a Google Calendar en 1-clic'));
      expect(onGoogleCalendar).toHaveBeenCalledOnce();

      fireEvent.click(screen.getByTitle('Abrir en Calendario de iPhone / Android (.ics)'));
      expect(onAddToCalendar).toHaveBeenCalledOnce();

      fireEvent.click(screen.getByTitle('Compartir voucher'));
      expect(onShare).toHaveBeenCalledOnce();

      fireEvent.click(screen.getByTitle('Descargar voucher en PDF'));
      expect(onDownloadPdf).toHaveBeenCalledOnce();
    });

    it('debe mostrar indicador de descarga cuando downloadingPdf es true', () => {
      render(
        <VoucherActionBar
          publicIdentifier="abc-123"
          downloadingPdf={true}
          onGoogleCalendar={vi.fn()}
          onAddToCalendar={vi.fn()}
          onShare={vi.fn()}
          onDownloadPdf={vi.fn()}
        />
      );

      expect(screen.getByText('Descargando…')).toBeInTheDocument();
      expect(screen.getByTitle('Descargar voucher en PDF')).toBeDisabled();
    });
  });

  describe('VoucherHeader', () => {
    it('debe renderizar el título, número y el badge correspondiente según el estado', () => {
      const { rerender } = render(
        <VoucherHeader numeroReserva="RES-001" reservaId={10} estado="AGENDADA" />
      );

      expect(screen.getByText('VUELO EN PARAPENTE')).toBeInTheDocument();
      expect(screen.getByText('#RES-001')).toBeInTheDocument();
      expect(screen.getByText('✓ CONFIRMADO')).toBeInTheDocument();

      rerender(<VoucherHeader numeroReserva="RES-001" reservaId={10} estado="CANCELADA" />);
      expect(screen.getByText('✗ CANCELADA')).toBeInTheDocument();

      rerender(<VoucherHeader numeroReserva="RES-001" reservaId={10} estado="COMPLETADA" />);
      expect(screen.getByText('✓ COMPLETADA')).toBeInTheDocument();

      rerender(<VoucherHeader numeroReserva="RES-001" reservaId={10} estado="SIN_AGENDAR" />);
      expect(screen.getByText('○ SIN AGENDAR')).toBeInTheDocument();
    });
  });

  describe('VoucherFlightCard y VoucherLocationCard', () => {
    it('debe renderizar datos del titular, fecha y hora en VoucherFlightCard', () => {
      render(
        <VoucherFlightCard
          nombreTitular="Carlos Santana"
          telefono="+56911223344"
          fechaFormateada="sábado, 15 de agosto de 2026"
          horaAgenda="11:30"
        />
      );

      expect(screen.getByText('Carlos Santana')).toBeInTheDocument();
      expect(screen.getByText('+56911223344')).toBeInTheDocument();
      expect(screen.getByText('sábado, 15 de agosto de 2026')).toBeInTheDocument();
      expect(screen.getByText(/11:30 hrs/)).toBeInTheDocument();
    });

    it('debe renderizar el punto de encuentro en VoucherLocationCard', () => {
      render(<VoucherLocationCard puntoDeEncuentro="Mirador El Manzano" />);

      expect(screen.getByText('Mirador El Manzano')).toBeInTheDocument();
      expect(screen.getByText('Pista Principal de Vuelo')).toBeInTheDocument();
    });
  });

  describe('VoucherPassengerList', () => {
    it('debe listar pasajeros y reflejar el estado de firma de deslinde', () => {
      const pasajeros = [
        { id: 1, nombre: 'Ana Gómez', rutDni: '11.111.111-1', firmaDeslinde: true },
        { id: 2, nombre: 'Pedro Pascal', rutDni: null, firmaDeslinde: false },
      ];

      render(<VoucherPassengerList pasajeros={pasajeros} />);

      expect(screen.getByText('Pasajeros Registrados (2)')).toBeInTheDocument();
      expect(screen.getByText('Ana Gómez')).toBeInTheDocument();
      expect(screen.getByText('11.111.111-1')).toBeInTheDocument();
      expect(screen.getByText(/Deslinde Firmado/)).toBeInTheDocument();

      expect(screen.getByText('Pedro Pascal')).toBeInTheDocument();
      expect(screen.getByText('RUT por registrar')).toBeInTheDocument();
      expect(screen.getByText(/Firma Pendiente/)).toBeInTheDocument();
    });
  });

  describe('VoucherTarifaDetail', () => {
    it('debe desglosar tarifa base y descuento promocional correctamente', () => {
      render(
        <VoucherTarifaDetail
          tarifa={{ id: 1, nombre: 'Vuelo Premium', precio: 90000 }}
          promocion={{ id: 5, nombre: 'CyberDay', tipoDescuento: 'MONTO_FIJO', valor: 10000 }}
          descuento={20000}
          valorTotal={160000}
          pasajerosCount={2}
        />
      );

      expect(screen.getByText('Vuelo Premium')).toBeInTheDocument();
      expect(screen.getByText(/2 vuelos ×/)).toBeInTheDocument();
      expect(screen.getByText('CyberDay')).toBeInTheDocument();
      expect(screen.getByText(/-\$20\.000/)).toBeInTheDocument();
      expect(screen.getByText('$160.000')).toBeInTheDocument();
    });
  });

  describe('VoucherQrFinancialCard', () => {
    it('debe renderizar el código QR y los valores financieros según estado de pago', () => {
      render(
        <VoucherQrFinancialCard
          qrDataUrl="data:image/png;base64,mockqr"
          publicIdentifier="tok-123"
          estadoPago="ABONADO"
          saldoPendiente={30000}
          abono={50000}
          valorTotal={80000}
        />
      );

      const qrImg = screen.getByAltText('QR Deslinde');
      expect(qrImg).toBeInTheDocument();
      expect(screen.getByText(/\$30\.000 \(ABONADO\)/)).toBeInTheDocument();
      expect(screen.getByText(/Abono: \$50\.000 \/ \$80\.000/)).toBeInTheDocument();
    });

    it('debe mostrar mensaje específico si el estado es DEVUELTO', () => {
      render(
        <VoucherQrFinancialCard
          qrDataUrl="data:image/png;base64,mockqr"
          publicIdentifier="tok-123"
          estadoPago="DEVUELTO"
          saldoPendiente={0}
          abono={50000}
          valorTotal={50000}
          montoDevuelto={50000}
        />
      );

      expect(screen.getByText(/\$50\.000 DEVUELTO/)).toBeInTheDocument();
      expect(screen.getByText(/Devuelto: \$50\.000/)).toBeInTheDocument();
    });
  });

  describe('VoucherSafetyInstructions', () => {
    it('debe renderizar recomendaciones de seguridad y peso máximo', () => {
      render(<VoucherSafetyInstructions />);

      expect(screen.getByText(/Recomendaciones Importantes para tu Vuelo:/)).toBeInTheDocument();
      expect(screen.getByText(/115 kg/)).toBeInTheDocument();
    });
  });

  describe('VoucherFeedback', () => {
    it('debe mostrar spinner en VoucherLoading', () => {
      render(<VoucherLoading />);
      expect(screen.getByText('Generando tu Boarding Pass...')).toBeInTheDocument();
    });

    it('debe mostrar mensaje en VoucherNotFound', () => {
      render(<VoucherNotFound error="Voucher caducado" />);
      expect(screen.getByText('Voucher no encontrado')).toBeInTheDocument();
      expect(screen.getByText('Voucher caducado')).toBeInTheDocument();
    });
  });
});
