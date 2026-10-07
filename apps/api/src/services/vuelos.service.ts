import { CreateVueloPayload } from '@parapente/shared';
import { ListQuery } from './pagination.util';
import { PilotoOrden, ordenarPilotosParaAsignacion, validateWeightAndConflict, autoAssignVuelos } from './vuelos/vuelos.matching';
import { getAllVuelos, createVuelo, updateVuelo } from './vuelos/vuelos.crud';
import { agendarGrupoVuelos, updateEstadoVuelo, deleteVuelo } from './vuelos/vuelos.lifecycle';

export { ordenarPilotosParaAsignacion };
export type { PilotoOrden };

export class VuelosService {
  async getAll(opts: ListQuery & { desde?: string; hasta?: string; estado?: string; sort?: string; campos?: string } = {}) {
    return getAllVuelos(opts);
  }

  async validateWeightAndConflict(pilotoId: number, pasajeroId: number, fechaHora: string, excludeVueloId?: number) {
    return validateWeightAndConflict(pilotoId, pasajeroId, fechaHora, excludeVueloId);
  }

  async create(data: CreateVueloPayload) {
    return createVuelo(data);
  }

  async update(id: number, data: CreateVueloPayload & { version?: number }) {
    return updateVuelo(id, data);
  }

  async autoAssign(fechaHora: string, pasajeros: { id: number; peso: number }[]) {
    return autoAssignVuelos(fechaHora, pasajeros);
  }

  async agendarGrupo(data: {
    reservaId: number;
    fechaHora: string;
    asignaciones?: Record<number, number>;
    valorPactadoPorPasajero?: number;
    version?: number;
  }) {
    return agendarGrupoVuelos(data);
  }

  async updateEstado(id: number, estado: string, version?: number) {
    return updateEstadoVuelo(id, estado, version);
  }

  async delete(id: number) {
    return deleteVuelo(id);
  }
}

export const vuelosService = new VuelosService();
