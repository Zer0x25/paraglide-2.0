import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { codeFingerprint, findEvidence, releaseMetadataOnly } from './evidence.mjs';

const repository = 'owner/project';
const versionFiles = [
  'package.json',
  'apps/api/package.json',
  'apps/web/package.json',
  'packages/shared/package.json',
];

function fixture() {
  const cwd = mkdtempSync(join(tmpdir(), 'ci-evidence-'));
  const git = (...args) =>
    execFileSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe' }).trim();
  const write = (path, value) => {
    mkdirSync(dirname(join(cwd, path)), { recursive: true });
    writeFileSync(join(cwd, path), typeof value === 'string' ? value : JSON.stringify(value));
  };
  const json = (path) => JSON.parse(readFileSync(join(cwd, path), 'utf8'));
  const commit = () => {
    git('add', '.');
    git('commit', '-m', 'fixture');
    return git('rev-parse', 'HEAD');
  };
  git('init', '-b', 'main');
  git('config', 'user.name', 'CI');
  git('config', 'user.email', 'ci@example.test');
  for (const path of versionFiles)
    write(path, { name: path, version: '1.0.0-rc.1', scripts: { test: 'node test.js' } });
  write('package-lock.json', {
    version: '1.0.0-rc.1',
    lockfileVersion: 3,
    packages: Object.fromEntries(
      ['', 'apps/api', 'apps/web', 'packages/shared', 'node_modules/dependency'].map((path) => [
        path,
        { version: '1.0.0-rc.1', integrity: 'original' },
      ]),
    ),
  });
  write('.release-please-manifest.json', { '.': '1.0.0-rc.1' });
  write('CHANGELOG.md', 'before');
  write('apps/api/src/index.js', 'export const value = 1;');
  write('.github/workflows/ci.yml', 'trusted workflow');
  const base = commit();
  const bump = () => {
    for (const path of versionFiles) write(path, { ...json(path), version: '1.0.0-rc.2' });
    const lock = json('package-lock.json');
    lock.version = '1.0.0-rc.2';
    // Match the actual Release Please PR: workspace lock versions stay as-is.
    lock.packages[''].version = '1.0.0-rc.2';
    write('package-lock.json', lock);
    write('.release-please-manifest.json', { '.': '1.0.0-rc.2' });
    write('CHANGELOG.md', 'release notes');
  };
  return {
    cwd,
    git,
    write,
    json,
    commit,
    base,
    bump,
    close: () => rmSync(cwd, { recursive: true, force: true }),
  };
}

test('una release de versiones y changelog conserva la huella del código validado', () => {
  const f = fixture();
  try {
    f.bump();
    const head = f.commit();
    assert.equal(codeFingerprint(f.base, f.cwd), codeFingerprint(head, f.cwd));
    assert.equal(releaseMetadataOnly(f.base, head, f.cwd), true);
  } finally {
    f.close();
  }
});

for (const change of [
  'dependency',
  'integrity',
  'workspace-lock-version',
  'script',
  'code',
  'workflow',
  'missing-version',
  'other-file',
]) {
  test(`no reutiliza una release que cambia ${change}`, () => {
    const f = fixture();
    try {
      f.bump();
      if (change === 'dependency' || change === 'integrity') {
        const lock = f.json('package-lock.json');
        lock.packages['node_modules/dependency'][
          change === 'dependency' ? 'version' : 'integrity'
        ] = 'changed';
        f.write('package-lock.json', lock);
      }
      if (change === 'workspace-lock-version') {
        const lock = f.json('package-lock.json');
        lock.packages['apps/api'].version = 'different';
        f.write('package-lock.json', lock);
      }
      if (change === 'script')
        f.write('apps/api/package.json', {
          ...f.json('apps/api/package.json'),
          scripts: { test: 'exit 0' },
        });
      if (change === 'code') f.write('apps/api/src/index.js', 'export const value = 2;');
      if (change === 'workflow') f.write('.github/workflows/ci.yml', 'untrusted workflow');
      if (change === 'missing-version') {
        const pkg = f.json('apps/api/package.json');
        delete pkg.version;
        f.write('apps/api/package.json', pkg);
      }
      if (change === 'other-file') f.write('unknown.config', 'new setting');
      const head = f.commit();
      assert.notEqual(codeFingerprint(f.base, f.cwd), codeFingerprint(head, f.cwd));
      if (change === 'missing-version')
        assert.throws(() => releaseMetadataOnly(f.base, head, f.cwd));
      else assert.equal(releaseMetadataOnly(f.base, head, f.cwd), false);
    } finally {
      f.close();
    }
  });
}

test('la comprobación de release exige versiones coherentes y limita los archivos permitidos', () => {
  const f = fixture();
  try {
    f.bump();
    f.write('README.md', 'other documentation');
    assert.equal(releaseMetadataOnly(f.base, f.commit(), f.cwd), false);
    f.write('apps/web/package.json', { ...f.json('apps/web/package.json'), version: '1.0.0-rc.9' });
    assert.throws(() => releaseMetadataOnly(f.base, f.commit(), f.cwd), /version/i);
  } finally {
    f.close();
  }
});

function remote(f, changes = {}) {
  const fingerprint = codeFingerprint(f.base, f.cwd);
  const evidence = {
    schemaVersion: 1,
    repository,
    runId: 17,
    headSha: f.base,
    commit: f.base,
    fingerprint,
    scope: { any: true, api: true, web: false, mcp: false },
    ...changes.evidence,
  };
  const run = {
    id: 17,
    status: 'completed',
    conclusion: 'success',
    event: 'pull_request',
    path: '.github/workflows/ci.yml',
    head_sha: f.base,
    repository: { id: 1, full_name: repository },
    head_repository: { id: 1 },
    html_url: 'https://github.com/owner/project/actions/runs/17',
    ...changes.run,
  };
  return {
    repository,
    ref: f.base,
    cwd: f.cwd,
    warn: () => {},
    api: (path) =>
      path.includes('/artifacts?')
        ? { artifacts: [{ id: 99, expired: false, workflow_run: { id: 17 } }] }
        : run,
    download: () => evidence,
  };
}

test('reutiliza suites por módulos de un CI exitoso sobre exactamente el mismo contenido', () => {
  const f = fixture();
  try {
    f.bump();
    const head = f.commit();
    assert.equal(findEvidence({ ...remote(f), ref: head }).runId, 17);
  } finally {
    f.close();
  }
});

test('un commit de documentación sobre un PR ya validado no repite sus suites', () => {
  const f = fixture();
  try {
    f.write('README.md', 'documentation update');
    const head = f.commit();
    assert.equal(findEvidence({ ...remote(f), ref: head, allowReleaseMetadata: false }).runId, 17);
  } finally {
    f.close();
  }
});

test('un PR normal no usa la excepción de versiones reservada a la validación de release', () => {
  const f = fixture();
  try {
    f.bump();
    const head = f.commit();
    assert.equal(findEvidence({ ...remote(f), ref: head, allowReleaseMetadata: false }), null);
    assert.equal(findEvidence({ ...remote(f), ref: head, allowReleaseMetadata: true }).runId, 17);
  } finally {
    f.close();
  }
});

for (const changes of [
  { run: { conclusion: 'failure' } },
  { run: { status: 'in_progress' } },
  { run: { path: '.github/workflows/other.yml' } },
  { run: { head_repository: { id: 2 } } },
  { run: { head_sha: 'a'.repeat(40) } },
  { run: { event: 'workflow_dispatch' } },
  { evidence: { scope: { any: false } } },
  { evidence: { runId: 18 } },
  { evidence: { fingerprint: 'forged' } },
]) {
  test(`rechaza evidencia no válida: ${JSON.stringify(changes)}`, () => {
    const f = fixture();
    try {
      assert.equal(findEvidence(remote(f, changes)), null);
    } finally {
      f.close();
    }
  });
}

test('una huella declarada no basta: vuelve a calcularla desde el commit que ejecutó CI', () => {
  const f = fixture();
  try {
    f.write('.github/workflows/ci.yml', 'bypass tests');
    const other = f.commit();
    const opts = remote(f, {
      evidence: { commit: other, headSha: other },
      run: { head_sha: other },
    });
    assert.equal(findEvidence(opts), null);
  } finally {
    f.close();
  }
});

test('acepta el merge de prueba del PR y rechaza commits sin relación con su head', () => {
  const f = fixture();
  try {
    f.git('switch', '-c', 'feature');
    f.write('apps/api/src/index.js', 'export const value = 2;');
    const head = f.commit();
    f.git('switch', 'main');
    f.write('base.config', 'base change');
    f.commit();
    f.git('merge', '--no-ff', 'feature', '-m', 'test merge');
    const merge = f.git('rev-parse', 'HEAD');
    const options = remote(f, {
      evidence: { commit: merge, headSha: head, fingerprint: codeFingerprint(merge, f.cwd) },
      run: { head_sha: head },
    });
    assert.equal(findEvidence({ ...options, ref: merge }).runId, 17);
    assert.equal(
      findEvidence({
        ...options,
        ref: merge,
        download: () => ({ ...options.download(), headSha: f.base }),
        api: (path) =>
          path.includes('/artifacts?')
            ? options.api(path)
            : { ...options.api(path), head_sha: f.base },
      }),
      null,
    );
  } finally {
    f.close();
  }
});

test('sin artefactos, con evidencia expirada o sin acceso a Actions se vuelve a ejecutar CI', () => {
  const f = fixture();
  try {
    for (const api of [
      () => ({ artifacts: [] }),
      () => ({ artifacts: [{ expired: true }] }),
      () => {
        throw new Error('403');
      },
    ]) {
      assert.equal(findEvidence({ ...remote(f), api }), null);
    }
  } finally {
    f.close();
  }
});

test('sin evidencia, el PR normal mantiene selección por módulos y la release exige suites completas', () => {
  const f = fixture();
  try {
    f.bump();
    f.commit();
    f.write('bin/gh', '#!/bin/sh\nprintf \'{"artifacts":[]}\'\n');
    chmodSync(join(f.cwd, 'bin/gh'), 0o755);
    for (const branch of ['feature', 'release-please--branches--main--components--paraglide']) {
      const output = join(f.cwd, 'outputs');
      writeFileSync(output, '');
      const result = spawnSync(
        process.execPath,
        [fileURLToPath(new URL('./evidence.mjs', import.meta.url)), 'plan'],
        {
          cwd: f.cwd,
          encoding: 'utf8',
          env: {
            ...process.env,
            PATH: `${join(f.cwd, 'bin')}:${process.env.PATH}`,
            GITHUB_REPOSITORY: repository,
            GITHUB_OUTPUT: output,
            CI_EVENT: 'pull_request',
            CI_HEAD_REPOSITORY: repository,
            CI_HEAD_BRANCH: branch,
            CI_BASE_SHA: f.base,
          },
        },
      );
      assert.equal(result.status, 0, result.stderr);
      const values = readFileSync(output, 'utf8');
      assert.match(values, /reused=false/);
      assert.match(values, new RegExp(`full=${branch !== 'feature'}`));
    }
  } finally {
    f.close();
  }
});
