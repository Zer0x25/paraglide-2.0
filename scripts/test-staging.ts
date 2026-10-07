#!/usr/bin/env tsx
/**
 * CLI Maestro Unificado de Testing E2E para Staging y Producción
 * 
 * Uso:
 *   npx tsx scripts/test-staging.ts [opciones]
 * 
 * Opciones:
 *   --all                 Ejecuta todas las suites (01 a 07)
 *   --suite=<id|nombre>   Ejecuta una o varias suites separadas por coma (ej: --suite=01,02 o --suite=smoke,concurrency)
 *   --wait                Espera activa a que el deploy coincida con el commit local antes de correr
 *   --prod                Apunta a producción (https://parapente.zer0x.org) en lugar de Staging local
 *   --headless=false      Abre el navegador visible para depuración interactiva
 *   --help                Muestra esta ayuda
 * 
 * Ejemplos:
 *   npm run test:staging              (Corre todas las suites contra Staging http://localhost:3200)
 *   npm run test:staging:quick        (Corre suites 01-smoke y 02-core-lifecycle)
 *   npm run test:staging:stress       (Corre suite 05-concurrency-stress)
 */

import { runSmokeSuite } from './suites/01-smoke.suite';
import { runCoreLifecycleSuite } from './suites/02-core-lifecycle.suite';
import { runPublicClientSuite } from './suites/03-public-client.suite';
import { runModulesAdminSuite } from './suites/04-modules-admin.suite';
import { runConcurrencyStressSuite } from './suites/05-concurrency-stress.suite';
import { runIntegrationsSecuritySuite } from './suites/06-integrations-security.suite';
import { runPerformanceSloSuite } from './suites/07-performance-slo.suite';
import type { SuiteResult } from './lib/types';

interface SuiteDefinition {
  id: string;
  aliases: string[];
  name: string;
  run: () => Promise<SuiteResult>;
}

const SUITES: SuiteDefinition[] = [
  { id: '01', aliases: ['smoke', 'sanity'], name: '01-Smoke', run: runSmokeSuite },
  { id: '02', aliases: ['lifecycle', 'core'], name: '02-Core-Lifecycle', run: runCoreLifecycleSuite },
  { id: '03', aliases: ['public', 'client', 'voucher'], name: '03-Public-Client', run: runPublicClientSuite },
  { id: '04', aliases: ['admin', 'modules', 'rbac'], name: '04-Modules-Admin', run: runModulesAdminSuite },
  { id: '05', aliases: ['concurrency', 'stress', 'reagenda'], name: '05-Concurrency-Stress', run: runConcurrencyStressSuite },
  { id: '06', aliases: ['integrations', 'ical', 'mcp'], name: '06-Integrations-Security', run: runIntegrationsSecuritySuite },
  { id: '07', aliases: ['performance', 'slo', 'bench'], name: '07-Performance-SLO', run: runPerformanceSloSuite },
];

function printHelp() {
  console.log(`
CLI Maestro de Testing E2E — Paraglide

Uso:
  npx tsx scripts/test-staging.ts [opciones]

Suites Disponibles:
  01, smoke          Smoke & Sanity (healthcheck, commit, login, auth)
  02, lifecycle      Core Lifecycle (reserva -> agendamiento -> deslinde -> cuadratura)
  03, public         Experiencia Pública (voucher QR, firma canvas, TV FIDS, offline)
  04, admin          Módulos Premium & RBAC (equipos, plantillas, meteo, auditoría, 403)
  05, concurrency    Concurrencia & Estrés (carrera calendario, 409, límites 115kg, outbox)
  06, integrations   Integraciones (iCal RFC 5545, agente IA/MCP, cabeceras HTTP)
  07, performance    Rendimiento & Benchmarking (latencias p95, SLO <250ms)

Opciones:
  --all              Ejecuta todas las suites en secuencia ordenada
  --suite=<ids>      Lista de suites a ejecutar separadas por coma (ej: --suite=01,05)
  --wait             Espera activa a que el deploy coincida con el commit local
  --prod             Apunta a https://parapente.zer0x.org
  --headless=false   Abre el navegador visible
  --help             Muestra esta información
`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  if (args.includes('--prod')) {
    process.env.PROD_URL = 'https://parapente.zer0x.org';
  } else if (!process.env.PROD_URL) {
    process.env.PROD_URL = 'http://localhost:3200';
  }

  // Parsear suites a ejecutar
  let selectedSuites: SuiteDefinition[] = [];

  const suiteArg = args.find((a) => a.startsWith('--suite='));
  if (suiteArg) {
    const requested = suiteArg.replace('--suite=', '').split(',').map((s) => s.trim().toLowerCase());
    selectedSuites = SUITES.filter(
      (s) => requested.includes(s.id) || s.aliases.some((alias) => requested.includes(alias))
    );
  } else if (args.includes('--all') || args.length === 0) {
    selectedSuites = SUITES;
  } else {
    // Si pasaron argumentos posicionales como "smoke" o "01"
    const positional = args.filter((a) => !a.startsWith('--')).map((s) => s.trim().toLowerCase());
    if (positional.length > 0) {
      selectedSuites = SUITES.filter(
        (s) => positional.includes(s.id) || s.aliases.some((alias) => positional.includes(alias))
      );
    } else {
      selectedSuites = SUITES;
    }
  }

  if (selectedSuites.length === 0) {
    console.error('❌ No se seleccionaron suites válidas.');
    printHelp();
    process.exit(1);
  }

  console.log(`\n🎯 Plan de Ejecución: ${selectedSuites.map((s) => s.name).join(', ')}`);
  console.log(`🌐 Entorno Destino:   ${process.env.PROD_URL}\n`);

  const results: SuiteResult[] = [];
  const startGlobal = Date.now();

  for (const suite of selectedSuites) {
    try {
      const result = await suite.run();
      results.push(result);
      if (!result.ok) {
        console.error(`\n⚠️ Suite ${suite.name} falló. Continuando con las restantes...`);
      }
    } catch (err: any) {
      console.error(`\n❌ Error fatal ejecutando suite ${suite.name}:`, err?.message || err);
      results.push({
        suiteName: suite.name,
        totalSteps: 1,
        passedSteps: 0,
        failedSteps: 1,
        durationMs: 0,
        steps: [{ name: 'Ejecución Suite', ok: false, durationMs: 0, error: String(err) }],
        ok: false,
      });
    }
  }

  const durationTotal = Math.round((Date.now() - startGlobal) / 1000);
  const totalSuites = results.length;
  const passedSuites = results.filter((r) => r.ok).length;
  const failedSuites = results.filter((r) => !r.ok).length;

  console.log('\n' + '█'.repeat(80));
  console.log(`🏁 INFORME GLOBAL DE EJECUCIÓN (${durationTotal}s)`);
  console.log('█'.repeat(80));

  for (const r of results) {
    const icon = r.ok ? '✅' : '❌';
    const statusText = r.ok ? 'PASÓ' : 'FALLÓ';
    console.log(`${icon} [${statusText}] ${r.suiteName.padEnd(35)} (${r.passedSteps}/${r.totalSteps} steps en ${Math.round(r.durationMs / 1000)}s)`);
  }

  console.log('─'.repeat(80));
  console.log(`Resumen: ${passedSuites}/${totalSuites} suites aprobadas (${failedSuites} fallidas).`);
  console.log('█'.repeat(80) + '\n');

  if (failedSuites > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Error no controlado en CLI:', err);
  process.exit(1);
});
