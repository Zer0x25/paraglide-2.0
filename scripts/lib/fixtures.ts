/**
 * Generadores de fixtures y Registry de Teardown Centralizado para E2E
 * Garantiza limpieza segura mediante soft-delete vía API en bloques finally.
 */

import type { ApiTestClient } from './client';
import type { TeardownRegistry } from './types';

export function getUniqueSuffix(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

export function fechaFuturaIso(diasAdelante: number = 1, hora: string = '10:00'): string {
  const d = new Date();
  d.setDate(d.getDate() + diasAdelante);
  const [hh, mm] = hora.split(':').map(Number);
  d.setHours(hh || 10, mm || 0, 0, 0);
  return d.toISOString();
}

export function crearPilotoFixture(nombreBase: string = 'Piloto E2E', extra?: Record<string, any>) {
  const suffix = getUniqueSuffix();
  return {
    nombre: `${nombreBase} ${suffix}`,
    email: `piloto-${suffix}@parapente.test`,
    telefono: `+569${Math.floor(10000000 + Math.random() * 90000000)}`,
    categoria: 'MASTER',
    prioridad: 1,
    activo: true,
    tieneLicencia: true,
    peso: 75,
    pesoMinimoPasajero: 40,
    pesoMaximoPasajero: 110,
    tarifaPorVuelo: 25000,
    ...(extra || {}),
  };
}

export function crearReservaFixture(
  titularBase: string = 'Titular E2E',
  cantPasajeros: number = 1,
  extra?: Record<string, any>
) {
  const suffix = getUniqueSuffix();
  const pasajeros = Array.from({ length: cantPasajeros }).map((_, i) => ({
    nombre: `Pasajero ${i + 1} (${suffix})`,
    peso: 70 + i * 5,
    telefono: `+569${Math.floor(10000000 + Math.random() * 90000000)}`,
    rutDni: `1${Math.floor(1000000 + Math.random() * 9000000)}-${i + 1}`,
  }));

  const valorUnitario = 60000;
  const valorTotal = valorUnitario * cantPasajeros;

  return {
    nombreTitular: `${titularBase} ${suffix}`,
    email: `titular-${suffix}@cliente.test`,
    telefono: `+569${Math.floor(10000000 + Math.random() * 90000000)}`,
    estadoPago: 'PAGADO',
    valorTotal,
    abono: valorTotal,
    fechaReserva: fechaFuturaIso(2, '11:00'),
    pasajeros,
    ...(extra || {}),
  };
}

export function createTeardownRegistry(apiClient: ApiTestClient): TeardownRegistry {
  const vuelos: number[] = [];
  const reservas: number[] = [];
  const pasajeros: number[] = [];
  const pilotos: number[] = [];
  const customCleanups: Array<() => Promise<void>> = [];

  const registerVuelo = (id: number) => {
    if (!vuelos.includes(id)) vuelos.push(id);
  };

  const registerReserva = (id: number) => {
    if (!reservas.includes(id)) reservas.push(id);
  };

  const registerPasajero = (id: number) => {
    if (!pasajeros.includes(id)) pasajeros.push(id);
  };

  const registerPiloto = (id: number) => {
    if (!pilotos.includes(id)) pilotos.push(id);
  };

  const registerCustom = (cleanupFn: () => Promise<void>) => {
    customCleanups.push(cleanupFn);
  };

  const cleanup = async () => {
    console.log('\n🧹 [TEARDOWN] Iniciando limpieza de entidades creadas en prueba...');

    // 1. Vuelos primero
    for (const vId of vuelos) {
      try {
        await apiClient.delete(`/api/vuelos/${vId}`);
      } catch (err: any) {
        console.warn(`   ⚠️ [TEARDOWN] No se pudo borrar vuelo ${vId}: ${err?.message || err}`);
      }
    }

    // 2. Reservas
    for (const rId of reservas) {
      try {
        // Intentar reabrir primero si la reserva fue cerrada contablemente durante el test
        await apiClient.post(`/api/reservas/${rId}/reabrir`, { motivo: 'Limpieza Teardown E2E' }).catch(() => {});
        await apiClient.delete(`/api/reservas/${rId}`);
      } catch (err: any) {
        console.warn(`   ⚠️ [TEARDOWN] No se pudo borrar reserva ${rId}: ${err?.message || err}`);
      }
    }

    // 3. Pilotos
    for (const pId of pilotos) {
      try {
        await apiClient.delete(`/api/pilotos/${pId}`);
      } catch (err: any) {
        console.warn(`   ⚠️ [TEARDOWN] No se pudo borrar piloto ${pId}: ${err?.message || err}`);
      }
    }

    // 4. Custom cleanups
    for (const fn of customCleanups) {
      try {
        await fn();
      } catch (err: any) {
        console.warn(`   ⚠️ [TEARDOWN] Falló limpieza personalizada: ${err?.message || err}`);
      }
    }

    console.log('✅ [TEARDOWN] Limpieza finalizada.');
  };

  return {
    registerVuelo,
    registerReserva,
    registerPasajero,
    registerPiloto,
    registerCustom,
    cleanup,
  };
}
