import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../../../test/render';
import { AgendaNavHeader } from '../AgendaNavHeader';
import { AgendaTarjetaVuelo } from '../AgendaTarjetaVuelo';
import { AgendaCarril } from '../AgendaCarril';
import { AgendaEstadoVacio } from '../AgendaEstadoVacio';
import { AgendaVuelosFueraBloque } from '../AgendaVuelosFueraBloque';
import { AgendaBloqueHorario } from '../AgendaBloqueHorario';
import type { VueloVista, GrupoCarril, PilotoDia } from '../../agendas.util';
import { formatCLP } from '@/utils/format';
import { fechaHoraLocalToIso } from '@parapente/shared';

const mockVuelo: VueloVista = {
  id: 101,
  pilotoId: 1,
  pasajeroId: 201,
  fechaHora: fechaHoraLocalToIso('2026-08-29', '10:30'),
  estado: 'AGENDADO',
  valorPactado: 65000,
  pasajero: { nombre: 'María González' },
  piloto: { nombre: 'Carlos Piloto' },
};

describe('Componentes Atómicos de Agendas (ADR 014)', () => {
  describe('AgendaNavHeader', () => {
    it('renderiza fecha formateada y dispara eventos de navegación', () => {
      const onNavigate = vi.fn();
      const fecha = new Date(2026, 7, 29); // 29 agosto 2026

      render(
        <AgendaNavHeader
          fecha={fecha}
          dateKey="2026-08-29"
          hoyKey="2026-08-28"
          onNavigate={onNavigate}
        />
      );

      expect(screen.getByText(/29 de agosto/i)).toBeInTheDocument();

      const btnAnt = screen.getByRole('button', { name: /Ant/i });
      fireEvent.click(btnAnt);
      expect(onNavigate).toHaveBeenCalled();

      const btnHoy = screen.getByRole('button', { name: /Hoy/i });
      fireEvent.click(btnHoy);
      expect(onNavigate).toHaveBeenCalledTimes(2);

      const btnSig = screen.getByRole('button', { name: /Sig/i });
      fireEvent.click(btnSig);
      expect(onNavigate).toHaveBeenCalledTimes(3);
    });

    it('deshabilita el botón Hoy cuando dateKey === hoyKey', () => {
      render(
        <AgendaNavHeader
          fecha={new Date()}
          dateKey="2026-08-29"
          hoyKey="2026-08-29"
        />
      );

      const btnHoy = screen.getByRole('button', { name: /Hoy/i });
      expect(btnHoy).toBeDisabled();
    });
  });

  describe('AgendaTarjetaVuelo', () => {
    it('renderiza información del vuelo y dispara onEditar por click y teclado', () => {
      const onEditar = vi.fn();

      render(<AgendaTarjetaVuelo vuelo={mockVuelo} onEditar={onEditar} />);

      expect(screen.getByText('María González')).toBeInTheDocument();
      expect(screen.getByText(formatCLP(65000))).toBeInTheDocument();
      expect(screen.getByText('AGENDADO')).toBeInTheDocument();

      const tarjeta = screen.getByRole('button');
      fireEvent.click(tarjeta);
      expect(onEditar).toHaveBeenCalledWith(mockVuelo);

      fireEvent.keyDown(tarjeta, { key: 'Enter' });
      expect(onEditar).toHaveBeenCalledTimes(2);

      fireEvent.keyDown(tarjeta, { key: ' ' });
      expect(onEditar).toHaveBeenCalledTimes(3);
    });

    it('renderiza normalmente sin role button si onEditar no está presente', () => {
      render(<AgendaTarjetaVuelo vuelo={mockVuelo} />);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
      expect(screen.getByText('María González')).toBeInTheDocument();
    });
  });

  describe('AgendaCarril', () => {
    it('renderiza carril simple de piloto con sus vuelos', () => {
      const grupo: GrupoCarril = {
        pilotoId: 1,
        nombre: 'Carlos Piloto',
        vuelos: [mockVuelo],
      };

      render(<AgendaCarril grupo={grupo} />);

      expect(screen.getByText('Carlos Piloto')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument(); // contador
      expect(screen.getByText('María González')).toBeInTheDocument();
    });

    it('renderiza carril agrupado cuando hay múltiples reservas', () => {
      const grupoMulti: GrupoCarril = {
        pilotoId: 1,
        nombre: 'Carlos Piloto',
        vuelos: [
          {
            ...mockVuelo,
            id: 1,
            reservaId: 10,
            reserva: { id: 10, numeroReserva: 'RES-010', estado: 'AGENDADA', estadoPago: 'PENDIENTE', abono: 0, valorTotal: 65000 },
          },
          {
            ...mockVuelo,
            id: 2,
            reservaId: 20,
            pasajero: { nombre: 'Pedro Pascal' },
            reserva: { id: 20, numeroReserva: 'RES-020', estado: 'AGENDADA', estadoPago: 'PENDIENTE', abono: 0, valorTotal: 65000 },
          },
        ],
      };

      render(<AgendaCarril grupo={grupoMulti} />);

      expect(screen.getByText('Reserva #10')).toBeInTheDocument();
      expect(screen.getByText('Reserva #20')).toBeInTheDocument();
      expect(screen.getByText('María González')).toBeInTheDocument();
      expect(screen.getByText('Pedro Pascal')).toBeInTheDocument();
    });
  });

  describe('AgendaEstadoVacio', () => {
    it('muestra estado sin-bloques con su texto y recomendación', () => {
      render(<AgendaEstadoVacio tipo="sin-bloques" />);
      expect(screen.getByText('Sin bloques configurados')).toBeInTheDocument();
      expect(screen.getByText(/Configura horarios para este día/i)).toBeInTheDocument();
    });

    it('muestra estado bloqueado con su texto', () => {
      render(<AgendaEstadoVacio tipo="bloqueado" />);
      expect(screen.getByText('Día bloqueado')).toBeInTheDocument();
      expect(screen.getByText(/No se programaron vuelos para este día/i)).toBeInTheDocument();
    });
  });

  describe('AgendaVuelosFueraBloque', () => {
    it('no renderiza nada si la lista de vuelos está vacía', () => {
      render(
        <AgendaVuelosFueraBloque vuelos={[]} titulo="Fuera de bloques" />
      );
      expect(screen.queryByText('Fuera de bloques')).not.toBeInTheDocument();
    });

    it('renderiza la sección de vuelos fuera de bloque con título y descripción', () => {
      render(
        <AgendaVuelosFueraBloque
          vuelos={[mockVuelo]}
          titulo="Fuera de bloques configurados"
          descripcion="Vuelos en horarios extraordinarios"
        />
      );

      expect(screen.getByText('Fuera de bloques configurados')).toBeInTheDocument();
      expect(screen.getByText('Vuelos en horarios extraordinarios')).toBeInTheDocument();
      expect(screen.getByText('1 vuelo')).toBeInTheDocument();
      expect(screen.getByText('María González')).toBeInTheDocument();
    });
  });

  describe('AgendaBloqueHorario', () => {
    const pilotosDisponibles: PilotoDia[] = [
      { id: 1, nombre: 'Carlos Piloto', activo: true, prioridad: 1, disponibilidadTotal: true, excepciones: [] },
      { id: 2, nombre: 'Ana Piloto', activo: true, prioridad: 2, disponibilidadTotal: true, excepciones: [] },
    ];

    it('muestra botón para agendar cuando el bloque no tiene reservas', () => {
      const onAgendar = vi.fn();

      render(
        <AgendaBloqueHorario
          horario={{ horaInicio: '10:00', horaFin: '12:00' }}
          fecha={new Date(2026, 7, 29)}
          dateKey="2026-08-29"
          vuelos={[]}
          disponibles={pilotosDisponibles}
          onAgendar={onAgendar}
        />
      );

      expect(screen.getByText('10:00 – 12:00')).toBeInTheDocument();
      expect(screen.getByText('0 vuelos')).toBeInTheDocument();
      expect(screen.getByText(/Sin reservas — \+2 pilotos disponibles/i)).toBeInTheDocument();

      const btnAgendar = screen.getByRole('button', { name: /Sin reservas/i });
      fireEvent.click(btnAgendar);
      expect(onAgendar).toHaveBeenCalledWith(new Date(2026, 7, 29), { horaInicio: '10:00', horaFin: '12:00' });
    });

    it('muestra carril y botón fantasma de Libres cuando hay vuelos y pilotos disponibles restantes', () => {
      const onAgendar = vi.fn();
      const onEditar = vi.fn();

      render(
        <AgendaBloqueHorario
          horario={{ horaInicio: '10:00', horaFin: '12:00' }}
          fecha={new Date(2026, 7, 29)}
          dateKey="2026-08-29"
          vuelos={[{ ...mockVuelo, fechaHora: fechaHoraLocalToIso('2026-08-29', '10:15') }]}
          disponibles={pilotosDisponibles}
          onAgendar={onAgendar}
          onEditar={onEditar}
        />
      );

      expect(screen.getByText('1 vuelo')).toBeInTheDocument();
      expect(screen.getByText('María González')).toBeInTheDocument();
      expect(screen.getByText('Libres (+1)')).toBeInTheDocument();

      const btnLibres = screen.getByRole('button', { name: /Libres \(\+1\)/i });
      fireEvent.click(btnLibres);
      expect(onAgendar).toHaveBeenCalled();
    });
  });
});
