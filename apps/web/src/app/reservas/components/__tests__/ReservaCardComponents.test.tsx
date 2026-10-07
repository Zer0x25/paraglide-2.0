import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test/render';
import {
  ReservaCardHeader,
  ReservaCardFinancials,
  ReservaCardPassengerList,
  ReservaCardActions,
} from '../index';
import type { ReservaConPasajeros, PasajeroConVuelos } from '@/types/reservaDetalle';
import type { ReservaCardState } from '../../utils/reservaCardState';

describe('ReservaCard - Sub-componentes Atómicos (ADR 014)', () => {
  const createMockReserva = (overrides: Partial<ReservaConPasajeros> = {}): ReservaConPasajeros => {
    return {
      id: 10,
      numeroReserva: '260925-0010',
      nombreTitular: 'Martina Navratilova',
      telefono: '+56987654321',
      email: 'martina@example.com',
      fechaAgenda: '2026-09-30T10:00:00.000Z',
      horaAgenda: '10:00',
      estado: 'SIN_AGENDAR',
      estadoPago: 'ABONADO',
      valorTotal: 90000,
      abono: 45000,
      montoDevuelto: 0,
      descuento: 0,
      esGiftCard: false,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      pasajeros: [],
      pagos: [{ id: 1, monto: 45000 }] as unknown as ReservaConPasajeros['pagos'],
      ...overrides,
    } as unknown as ReservaConPasajeros;
  };

  const createMockState = (overrides: Partial<ReservaCardState> = {}): ReservaCardState => {
    return {
      totalPasajeros: 1,
      pasajerosCompletados: [],
      pasajerosActivos: [],
      pasajerosAgendados: 0,
      estaTotalmenteAgendado: false,
      estaParcialmenteAgendado: false,
      todosDeslindesFirmados: true,
      saldoPendiente: 45000,
      estadoReserva: 'SIN_AGENDAR',
      estaSinAgendar: true,
      esTerminal: false,
      esCerrada: false,
      esInmutable: false,
      esEditable: true,
      puedeEliminarPorPago: false,
      esEliminable: false,
      motivoNoEliminable: 'Tiene pagos registrados',
      puedeVerVoucher: true,
      todosVolaron: false,
      badgeEstado: null,
      ...overrides,
    };
  };

  describe('ReservaCardHeader', () => {
    it('debe renderizar número de reserva, titular, contacto y abrir menú de acciones', () => {
      const onEdit = vi.fn();
      const reserva = createMockReserva();
      const state = createMockState();

      render(
        <ReservaCardHeader
          reserva={reserva}
          state={state}
          onEdit={onEdit}
          onDelete={vi.fn()}
          onOpenPagos={vi.fn()}
        />
      );

      expect(screen.getByText('#260925-0010')).toBeInTheDocument();
      expect(screen.getByText('Martina Navratilova')).toBeInTheDocument();
      expect(screen.getByText('+56987654321')).toBeInTheDocument();
      expect(screen.getByText('📅 Sin Agendar')).toBeInTheDocument();

      const menuBtn = screen.getByLabelText('Acciones de reserva');
      fireEvent.click(menuBtn);

      const editBtn = screen.getByText('Editar reserva');
      fireEvent.click(editBtn);
      expect(onEdit).toHaveBeenCalledWith(reserva);
    });

    it('debe mostrar badge de Cerrada cuando esCerrada es true', () => {
      const reserva = createMockReserva();
      const state = createMockState({ esCerrada: true });

      render(
        <ReservaCardHeader
          reserva={reserva}
          state={state}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          onOpenPagos={vi.fn()}
        />
      );

      expect(screen.getByText('Cerrada')).toBeInTheDocument();
    });
  });

  describe('ReservaCardFinancials', () => {
    it('debe renderizar el estado de pago, total formateado y saldo pendiente', () => {
      render(
        <ReservaCardFinancials
          estadoPago="ABONADO"
          valorTotal={90000}
          saldoPendiente={45000}
        />
      );

      expect(screen.getByText('ABONADO')).toBeInTheDocument();
      expect(screen.getByText('$90.000')).toBeInTheDocument();
      expect(screen.getByText('(Resta: $45.000)')).toBeInTheDocument();
    });
  });

  describe('ReservaCardPassengerList', () => {
    it('debe renderizar la lista de pasajeros, badge de deslinde y permitir firmar en pista', () => {
      const onOpenFirma = vi.fn();
      const mockPasajero: PasajeroConVuelos = {
        id: 1,
        nombre: 'Gabriela Mistral',
        peso: 62,
        firmaDeslinde: false,
        vuelos: [],
      } as unknown as PasajeroConVuelos;

      const reserva = createMockReserva();

      render(
        <ReservaCardPassengerList
          reserva={reserva}
          totalPasajeros={1}
          todosDeslindesFirmados={false}
          pasajerosActivos={[mockPasajero]}
          pasajerosCompletados={[]}
          estadoReserva="SIN_AGENDAR"
          onOpenFirma={onOpenFirma}
          onWhatsAppPiloto={vi.fn()}
        />
      );

      expect(screen.getByText('Pasajeros (1)')).toBeInTheDocument();
      expect(screen.getByText('Faltan firmas')).toBeInTheDocument();
      expect(screen.getByText('Gabriela Mistral')).toBeInTheDocument();
      expect(screen.getByText('(62kg)')).toBeInTheDocument();

      const firmarBtn = screen.getByText('Firmar en Pista');
      fireEvent.click(firmarBtn);
      expect(onOpenFirma).toHaveBeenCalledWith(mockPasajero);
    });
  });

  describe('ReservaCardActions', () => {
    it('debe renderizar botones de gestión de pagos y voucher en reservas activas', () => {
      const onOpenPagos = vi.fn();
      const onOpenVoucher = vi.fn();
      const onOpenAgendar = vi.fn();

      const reserva = createMockReserva();
      const state = createMockState({ puedeVerVoucher: true, estaSinAgendar: true });

      render(
        <ReservaCardActions
          reserva={reserva}
          state={state}
          onOpenPagos={onOpenPagos}
          onOpenVoucher={onOpenVoucher}
          onOpenAgendar={onOpenAgendar}
          onOpenCancelar={vi.fn()}
          onWhatsAppConfirmation={vi.fn()}
        />
      );

      const pagosBtn = screen.getByText('Gestionar Pagos y Abonos');
      fireEvent.click(pagosBtn);
      expect(onOpenPagos).toHaveBeenCalledWith(reserva);

      const voucherBtn = screen.getByText('Voucher');
      fireEvent.click(voucherBtn);
      expect(onOpenVoucher).toHaveBeenCalledWith(reserva);

      const agendarBtn = screen.getByText('Agendar');
      fireEvent.click(agendarBtn);
      expect(onOpenAgendar).toHaveBeenCalledWith(reserva);
    });

    it('debe renderizar acciones simplificadas de solo lectura si la reserva está completada o cerrada', () => {
      const onOpenVoucher = vi.fn();
      const onOpenPagos = vi.fn();
      const reserva = createMockReserva({ pagos: [{ id: 1 }, { id: 2 }] as unknown as ReservaConPasajeros['pagos'] });
      const state = createMockState({ estadoReserva: 'COMPLETADA', esCerrada: true });

      render(
        <ReservaCardActions
          reserva={reserva}
          state={state}
          onOpenPagos={onOpenPagos}
          onOpenVoucher={onOpenVoucher}
          onOpenAgendar={vi.fn()}
          onOpenCancelar={vi.fn()}
          onWhatsAppConfirmation={vi.fn()}
        />
      );

      expect(screen.getByText('Ver Pagos (2)')).toBeInTheDocument();
      expect(screen.getByText('Voucher')).toBeInTheDocument();
    });
  });
});
