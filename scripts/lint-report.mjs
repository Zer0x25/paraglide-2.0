#!/usr/bin/env node
/**
 * lint-report.mjs — Baseline reproducible de ESLint de `apps/web`.
 *
 * Ejecuta `eslint . --format json` y agrega los hallazgos por regla y por
 * archivo para medir la deuda de lint antes/durante/después de cada fase de
 * limpieza (ver `docs/plan-calidad-y-refactor.md`).
 *
 * Uso:
 *   npm run lint:report
 *
 * Notas:
 * - No modifica nada: solo lee y reporta. Siempre termina con exit 0 para
 *   que pueda usarse como herramienta de medición en CI/scripts.
 * - ESLint sale con código != 0 cuando hay errores; el JSON igual se emite
 *   por stdout, por eso se captura `err.stdout` en el catch.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const webDir = path.join(root, 'apps', 'web');
const eslintBin = path.join(root, 'node_modules', '.bin', 'eslint');

function runEslintJson() {
  try {
    return execFileSync(eslintBin, ['.', '--format', 'json'], {
      cwd: webDir,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (err) {
    return err.stdout ?? '';
  }
}

function main() {
  const report = JSON.parse(runEslintJson());
  const byRule = new Map(); // ruleId -> { e, w, total }
  const byFile = new Map(); // relPath -> total
  let errors = 0;
  let warnings = 0;

  for (const file of report) {
    if (file.messages.length === 0) continue;
    const rel = file.filePath.startsWith(webDir)
      ? file.filePath.slice(webDir.length + 1)
      : file.filePath;
    byFile.set(rel, (byFile.get(rel) ?? 0) + file.messages.length);

    for (const msg of file.messages) {
      if (msg.severity === 2) errors++;
      else warnings++;

      const key = msg.ruleId ?? '(sin regla)';
      const entry = byRule.get(key) ?? { e: 0, w: 0, total: 0 };
      if (msg.severity === 2) entry.e++;
      else entry.w++;
      entry.total++;
      byRule.set(key, entry);
    }
  }

  const line = '='.repeat(58);
  console.log(`\n${line}`);
  console.log(
    ` BASELINE ESLINT apps/web — ${errors} errores, ${warnings} warnings, ` +
      `${byFile.size} archivos con hallazgos`,
  );
  console.log(line);

  console.log('\n=== POR REGLA ===');
  const rules = [...byRule.entries()].sort((a, b) => b[1].total - a[1].total);
  for (const [rule, s] of rules) {
    const tag = s.e > 0 ? `E${s.e}` : `w${s.w}`;
    console.log(`[${tag}] ${rule.padEnd(48)} ${s.total}`);
  }

  console.log('\n=== TOP 25 ARCHIVOS ===');
  const files = [...byFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);
  for (const [file, total] of files) {
    console.log(String(total).padStart(4) + '\t' + file);
  }
  console.log('');
}

main();
