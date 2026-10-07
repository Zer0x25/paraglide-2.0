#!/usr/bin/env node
/**
 * format.mjs — Prettier con alcance incremental (solo lo que Git ve cambiado).
 *
 * Adoptación incremental: formatear el repo completo produciría cientos de
 * archivos de ruido que entierran los cambios reales en el diff. Este script
 * limita el formateo a los archivos que difieren contra `baseRef`, de modo que
 * el diff de cada commit sigue siendo legible y revisable.
 *
 * Uso:
 *   npm run format                     # formatea lo modificado contra HEAD
 *   npm run format -- apps/web/src     # acota a rutas específicas
 *   npm run format:check               # verifica sin escribir (para CI/gates)
 *
 * Variables de entorno:
 *   FORMAT_BASE   ref de comparación (default: HEAD)
 *   FORMAT_STAGED usar solo el staging area en vez del diff de trabajo
 *
 * Notas:
 * - `format:check` sale con código != 0 si algún archivo necesita formato, lo
 *   que lo hace utilizable como gate objetivo dentro de check:quick.
 * - Los artefactos generados (.next, dist, prisma client) se excluyen siempre:
 *   se formatean en su origen, no en el consumidor.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const prettierBin = path.join(root, 'node_modules', '.bin', 'prettier');

const IGNORED_DIRS = ['.next', 'dist', 'out', 'build', 'node_modules', 'coverage'];

/**
 * Extensiones que Prettier sabe formatear; el resto del árbol se ignora.
 *
 * `.md` queda deliberadamente fuera: Prettier realinea las tablas markdown
 * (padding de columnas) e inserta líneas en blanco, así que tocar un solo
 * caracter en una fila reescribe la tabla entera. En un repo donde la
 * documentación vive en AGENTS.md, los .agent.md y las SKILL.md —que son
 * justamente lo que el agente lee para trabajar— eso convierte cada edición
 * en un diff ilegible sin ningún valor de formato real.
 */
const FORMATABLE_EXT = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.mjs',
  '.cjs',
  '.jsx',
  '.json',
  '.yml',
  '.yaml',
  '.css',
  '.prisma',
]);

function git(args, allowFail = false) {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  } catch (err) {
    if (allowFail) return '';
    throw new Error(`git ${args.join(' ')} falló: ${err.message}`);
  }
}

/** True si la ruta es un archivo que debe formatearse. */
function isFormatable(file) {
  if (IGNORED_DIRS.some((dir) => file.split('/').includes(dir))) return false;
  if (file.includes('package-lock.json')) return false;
  return FORMATABLE_EXT.has(path.extname(file));
}

/**
 * Archivos con cambios en el árbol de trabajo frente a `baseRef`.
 *
 * Se combinan dos fuentes porque `git diff` NO ve los archivos untracked:
 *   - modificados/nuevos en staging (--cached)
 *   - modificados sin stagear (vs baseRef)
 *   - archivos nunca trackeados (--others --exclude-standard)
 *
 * La tercera fuente es la más importante para el agente: un archivo recién
 * creado es untracked hasta el primer `git add`, así que un scope basado solo
 * en `git diff` nunca lo formatearía.
 */
function changedFiles(baseRef) {
  const sources = [
    ['diff', '--cached', '--name-only', '--diff-filter=ACMR'],
    ['diff', '--name-only', '--diff-filter=ACMR', baseRef],
    ['ls-files', '--others', '--exclude-standard'],
  ];

  const seen = new Set();
  const files = [];
  for (const args of sources) {
    const out = git(args, true);
    if (!out) continue;
    for (const line of out.split('\n')) {
      const file = line.trim();
      if (!file || seen.has(file) || !isFormatable(file)) continue;
      seen.add(file);
      files.push(file);
    }
  }
  return files;
}

/** Archivos en el staging area (para `FORMAT_STAGED=1`). */
function stagedFiles() {
  const staged = git(['diff', '--cached', '--name-only', '--diff-filter=ACMR'], true);
  return staged
    ? staged
        .split('\n')
        .map((f) => f.trim())
        .filter(isFormatable)
    : [];
}

/** Rutas relativas dadas explícitamente como argumentos. */
function resolveTargets(argv) {
  const explicit = argv.filter((a) => !a.startsWith('-'));
  if (explicit.length === 0) return null;

  const expanded = [];
  for (const arg of explicit) {
    const abs = path.resolve(root, arg);
    if (!existsSync(abs)) {
      throw new Error(`ruta no existe: ${arg}`);
    }
    expanded.push(abs);
  }
  return expanded;
}

function main() {
  const argv = process.argv.slice(2);
  const check = argv.includes('--check');
  const explicit = resolveTargets(argv);
  const useStaged = process.env.FORMAT_STAGED === '1' || argv.includes('--staged');

  const baseRef = process.env.FORMAT_BASE ?? 'HEAD';

  let files;
  let scope;
  if (explicit) {
    files = explicit;
    scope = explicit.join(', ');
  } else if (useStaged) {
    files = stagedFiles();
    scope = 'staging area';
  } else {
    files = changedFiles(baseRef);
    scope = `cambios vs ${baseRef}`;
  }

  if (files.length === 0) {
    console.log(`[format] sin archivos que formatear (${scope}).`);
    return;
  }

  const args = [...files, ...(check ? ['--check'] : ['--write'])];
  console.log(
    `[format] ${check ? 'verificando' : 'formateando'} ${files.length} archivo(s) (${scope})…`,
  );

  try {
    const out = execFileSync(prettierBin, args, { cwd: root, encoding: 'utf8', stdio: 'pipe' });
    if (out.trim()) console.log(out.trim());
  } catch (err) {
    // Prettier reporta los `[warn]` en stderr y sale con status 1. Hay que
    // reemitir stderr para que el gate muestre qué archivo falló, y devolver
    // su exit code para que CI/scripts puedan abortar.
    const out = `${err.stdout ?? ''}`.trim();
    const errOut = `${err.stderr ?? ''}`.trim();
    if (out) console.error(out);
    if (errOut) console.error(errOut);
    process.exit(err.status ?? 1);
  }

  if (check) console.log('[format] OK — todos los archivos cumplen el formato.');
}

main();
