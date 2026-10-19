import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { candidateManifest, validateManifest, validateTag, validationScope } from './candidate.mjs';
import { assertStagingReady, prepareStaging, stagingTestEnvironment } from './staging.mjs';

const sha = 'a'.repeat(40);
const digest = `sha256:${'b'.repeat(64)}`;
const options = { tag: 'v0.11.1-rc.1', commit: sha, repository: 'Zer0x25/paraglide-2.0' };
const manifest = () => candidateManifest({ ...options, apiDigest: digest, webDigest: digest });

test('solo acepta versiones RC numeradas, sin expresiones de shell ni rutas', () => {
  assert.equal(validateTag(options.tag), options.tag);
  for (const tag of [
    'v1.0.0',
    'v1.0.0-beta.1',
    'v1.0.0-rc.0',
    'v01.0.0-rc.1',
    '../main',
    'v1.0.0-rc.1\n',
    '$(id)',
  ]) {
    assert.throws(() => validateTag(tag));
  }
});

test('la evidencia debe corresponder al tag, commit, repositorio y digest exactos', () => {
  assert.deepEqual(validateManifest(manifest(), options), manifest());
  assert.throws(() => validateManifest(manifest(), { ...options, commit: 'c'.repeat(40) }));
  assert.throws(() => validateManifest(manifest(), { ...options, tag: 'v0.11.1-rc.2' }));
  assert.throws(() =>
    validateManifest(
      { ...manifest(), images: { ...manifest().images, api: 'postgres:latest' } },
      options,
    ),
  );
  assert.throws(() => candidateManifest({ ...options, apiDigest: 'latest', webDigest: digest }));
});

test('documentación omite suites; infraestructura y shared validan todos los módulos', () => {
  assert.deepEqual(validationScope({}), { any: false, api: false, web: false, mcp: false });
  assert.deepEqual(validationScope({ web: true }), {
    any: true,
    api: false,
    web: true,
    mcp: false,
  });
  for (const flags of [{ infrastructure: true }, { full: true }]) {
    assert.deepEqual(validationScope(flags), { any: true, api: true, web: true, mcp: true });
  }
});

test('resolver una RC rechaza releases estables, commits ajenos a main y versiones inconsistentes', () => {
  const directory = mkdtempSync(join(tmpdir(), 'paraglide-rc-source-'));
  try {
    const git = (args) => execFileSync('git', args, { cwd: directory, stdio: 'pipe' });
    git(['init', '-b', 'main']);
    git(['config', 'user.name', 'CI Test']);
    git(['config', 'user.email', 'ci@example.test']);
    writeFileSync(
      join(directory, 'package.json'),
      JSON.stringify({ version: options.tag.slice(1) }),
    );
    git(['add', '.']);
    git(['commit', '-m', 'test candidate']);
    git(['update-ref', 'refs/remotes/origin/main', 'HEAD']);
    git(['tag', options.tag]);
    const bin = join(directory, 'bin');
    mkdirSync(bin);
    const gh = join(bin, 'gh');
    writeFileSync(gh, '#!/usr/bin/env node\nprocess.stdout.write(process.env.TEST_RELEASE);\n');
    chmodSync(gh, 0o755);
    const release = { tagName: options.tag, isPrerelease: true, isDraft: false };
    const run = (changes = {}) =>
      spawnSync(
        process.execPath,
        [fileURLToPath(new URL('./candidate.mjs', import.meta.url)), 'resolve'],
        {
          cwd: directory,
          encoding: 'utf8',
          env: {
            ...process.env,
            PATH: `${bin}:${process.env.PATH}`,
            RC_TAG: options.tag,
            GITHUB_REPOSITORY: options.repository,
            GITHUB_OUTPUT: join(directory, 'outputs'),
            TEST_RELEASE: JSON.stringify(release),
            ...changes,
          },
        },
      );
    assert.equal(run().status, 0);
    assert.notEqual(
      run({ TEST_RELEASE: JSON.stringify({ ...release, isPrerelease: false }) }).status,
      0,
    );
    git(['switch', '-c', 'unmerged']);
    writeFileSync(join(directory, 'extra'), 'pending');
    git(['add', '.']);
    git(['commit', '-m', 'unmerged change']);
    git(['tag', '-f', options.tag]);
    assert.notEqual(run().status, 0);
    git(['update-ref', 'refs/remotes/origin/main', 'HEAD']);
    writeFileSync(join(directory, 'package.json'), JSON.stringify({ version: '1.0.0' }));
    git(['add', 'package.json']);
    git(['commit', '-m', 'wrong version']);
    git(['update-ref', 'refs/remotes/origin/main', 'HEAD']);
    git(['tag', '-f', options.tag]);
    assert.notEqual(run().status, 0);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('staging conserva credenciales fuertes y fija sus destinos aunque el proceso herede URLs de producción', () => {
  const directory = mkdtempSync(join(tmpdir(), 'paraglide-rc-test-'));
  try {
    const first = prepareStaging(manifest(), directory);
    const second = prepareStaging(manifest(), directory);
    assert.equal(first.credentials.adminPassword, second.credentials.adminPassword);
    assert.ok(first.credentials.jwtSecret.length >= 64);
    assert.equal(statSync(first.envFile).mode & 0o777, 0o600);
    const text = readFileSync(first.envFile, 'utf8');
    assert.ok(text.includes(`RC_API_IMAGE=${manifest().images.api}`));
    assert.ok(!text.includes('DATABASE_URL='));
    const env = stagingTestEnvironment(first.credentials, sha, {
      PROD_URL: 'https://production.invalid',
      WEB_BASE_URL: 'https://production.invalid',
      ADMIN_PASSWORD: 'wrong',
    });
    assert.equal(env.PROD_URL, 'http://localhost:3200');
    assert.equal(env.WEB_BASE_URL, 'http://localhost:3200');
    assert.equal(env.ADMIN_PASSWORD, first.credentials.adminPassword);
    assert.equal(env.EXPECTED_COMMIT, sha);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('un HTTP 200 de otro commit no aprueba la candidata ni habilita sus pruebas', async () => {
  const response = (commit, ok = true) => ({ ok, json: async () => ({ status: 'ok', commit }) });
  await assert.rejects(assertStagingReady(manifest(), async () => response('c'.repeat(40))));
  await assert.rejects(
    assertStagingReady(manifest(), async (url) =>
      url.endsWith('/login') ? response(sha, false) : response(sha),
    ),
  );
  await assert.doesNotReject(assertStagingReady(manifest(), async () => response(sha)));
});
