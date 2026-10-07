import { resetDatabase, createAdminUser } from './devTools/devTools.reset';
import { simulateData } from './devTools/devTools.simulator';

export class DevToolsService {
  async resetDb() {
    return resetDatabase();
  }

  async createAdmin() {
    return createAdminUser();
  }

  async simulate(params: { months: number; flightsPerDay: number; pilotsCount?: number }) {
    return simulateData(params);
  }
}

export const devToolsService = new DevToolsService();