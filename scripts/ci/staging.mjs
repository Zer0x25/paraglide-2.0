import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validateManifest } from './candidate.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const stateDirectory = () =>
  process.env.STAGING_STATE_DIR || join(homedir(), '.local/state/paraglide-staging');

export function prepareStaging(manifest, directory = stateDirectory()) {
  validateManifest(manifest, manifest);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const credentialsFile = join(directory, 'credentials.json');
  const credentials = existsSync(credentialsFile)
    ? JSON.parse(readFileSync(credentialsFile, 'utf8'))
    : {
        jwtSecret: randomBytes(48).toString('hex'),
        dbPassword: randomBytes(32).toString('hex'),
        adminEmail: 'admin@parapente.com',
        adminPassword: randomBytes(24).toString('hex'),
      };
  for (const key of ['jwtSecret', 'dbPassword', 'adminPassword']) {
    if (!/^[a-f0-9]{48,}$/.test(credentials[key]))
      throw new Error(`Credencial de staging inválida: ${key}`);
  }
  if (credentials.adminEmail !== 'admin@parapente.com')
    throw new Error('Usuario de staging inválido.');
  writeFileSync(credentialsFile, `${JSON.stringify(credentials, null, 2)}\n`, { mode: 0o600 });
  chmodSync(credentialsFile, 0o600);
  const envFile = join(directory, 'rc.env');
  const values = {
    RC_API_IMAGE: manifest.images.api,
    RC_WEB_IMAGE: manifest.images.web,
    STAGING_JWT_SECRET: credentials.jwtSecret,
    STAGING_DB_PASSWORD: credentials.dbPassword,
    STAGING_ADMIN_EMAIL: credentials.adminEmail,
    STAGING_ADMIN_PASSWORD: credentials.adminPassword,
  };
  writeFileSync(
    envFile,
    Object.entries(values)
      .map(([key, value]) => `${key}=${value}\n`)
      .join(''),
    { mode: 0o600 },
  );
  chmodSync(envFile, 0o600);
  return { credentials, envFile };
}

export function stagingTestEnvironment(credentials, commit, inherited = process.env) {
  const env = {
    ...inherited,
    CI: 'true',
    PROD_URL: 'http://localhost:3200',
    WEB_BASE_URL: 'http://localhost:3200',
    ADMIN_EMAIL: credentials.adminEmail,
    ADMIN_PASSWORD: credentials.adminPassword,
    EXPECTED_COMMIT: commit,
    HEADLESS: 'true',
  };
  // Playwright configura FORCE_COLOR en sus workers.
  delete env.NO_COLOR;
  return env;
}

function run(program, args, options = {}) {
  const result = spawnSync(program, args, { cwd: root, stdio: 'inherit', ...options });
  if (result.error || result.status !== 0)
    throw new Error(`${program} falló (${result.status ?? 'sin código'}).`);
  return result;
}

export async function assertStagingReady(manifest, fetchImpl = fetch) {
  const api = await fetchImpl('http://127.0.0.1:3201/api/public/health', {
    signal: AbortSignal.timeout(10000),
  });
  const body = await api.json();
  if (!api.ok || body.status !== 'ok' || body.commit !== manifest.commit)
    throw new Error('Staging no está ejecutando el commit exacto de la RC.');
  const web = await fetchImpl('http://127.0.0.1:3200/login', {
    signal: AbortSignal.timeout(10000),
  });
  if (!web.ok) throw new Error('La Web de staging no está lista.');
}

async function main(command) {
  const manifest = validateManifest(JSON.parse(readFileSync(process.env.RC_MANIFEST, 'utf8')), {
    tag: process.env.RC_TAG,
    commit: process.env.RC_COMMIT,
    repository: process.env.GITHUB_REPOSITORY,
  });
  const { credentials, envFile } = prepareStaging(manifest);
  const composeArgs = [
    'compose',
    '--project-name',
    'paraglide-staging',
    '--env-file',
    envFile,
    '-f',
    join(root, 'docker-compose.staging.yml'),
  ];
  const compose = (args, options) => run('docker', [...composeArgs, ...args], options);
  // No se heredan API_IMAGE, DATABASE_URL ni opciones de Compose del entorno de producción.
  const dockerEnv = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !/^(COMPOSE_|RC_|STAGING_)/.test(key)),
  );
  const options = { env: dockerEnv };
  if (command === 'deploy') {
    compose(['pull', 'db', 'api', 'web'], options);
    compose(['up', '-d', '--wait', '--wait-timeout', '90', 'db'], options);
    compose(['stop', 'api', 'web'], options);
    // El esquema se prepara antes de arrancar la aplicación candidata.
    compose(
      [
        'run',
        '--rm',
        '--no-deps',
        '-T',
        'api',
        'sh',
        '-ec',
        'npx prisma db push --schema=apps/api/prisma/schema.prisma --skip-generate && npx tsx apps/api/scripts/indexes-especiales.ts && npx tsx apps/api/prisma/seed.prod.ts',
      ],
      options,
    );
    const seed = readFileSync(join(root, 'scripts/ci/seed-staging.cjs'), 'utf8');
    compose(['run', '--rm', '--no-deps', '-T', 'api', 'node', '-'], {
      ...options,
      input: seed,
      stdio: ['pipe', 'inherit', 'inherit'],
    });
    compose(['up', '-d', '--no-build', '--wait', '--wait-timeout', '120', 'api', 'web'], options);
    await assertStagingReady(manifest);
    writeFileSync(
      join(stateDirectory(), 'deployment.json'),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    console.log(`RC ${manifest.tag} desplegada en staging (Web 3200 / API 3201 / DB 5680).`);
  } else if (command === 'test') {
    await assertStagingReady(manifest);
    const env = stagingTestEnvironment(credentials, manifest.commit);
    run('npm', ['run', 'test:staging'], { env });
    run('npm', ['run', 'test:e2e'], { env });
    await assertStagingReady(manifest);
  } else if (command === 'logs') {
    compose(['ps'], options);
    compose(['logs', '--no-color', '--tail', '100', 'api', 'web'], options);
  } else {
    throw new Error(`Comando desconocido: ${command}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv[2]).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
