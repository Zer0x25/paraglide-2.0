import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test/render';
import {
  VueloModalHeader,
  VueloModalSelectReserva,
  VueloModalDateTime,
  VueloModalSingleAssign,
  VueloModalFinancialDetail,
} from '../index';
import type { ReservaConPasajeros } from '@/types/reservaDetalle';
import type { Pasajero, Piloto } from '../../hooks/types';

describe('VueloModal - Sub-componentes Atómicos (ADR 014)', () => {
  describe('VueloModalHeader', () => {
    it('debe renderizar título, badge de vuelo y ejecutar onClose al presionar cerrar', () => {
      const onClose = vi.fn();
      render(
        <VueloModalHeader
          esCerrada={false}
          editingId={42}
          filterReservaId={null}
          currentReserva={null}
          currentPasajero={{ id: 1, nombre: 'Laura Pausini', reservaId: 10 } as unknown as Pasajero}
          currentGroupPassengersCount={0}
          onClose={onClose}
        />
      );

      expect(screen.getByText('Editar Vuelo')).toBeInTheDocument();
      expect(screen.getByText('#Vuelo-42')).toBeInTheDocument();
      expect(screen.getByText('Laura Pausini')).toBeInTheDocument();

      fireEvent.click(screen.getByLabelText('Cerrar modal'));
      expect(onClose).toHaveBeenCalledOnce();
    });

    it('debe mostrar indicador de Cerrada (Inmutable) si esCerrada es true', () => {
      render(
        <VueloModalHeader
          esCerrada={true}
          editingId={42}
          filterReservaId={null}
          currentReserva={null}
          currentPasajero={null}
          currentGroupPassengersCount={0}
          onClose={vi.fn()}
        />
      );

      expect(screen.getByText('Cerrada (Inmutable)')).toBeInTheDocument();
      expect(screen.getByText('Detalle de Vuelo')).toBeInTheDocument();
    });
  });

  describe('VueloModalSelectReserva', () => {
    const mockReservas: ReservaConPasajeros[] = [
      {
        id: 1,
        numeroReserva: 'RES-001',
        nombreTitular: 'Juan Pérez',
        estado: 'CONFIRMADA',
        pasajeros: [{ id: 1, nombre: 'Juan Jr', vuelos: [] }],
      } as unknown as ReservaConPasajeros,
      {
        id: 2,
        numeroReserva: 'RES-002',
        nombreTitular: 'Ana Gómez',
        estado: 'COMPLETADA',
        pasajeros: [{ id: 2, nombre: 'Ana Jr', vuelos: [{ estado: 'COMPLETADO' }] }],
      } as unknown as ReservaConPasajeros,
      {
        id: 3,
        numeroReserva: 'RES-003',
        nombreTitular: 'Carlos Ruiz',
        estado: 'CANCELADA',
        pasajeros: [{ id: 3, nombre: 'Carlos Jr', vuelos: [] }],
      } as unknown as ReservaConPasajeros,
    ];

    it('debe listar solo reservas no terminales con pasajeros pendientes y emitir onSelectReserva', () => {
      const onSelect = vi.fn();
      render(
        <VueloModalSelectReserva
          reservas={mockReservas}
          filterReservaId={null}
          onSelectReserva={onSelect}
        />
      );

      expect(screen.getByText(/RES-001/)).toBeInTheDocument();
      expect(screen.queryByText(/RES-002/)).not.toBeInTheDocument();
      expect(screen.queryByText(/RES-003/)).not.toBeInTheDocument();

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: '1' } });
      expect(onSelect).toHaveBeenCalledWith(1);
    });
  });

  describe('VueloModalDateTime', () => {
    it('debe mostrar advertencia de día bloqueado', () => {
      render(
        <VueloModalDateTime
          fecha="2026-09-25"
          hora=""
          esCerrada={false}
          isBloqueado={true}
          availableBlocks={[]}
          selectedTimeIsCustom={false}
          isEditing={false}
          hasFilterReserva={false}
          onFechaChange={vi.fn()}
          onHoraChange={vi.fn()}
          openConfigBloques={vi.fn()}
          handleAsignacionAutomatica={vi.fn()}
        />
      );

      expect(screen.getByText('Día no operativo / bloqueado')).toBeInTheDocument();
    });

    it('debe renderizar bloques horarios disponibles y permitir seleccionar uno', () => {
      const onHoraChange = vi.fn();
      const blocks = [
        { horaInicio: '10:00', horaFin: '11:00', capacidad: 4 },
        { horaInicio: '11:00', horaFin: '12:00', capacidad: 4 },
      ];

      render(
        <VueloModalDateTime
          fecha="2026-09-25"
          hora="10:00"
          esCerrada={false}
          isBloqueado={false}
          availableBlocks={blocks}
          selectedTimeIsCustom={false}
          isEditing={false}
          hasFilterReserva={true}
          onFechaChange={vi.fn()}
          onHoraChange={onHoraChange}
          openConfigBloques={vi.fn()}
          handleAsignacionAutomatica={vi.fn()}
        />
      );

      expect(screen.getByText('10:00 – 11:00')).toBeInTheDocument();
      expect(screen.getByText('11:00 – 12:00')).toBeInTheDocument();
      expect(screen.getByText('Ejecutar Auto-Match')).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText('Bloque Horario'), { target: { value: '11:00' } });
      expect(onHoraChange).toHaveBeenCalledWith('11:00');
    });
  });

  describe('VueloModalSingleAssign', () => {
    it('debe permitir asignar pasajero y piloto respetando deshabilitación por ocupado', () => {
      const onPasajero = vi.fn();
      const onPiloto = vi.fn();
      const pasajeros = [{ id: 10, nombre: 'Diego Torres', peso: 75 }];
      const pilotos = [
        { id: 101, nombre: 'Piloto Ace', categoria: 'INSTRUCTOR' },
        { id: 102, nombre: 'Piloto Busy', categoria: 'MASTER' },
      ];

      render(
        <VueloModalSingleAssign
          pasajeroId="10"
          pilotoId=""
          esCerrada={false}
          poolPasajeros={pasajeros as unknown as Pasajero[]}
          pilotos={pilotos as unknown as Piloto[]}
          isPilotoDisabled={(pId) => pId === 102}
          onPasajeroChange={onPasajero}
          onPilotoChange={onPiloto}
        />
      );

      expect(screen.getByText(/Diego Torres/)).toBeInTheDocument();
      expect(screen.getByText(/Piloto Ace/)).toBeInTheDocument();
      expect(screen.getByText(/Piloto Busy.*\(Ocupado\)/)).toBeDisabled();

      fireEvent.change(screen.getByLabelText('Piloto Asignado'), { target: { value: '101' } });
      expect(onPiloto).toHaveBeenCalledWith('101');
    });
  });

  describe('VueloModalFinancialDetail', () => {
    it('debe mostrar saldo pendiente y botón para saldar si tiene saldo', () => {
      const onOpenPagos = vi.fn();
      const mockReserva = {
        id: 1,
        numeroReserva: '001',
        valorTotal: 100000,
        abono: 40000,
        estadoPago: 'ABONADO',
      } as unknown as ReservaConPasajeros;

      render(
        <VueloModalFinancialDetail
          infoReserva={mockReserva}
          isEditing={true}
          esCerrada={false}
          paso15Min={false}
          horaDesbloqueo="15:30"
          isCompleting={false}
          onOpenPagos={onOpenPagos}
        />
      );

      expect(screen.getByText('Saldo pendiente: $60.000')).toBeInTheDocument();
      const saldarBtn = screen.getByText('Registrar Pago / Saldar');
      fireEvent.click(saldarBtn);
      expect(onOpenPagos).toHaveBeenCalledWith(mockReserva);
    });

    it('debe permitir marcar como completada si el vuelo ya pasó (+15 min) y está pagado', () => {
      const onMarcar = vi.fn();
      const mockReserva = {
        id: 1,
        numeroReserva: '001',
        valorTotal: 80000,
        abono: 80000,
        estadoPago: 'PAGADO',
        pagos: [{ id: 1, monto: 80000 }],
      } as unknown as ReservaConPasajeros;

      render(
        <VueloModalFinancialDetail
          infoReserva={mockReserva}
          isEditing={true}
          esCerrada={false}
          paso15Min={true}
          horaDesbloqueo="14:00"
          isCompleting={false}
          onMarcarCompletada={onMarcar}
        />
      );

      expect(screen.getByText('Hora cumplida (+15 min) y pago al día')).toBeInTheDocument();
      const completeBtn = screen.getByText('Marcar como Completada');
      fireEvent.click(completeBtn);
      expect(onMarcar).toHaveBeenCalledOnce();
    });

    it('debe mostrar estado inmutable si esCerrada es true', () => {
      const mockReserva = {
        id: 1,
        valorTotal: 80000,
        abono: 80000,
        estadoPago: 'PAGADO',
        cerradaAt: '2026-09-20',
      } as unknown as ReservaConPasajeros;

      render(
        <VueloModalFinancialDetail
          infoReserva={mockReserva}
          isEditing={true}
          esCerrada={true}
          paso15Min={true}
          horaDesbloqueo="14:00"
          isCompleting={false}
        />
      );

      expect(screen.getByText('Valores conciliados y congelados en snapshot inmutable')).toBeInTheDocument();
    });
  });
});
