/**
 * Suite 07: Rendimiento, SLOs & Latencias Críticas
 * Mide latencias p95 y promedios en endpoints clave del sistema
 * para asegurar cumplimiento del SLO (<250ms en listados paginados).
 */

import {
  createSuiteRunner,
  resolveSuiteConfig,
  createApiClient,
} from '../lib';

export async function runPerformanceSloSuite() {
  const config = resolveSuiteConfig({
    name: '07-Performance-SLO: Latencias, Benchmarking & Límites',
    description: 'Medición de latencias p95 en healthcheck y listados paginados, y cumplimiento de SLOs',
  });

  const runner = createSuiteRunner(config);
  const client = createApiClient(config);

  // Helper para medir latencia
  async function benchmarkEndpoint(
    name: string,
    fn: () => Promise<void>,
    iterations: number = 5,
    maxP95Ms: number = 250
  ): Promise<{ p95: number; avg: number }> {
    const latencies: number[] = [];
    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      await fn();
      latencies.push(Date.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p95Index = Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95));
    const p95 = latencies[p95Index];
    const avg = Math.round(latencies.reduce((acc, v) => acc + v, 0) / latencies.length);

    console.log(`   ⏱️ [BENCH] ${name}: avg=${avg}ms, p95=${p95}ms (muestras: [${latencies.join(', ')}])`);

    if (p95 > maxP95Ms) {
      console.warn(`   ⚠️ Advertencia SLO: p95 (${p95}ms) supera el umbral recomendado de ${maxP95Ms}ms`);
    }

    return { p95, avg };
  }

  // 1. Healthcheck público
  await runner.step('1. Benchmarking de API Health Check (SLO p95 < 150ms)', async () => {
    await benchmarkEndpoint(
      '/api/public/health',
      async () => {
        const res = await client.get('/api/public/health', { skipAuth: true });
        if (!res.ok) throw new Error(`Healthcheck falló con ${res.status}`);
      },
      5,
      150
    );
  });

  // 2. Listado paginado de Pilotos
  await runner.step('2. Benchmarking de Listado de Pilotos (SLO p95 < 250ms)', async () => {
    await benchmarkEndpoint(
      '/api/pilotos?pageSize=50',
      async () => {
        const res = await client.get('/api/pilotos?pageSize=50');
        if (!res.ok) throw new Error(`Listado de pilotos falló con ${res.status}`);
      },
      5,
      250
    );
  });

  // 3. Listado paginado de Reservas
  await runner.step('3. Benchmarking de Listado de Reservas (SLO p95 < 250ms)', async () => {
    await benchmarkEndpoint(
      '/api/reservas?pageSize=50',
      async () => {
        const res = await client.get('/api/reservas?pageSize=50');
        if (!res.ok) throw new Error(`Listado de reservas falló con ${res.status}`);
      },
      5,
      250
    );
  });

  // 4. Listado paginado de Vuelos
  await runner.step('4. Benchmarking de Listado de Vuelos (SLO p95 < 250ms)', async () => {
    await benchmarkEndpoint(
      '/api/vuelos?pageSize=50',
      async () => {
        const res = await client.get('/api/vuelos?pageSize=50');
        if (!res.ok) throw new Error(`Listado de vuelos falló con ${res.status}`);
      },
      5,
      250
    );
  });

  return runner.conclude();
}

// Ejecución directa si se invoca como script
if (process.argv[1]?.endsWith('07-performance-slo.suite.ts')) {
  runPerformanceSloSuite().then((res) => {
    if (!res.ok) process.exit(1);
  });
}
