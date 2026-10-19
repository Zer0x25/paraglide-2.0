import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateTag } from './candidate.mjs';

const packages = [
  'package.json',
  'apps/api/package.json',
  'apps/web/package.json',
  'packages/shared/package.json',
];
const manifestPath = '.release-please-manifest.json';
const releaseFiles = new Set([...packages, 'package-lock.json', manifestPath, 'CHANGELOG.md']);
const shaPattern = /^[a-f0-9]{40}$/;

function git(args, cwd = process.cwd()) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trimEnd();
}

function jsonAt(ref, path, cwd) {
  return JSON.parse(git(['show', `${ref}:${path}`], cwd));
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  return value;
}

function normalizeVersion(value) {
  if (typeof value?.version === 'string') value.version = '<release-version>';
}

// Ignore only release versions and documentation. Scripts, workflows, dependency
// versions/integrities, file modes and all other tracked contents remain significant.
export function codeFingerprint(ref = 'HEAD', cwd = process.cwd(), normalizeRelease = true) {
  const commit = git(['rev-parse', '--verify', `${ref}^{commit}`], cwd);
  const entries = git(['ls-tree', '-rz', '--full-tree', commit], cwd).split('\0').filter(Boolean);
  const hash = createHash('sha256');
  for (const entry of entries) {
    const tab = entry.indexOf('\t');
    const [mode, type, oid] = entry.slice(0, tab).split(' ');
    const path = entry.slice(tab + 1);
    if (path.endsWith('.md')) continue;
    let contents = oid;
    if (packages.includes(path) || path === 'package-lock.json' || path === manifestPath) {
      const value = jsonAt(commit, path, cwd);
      if (normalizeRelease) {
        if (path === manifestPath) {
          if (typeof value['.'] === 'string') value['.'] = '<release-version>';
        } else {
          normalizeVersion(value);
          // Release Please's node updater changes the root lock entry only. Keep
          // every workspace/dependency entry intact, including its version.
          if (path === 'package-lock.json') normalizeVersion(value.packages?.['']);
        }
      }
      contents = JSON.stringify(canonical(value));
    }
    hash.update(JSON.stringify([mode, type, path, contents]));
  }
  return hash.digest('hex');
}

function validateReleaseVersions(ref, cwd) {
  const version = jsonAt(ref, 'package.json', cwd).version;
  validateTag(`v${version}`);
  const lock = jsonAt(ref, 'package-lock.json', cwd);
  const manifest = jsonAt(ref, manifestPath, cwd);
  const versions = [
    ...packages.map((path) => jsonAt(ref, path, cwd).version),
    lock.version,
    lock.packages?.['']?.version,
    manifest['.'],
  ];
  if (versions.some((value) => value !== version) || Object.keys(manifest).length !== 1)
    throw new Error('Versiones de release inconsistentes en paquetes, lockfile o manifest.');
}

export function releaseMetadataOnly(base, ref = 'HEAD', cwd = process.cwd()) {
  validateReleaseVersions(ref, cwd);
  const changed = git(['diff', '--no-renames', '--name-only', '-z', base, ref], cwd)
    .split('\0')
    .filter(Boolean);
  return (
    changed.length > 0 &&
    changed.every((path) => releaseFiles.has(path)) &&
    codeFingerprint(base, cwd) === codeFingerprint(ref, cwd)
  );
}

function ghApi(path) {
  return JSON.parse(
    execFileSync('gh', ['api', path], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 1024 * 1024,
    }),
  );
}

function downloadArtifact(repository, artifact) {
  const directory = mkdtempSync(join(tmpdir(), 'ci-evidence-'));
  try {
    const archive = join(directory, 'evidence.zip');
    const contents = execFileSync(
      'gh',
      ['api', `repos/${repository}/actions/artifacts/${artifact.id}/zip`],
      { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1024 * 1024 },
    );
    writeFileSync(archive, contents);
    return JSON.parse(
      execFileSync('unzip', ['-p', archive, 'ci-evidence.json'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        maxBuffer: 64 * 1024,
      }),
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function ensureCommit(commit, cwd) {
  try {
    git(['cat-file', '-e', `${commit}^{commit}`], cwd);
  } catch {
    // checkout deliberately does not persist credentials. Let gh supply them to
    // this one fetch without storing a token in Git config or command arguments.
    git(
      [
        '-c',
        'credential.helper=',
        '-c',
        'credential.helper=!gh auth git-credential',
        'fetch',
        '--no-tags',
        'origin',
        commit,
      ],
      cwd,
    );
  }
}

export function findEvidence({
  repository,
  ref = 'HEAD',
  cwd = process.cwd(),
  api = ghApi,
  download = downloadArtifact,
  warn = console.warn,
  allowReleaseMetadata = true,
}) {
  const fingerprint = codeFingerprint(ref, cwd);
  let artifacts;
  try {
    ({ artifacts } = api(
      `repos/${repository}/actions/artifacts?name=ci-evidence-${fingerprint}&per_page=20`,
    ));
  } catch {
    warn('No se pudo consultar evidencia de CI; se ejecutarán las validaciones.');
    return null;
  }
  for (const artifact of artifacts || []) {
    if (artifact.expired || !artifact.workflow_run?.id) continue;
    try {
      const evidence = download(repository, artifact);
      if (
        evidence.schemaVersion !== 1 ||
        evidence.fingerprint !== fingerprint ||
        evidence.repository !== repository ||
        evidence.runId !== artifact.workflow_run.id ||
        !shaPattern.test(evidence.commit) ||
        !shaPattern.test(evidence.headSha) ||
        evidence.scope?.any !== true ||
        !['api', 'web', 'mcp'].some((key) => evidence.scope[key] === true)
      )
        continue;
      const run = api(`repos/${repository}/actions/runs/${evidence.runId}`);
      if (
        run.id !== evidence.runId ||
        run.status !== 'completed' ||
        run.conclusion !== 'success' ||
        run.event !== 'pull_request' ||
        run.path !== '.github/workflows/ci.yml' ||
        run.repository.full_name !== repository ||
        run.head_repository?.id !== run.repository.id ||
        run.head_sha !== evidence.headSha
      )
        continue;
      ensureCommit(evidence.commit, cwd);
      const [commit, ...parents] = git(
        ['rev-list', '--parents', '-n', '1', evidence.commit],
        cwd,
      ).split(' ');
      if (commit !== evidence.headSha && !(parents.length === 2 && parents[1] === evidence.headSha))
        continue;
      // Never trust the fingerprint claimed by an artifact alone. Recompute it
      // from the source of that successful PR run, including its CI definition.
      if (codeFingerprint(evidence.commit, cwd) !== fingerprint) continue;
      // Ordinary PR updates may reuse documentation-only changes, but version
      // changes get the release-specific validation or execute suites again.
      if (
        !allowReleaseMetadata &&
        codeFingerprint(evidence.commit, cwd, false) !== codeFingerprint(ref, cwd, false)
      )
        continue;
      return { runId: run.id, url: run.html_url, fingerprint };
    } catch {
      warn(`Evidencia ${artifact.id} no disponible o no verificable; se probará otra fuente.`);
    }
  }
  return null;
}

function output(values) {
  for (const [key, value] of Object.entries(values))
    appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
}

function cli(command) {
  const repository = process.env.GITHUB_REPOSITORY;
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository || '')) throw new Error('Repositorio inválido.');
  if (command === 'record') {
    if (!shaPattern.test(process.env.CI_HEAD_SHA || '')) throw new Error('Head de PR inválido.');
    const scope = Object.fromEntries(
      ['any', 'api', 'web', 'mcp'].map((key) => [key, process.env[key.toUpperCase()] === 'true']),
    );
    if (!scope.any || ![scope.api, scope.web, scope.mcp].some(Boolean))
      throw new Error('No se registrará evidencia sin suites ejecutadas.');
    const evidence = {
      schemaVersion: 1,
      repository,
      runId: Number(process.env.GITHUB_RUN_ID),
      headSha: process.env.CI_HEAD_SHA,
      commit: git(['rev-parse', 'HEAD']),
      fingerprint: codeFingerprint(),
      scope,
    };
    writeFileSync(process.env.CI_EVIDENCE, `${JSON.stringify(evidence, null, 2)}\n`);
    return;
  }
  const ref = command === 'lookup' ? process.env.CI_REF : 'HEAD';
  if (command === 'lookup' && !shaPattern.test(ref || ''))
    throw new Error('Commit de RC inválido.');
  if (command === 'lookup') validateReleaseVersions(ref);
  const fingerprint = codeFingerprint(ref);
  let reusable =
    command === 'lookup' || (command === 'plan' && process.env.CI_EVENT === 'pull_request');
  const manualReuse =
    process.env.CI_EVENT === 'workflow_dispatch' && process.env.CI_REUSE === 'true';
  if (command === 'plan' && manualReuse) {
    validateReleaseVersions(ref);
    reusable = true;
  }
  let release = false;
  if (command === 'plan') {
    release =
      process.env.CI_EVENT === 'pull_request' &&
      process.env.CI_HEAD_REPOSITORY === repository &&
      process.env.CI_HEAD_BRANCH === 'release-please--branches--main--components--paraglide';
    if (release) {
      if (!shaPattern.test(process.env.CI_BASE_SHA || ''))
        throw new Error('Base de release inválida.');
      reusable = releaseMetadataOnly(process.env.CI_BASE_SHA);
    }
  } else if (command !== 'lookup') throw new Error(`Comando desconocido: ${command}`);
  const evidence = reusable
    ? findEvidence({
        repository,
        ref,
        allowReleaseMetadata: command === 'lookup' || release || manualReuse,
      })
    : null;
  output({
    fingerprint,
    reused: Boolean(evidence),
    full: release && !evidence,
    ci_run: evidence?.url || '',
  });
  if (evidence) console.log(`CI ya aprobado para este contenido: ${evidence.url}`);
  else console.log('Sin evidencia reutilizable: CI determinará las suites que debe ejecutar.');
  if (command === 'lookup' && process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      evidence
        ? `CI reutilizado para la RC: ${evidence.url}\n`
        : 'Sin evidencia de CI verificable: la RC ejecutará las suites completas.\n',
    );
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    cli(process.argv[2]);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
