import { describe, it, expect } from 'vitest';
import { calcularEstadoReservaCard } from '../reservaCardState';
import type { ReservaConPasajeros } from '@/types/reservaDetalle';

describe('calcularEstadoReservaCard', () => {
  const baseReserva = {
    id: 1,
    numeroReserva: 'RES-001',
    nombreTitular: 'Juan Perez',
    telefono: '+56912345678',
    email: 'juan@test.com',
    valorTotal: 100000,
    abono: 50000,
    estadoPago: 'ABONADO',
    estado: 'SIN_AGENDAR',
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    pasajeros: [
      {
        id: 10,
        nombre: 'Pasajero 1',
        rutDni: '11111111-1',
        peso: 75,
        firmaDeslinde: true,
        vuelos: [],
      },
    ],
  } as unknown as ReservaConPasajeros;

  it('identifica correctamente una reserva sin agendar con abono (no eliminable por pago)', () => {
    const state = calcularEstadoReservaCard(baseReserva);

    expect(state.estaSinAgendar).toBe(true);
    expect(state.esInmutable).toBe(false);
    expect(state.puedeEliminarPorPago).toBe(false);
    expect(state.esEliminable).toBe(false);
    expect(state.saldoPendiente).toBe(50000);
    expect(state.todosDeslindesFirmados).toBe(true);
    expect(state.badgeEstado).toBeNull();
  });

  it('permite eliminar una reserva sin agendar si el estadoPago es PENDIENTE', () => {
    const reserva = {
      ...baseReserva,
      abono: 0,
      estadoPago: 'PENDIENTE' as const,
    };
    const state = calcularEstadoReservaCard(reserva);

    expect(state.puedeEliminarPorPago).toBe(true);
    expect(state.esEliminable).toBe(true);
    expect(state.saldoPendiente).toBe(100000);
  });

  it('marca como inmutable si la reserva está cerrada contablemente', () => {
    const reserva = {
      ...baseReserva,
      cerradaAt: new Date('2026-09-01'),
    };
    const state = calcularEstadoReservaCard(reserva);

    expect(state.esCerrada).toBe(true);
    expect(state.esInmutable).toBe(true);
    expect(state.esEditable).toBe(false);
    expect(state.esEliminable).toBe(false);
    expect(state.motivoNoEliminable).toContain('cerrada contablemente');
  });

  it('deriva estado COMPLETADA cuando todos los pasajeros volaron', () => {
    const reserva = {
      ...baseReserva,
      estado: 'AGENDADA',
      pasajeros: [
        {
          id: 10,
          nombre: 'Pasajero 1',
          firmaDeslinde: true,
          vuelos: [
            {
              id: 201,
              estado: 'COMPLETADO',
              fechaHora: new Date(),
            },
          ],
        },
      ],
    } as unknown as ReservaConPasajeros;
    const state = calcularEstadoReservaCard(reserva);

    expect(state.todosVolaron).toBe(true);
    expect(state.badgeEstado).toBe('COMPLETADA');
    expect(state.estaTotalmenteAgendado).toBe(false);
    expect(state.pasajerosCompletados).toHaveLength(1);
    expect(state.pasajerosActivos).toHaveLength(0);
  });

  it('deriva estado Parcialmente Agendado si solo algunos pasajeros tienen vuelo activo', () => {
    const reserva = {
      ...baseReserva,
      estado: 'AGENDADA',
      pasajeros: [
        {
          id: 10,
          nombre: 'Pasajero 1',
          firmaDeslinde: true,
          vuelos: [{ id: 201, estado: 'AGENDADO', fechaHora: new Date() }],
        },
        {
          id: 11,
          nombre: 'Pasajero 2',
          firmaDeslinde: false,
          vuelos: [],
        },
      ],
    } as unknown as ReservaConPasajeros;
    const state = calcularEstadoReservaCard(reserva);

    expect(state.estaTotalmenteAgendado).toBe(false);
    expect(state.estaParcialmenteAgendado).toBe(true);
    expect(state.pasajerosAgendados).toBe(1);
    expect(state.todosDeslindesFirmados).toBe(false);
  });
});
