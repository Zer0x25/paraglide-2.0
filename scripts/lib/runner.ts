/**
 * Runner tipado y estandarizado para suites E2E (Staging y Prod)
 */

import { execSync } from 'child_process';
import type { SuiteConfig, StepResult, SuiteResult } from './types';

export function getLocalCommit(): string | null {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return null;
  }
}

export function resolveSuiteConfig(overrides?: Partial<SuiteConfig>): SuiteConfig {
  const targetUrl = (
    process.env.PROD_URL ||
    overrides?.targetUrl ||
    'http://localhost:3200'
  ).replace(/\/$/, '');

  const shouldWait =
    process.argv.includes('--wait') ||
    process.env.WAIT_FOR_DEPLOY === 'true' ||
    Boolean(overrides?.waitForDeploy);

  const localCommit = getLocalCommit();
  const expectedCommit =
    process.env.EXPECTED_COMMIT ||
    overrides?.expectedCommit ||
    (shouldWait ? localCommit : null);

  return {
    name: overrides?.name || 'E2E Suite',
    description: overrides?.description,
    targetUrl,
    adminEmail: process.env.ADMIN_EMAIL || overrides?.adminEmail || 'admin@parapente.com',
    adminPassword: process.env.ADMIN_PASSWORD || overrides?.adminPassword || 'admin123',
    headless: process.env.HEADLESS !== 'false' && (overrides?.headless !== false),
    timeoutMs: overrides?.timeoutMs || 30000,
    waitForDeploy: shouldWait,
    expectedCommit,
  };
}

export async function waitForDeployment(
  targetUrl: string,
  expectedCommit?: string | null,
  maxWaitMs: number = 300000
): Promise<boolean> {
  if (!expectedCommit) {
    console.log(`ℹ️ [DEPLOY] Sin verificación de commit. Continuando directamente.`);
    return true;
  }

  console.log(`\n⏳ [DEPLOY] Esperando que ${targetUrl} responda con el commit "${expectedCommit}"...`);
  const startTime = Date.now();
  const healthUrl = `${targetUrl}/api/public/health`;

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const res = await fetch(healthUrl, { cache: 'no-store' });
      if (res.ok) {
        const body = (await res.json().catch(() => ({}))) as { commit?: string; gitCommit?: string };
        const remoteCommit = body.commit || body.gitCommit;
        if (remoteCommit && remoteCommit.startsWith(expectedCommit)) {
          console.log(`✅ [DEPLOY] Despliegue listo con commit ${remoteCommit} (${Math.round((Date.now() - startTime) / 1000)}s)`);
          return true;
        }
        console.log(`   [DEPLOY] Commit remoto actual: "${remoteCommit || 'desconocido'}" (esperando "${expectedCommit}")...`);
      }
    } catch {
      console.log(`   [DEPLOY] Servidor aún no responde en ${healthUrl}...`);
    }

    await new Promise((r) => setTimeout(r, 4000));
  }

  console.warn(`⚠️ [DEPLOY] Timeout esperando el commit "${expectedCommit}". Continuando bajo propio riesgo.`);
  return false;
}

export function createSuiteRunner(config: SuiteConfig) {
  const steps: StepResult[] = [];
  const suiteStartTime = Date.now();

  console.log('╔════════════════════════════════════════════════════════════════════════════════╗');
  console.log(`║ 🚀 SUITE: ${config.name.padEnd(68)} ║`);
  if (config.description) {
    console.log(`║ 📋 ${config.description.slice(0, 72).padEnd(72)} ║`);
  }
  console.log(`║ 🌐 Target: ${config.targetUrl.padEnd(67)} ║`);
  console.log(`║ 👤 User:   ${config.adminEmail.padEnd(67)} ║`);
  console.log('╚════════════════════════════════════════════════════════════════════════════════╝');

  async function step(name: string, fn: () => Promise<void>): Promise<void> {
    const start = Date.now();
    console.log(`\n⏳ [STEP] ${name}...`);
    try {
      await fn();
      const durationMs = Date.now() - start;
      steps.push({ name, ok: true, durationMs });
      console.log(`✅ [PASS] ${name} (${durationMs}ms)`);
    } catch (err: any) {
      const durationMs = Date.now() - start;
      const errorMsg = err?.message || String(err);
      steps.push({ name, ok: false, durationMs, error: errorMsg });
      console.error(`❌ [FAIL] ${name} (${durationMs}ms): ${errorMsg}`);
      throw err;
    }
  }

  function conclude(): SuiteResult {
    const suiteDurationMs = Date.now() - suiteStartTime;
    const passed = steps.filter((s) => s.ok).length;
    const failed = steps.filter((s) => !s.ok).length;
    const allOk = failed === 0;

    console.log('\n' + '═'.repeat(80));
    console.log(`📊 RESUMEN FINAL: ${config.name}`);
    console.log('═'.repeat(80));

    for (const s of steps) {
      const icon = s.ok ? '✅' : '❌';
      const time = `${s.durationMs}ms`.padStart(8);
      console.log(`${icon} [${time}] ${s.name}`);
      if (!s.ok && s.error) {
        console.log(`   └─ Error: ${s.error}`);
      }
    }

    console.log('─'.repeat(80));
    console.log(`Total: ${steps.length} | Aprobados: ${passed} | Fallidos: ${failed} | Duración: ${Math.round(suiteDurationMs / 1000)}s`);
    console.log('═'.repeat(80));

    if (!allOk) {
      console.error(`\n🚨 La suite "${config.name}" FINALIZÓ CON FALLOS.`);
    } else {
      console.log(`\n🎉 La suite "${config.name}" FINALIZÓ CON ÉXITO (100% OK).`);
    }

    return {
      suiteName: config.name,
      totalSteps: steps.length,
      passedSteps: passed,
      failedSteps: failed,
      durationMs: suiteDurationMs,
      steps,
      ok: allOk,
    };
  }

  return {
    config,
    step,
    conclude,
  };
}
