import {
  CreateReservaPayload,
  UpdateReservaPayload,
  EstadoPasajero,
  PasajeroDTO,
  CreatePagoPayload,
  CreateDevolucionPayload,
  CancelarReservaPayload,
} from '@parapente/shared';
import { ListQuery } from './pagination.util';
import { calcularValor } from './reservas/reservas.precios';
import { getAllReservas, getReservaById } from './reservas/reservas.query';
import { createReserva, updateReserva } from './reservas/reservas.crud';
import {
  addPagoReserva,
  deletePagoReserva,
  addDevolucionReserva,
  deleteDevolucionReserva,
} from './reservas/reservas.pagos';
import {
  actualizarEstadoPasajerosReserva,
  cancelarReserva,
  deleteReserva,
  desagendarReserva,
  cerrarReservaContable,
  reabrirReservaContable,
} from './reservas/reservas.ciclo-vida';

export { calcularValor };

export class ReservasService {
  async getAll(opts: ListQuery & { q?: string; estado?: string; desde?: string; hasta?: string; sort?: string } = {}) {
    return getAllReservas(opts);
  }

  async create(data: CreateReservaPayload) {
    return createReserva(data);
  }

  async update(id: number, data: UpdateReservaPayload & { pasajeros?: Partial<PasajeroDTO>[] }) {
    return updateReserva(id, data);
  }

  async getById(id: number) {
    return getReservaById(id);
  }

  async addPago(reservaId: number, data: CreatePagoPayload & { version?: number }) {
    return addPagoReserva(reservaId, data);
  }

  async deletePago(reservaId: number, pagoId: number, version?: number) {
    return deletePagoReserva(reservaId, pagoId, version);
  }

  async addDevolucion(reservaId: number, data: CreateDevolucionPayload & { version?: number }) {
    return addDevolucionReserva(reservaId, data);
  }

  async deleteDevolucion(reservaId: number, devolucionId: number, version?: number) {
    return deleteDevolucionReserva(reservaId, devolucionId, version);
  }

  async actualizarEstadoPasajeros(reservaId: number, data: { version?: number; pasajeros: { id: number; estado: EstadoPasajero }[] }) {
    return actualizarEstadoPasajerosReserva(reservaId, data);
  }

  async cancelar(id: number, data: CancelarReservaPayload) {
    return cancelarReserva(id, data);
  }

  async desagendar(id: number, data?: { version?: number }) {
    return desagendarReserva(id, data);
  }

  async delete(id: number) {
    return deleteReserva(id);
  }

  async cerrarContable(id: number, version?: number) {
    return cerrarReservaContable(id, version);
  }

  async reabrirContable(id: number, motivo: string, version?: number) {
    return reabrirReservaContable(id, motivo, version);
  }
}

export const reservasService = new ReservasService();
