import type { ReservaConPasajeros, PasajeroConVuelos, VueloConPiloto } from '@/types/reservaDetalle';

export interface ReservaCardState {
  totalPasajeros: number;
  pasajerosCompletados: PasajeroConVuelos[];
  pasajerosActivos: PasajeroConVuelos[];
  pasajerosAgendados: number;
  estaTotalmenteAgendado: boolean;
  estaParcialmenteAgendado: boolean;
  todosDeslindesFirmados: boolean;
  saldoPendiente: number;
  estadoReserva: string;
  estaSinAgendar: boolean;
  esTerminal: boolean;
  esCerrada: boolean;
  esInmutable: boolean;
  esEditable: boolean;
  puedeEliminarPorPago: boolean;
  esEliminable: boolean;
  motivoNoEliminable: string;
  puedeVerVoucher: boolean;
  todosVolaron: boolean;
  badgeEstado: 'CANCELADA' | 'COMPLETADA' | null;
}

/**
 * Calcula todas las banderas y reglas de negocio derivadas de una reserva
 * para su representación en la tarjeta visual (ReservaCard).
 */
export function calcularEstadoReservaCard(reserva: ReservaConPasajeros): ReservaCardState {
  const totalPasajeros = reserva.pasajeros?.length || 0;
  const pasajerosCompletados =
    reserva.pasajeros?.filter((p: PasajeroConVuelos) =>
      p.vuelos?.some((v: VueloConPiloto) => v.estado === 'COMPLETADO')
    ) || [];
  const pasajerosActivos =
    reserva.pasajeros?.filter(
      (p: PasajeroConVuelos) => !p.vuelos?.some((v: VueloConPiloto) => v.estado === 'COMPLETADO')
    ) || [];

  const pasajerosAgendados =
    reserva.pasajeros?.filter(
      (p: PasajeroConVuelos) =>
        p.vuelos &&
        p.vuelos.length > 0 &&
        !p.vuelos.some((v: VueloConPiloto) => v.estado === 'COMPLETADO')
    ).length || 0;

  const estaTotalmenteAgendado =
    pasajerosActivos.length > 0 && pasajerosAgendados === pasajerosActivos.length;
  const estaParcialmenteAgendado =
    pasajerosAgendados > 0 && pasajerosAgendados < pasajerosActivos.length;
  const todosDeslindesFirmados =
    totalPasajeros > 0 && reserva.pasajeros?.every((p: PasajeroConVuelos) => p.firmaDeslinde);
  const saldoPendiente = Math.max(0, (reserva.valorTotal || 0) - (reserva.abono || 0));

  const estadoReserva = reserva.estado ?? 'SIN_AGENDAR';
  const estaSinAgendar = estadoReserva === 'SIN_AGENDAR';
  const esTerminal = estadoReserva === 'CANCELADA' || estadoReserva === 'COMPLETADA';
  const esCerrada = Boolean(reserva.cerradaAt);
  const esInmutable = esTerminal || esCerrada;
  const esEditable = !esInmutable;

  // Eliminar: solo en SIN_AGENDAR + no inmutable + con pagos (ABONADO/PAGADO) bloqueado hasta devolución
  // Agendadas deben desagendarse primero — no se ofrece eliminar directo
  const puedeEliminarPorPago =
    reserva.estadoPago !== 'PAGADO' && reserva.estadoPago !== 'ABONADO';
  const esEliminable = estaSinAgendar && !esInmutable && puedeEliminarPorPago;
  const motivoNoEliminable = esCerrada
    ? 'Esta reserva está cerrada contablemente bajo snapshot histórico inmutable.'
    : esTerminal
      ? 'No se puede eliminar una reserva cancelada o completada.'
      : !estaSinAgendar
        ? 'Para eliminar una reserva agendada, primero desagéndala.'
        : !puedeEliminarPorPago
          ? 'Tiene pagos registrados — elimina los abonos en Pagos (o registra una devolución) para poder eliminar.'
          : '';
  const puedeVerVoucher = estadoReserva !== 'SIN_AGENDAR';

  const todosVolaron = pasajerosCompletados.length > 0 && pasajerosActivos.length === 0;
  const badgeEstado: 'CANCELADA' | 'COMPLETADA' | null =
    estadoReserva === 'CANCELADA'
      ? 'CANCELADA'
      : estadoReserva === 'COMPLETADA' || todosVolaron
        ? 'COMPLETADA'
        : null;

  return {
    totalPasajeros,
    pasajerosCompletados,
    pasajerosActivos,
    pasajerosAgendados,
    estaTotalmenteAgendado,
    estaParcialmenteAgendado,
    todosDeslindesFirmados: Boolean(todosDeslindesFirmados),
    saldoPendiente,
    estadoReserva,
    estaSinAgendar,
    esTerminal,
    esCerrada,
    esInmutable,
    esEditable,
    puedeEliminarPorPago,
    esEliminable,
    motivoNoEliminable,
    puedeVerVoucher,
    todosVolaron,
    badgeEstado,
  };
}
