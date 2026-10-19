import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const commitPattern = /^[a-f0-9]{40}$/;
const digestPattern = /^sha256:[a-f0-9]{64}$/;

export function validateTag(tag) {
  if (
    typeof tag !== 'string' ||
    !/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)-rc\.[1-9]\d*$/.test(tag)
  ) {
    throw new Error('Se requiere un tag RC como v0.11.1-rc.1.');
  }
  return tag;
}

function validateSource({ tag, commit, repository }) {
  validateTag(tag);
  if (!commitPattern.test(commit) || !/^[\w.-]+\/[\w.-]+$/.test(repository)) {
    throw new Error('Commit o repositorio inválido.');
  }
}

export function candidateManifest({ tag, commit, repository, apiDigest, webDigest }) {
  validateSource({ tag, commit, repository });
  if (!digestPattern.test(apiDigest) || !digestPattern.test(webDigest)) {
    throw new Error('Las imágenes deben identificarse por su digest SHA256.');
  }
  const imageBase = `ghcr.io/${repository.toLowerCase()}`;
  return {
    schemaVersion: 1,
    tag,
    commit,
    repository,
    images: { api: `${imageBase}-api@${apiDigest}`, web: `${imageBase}-web@${webDigest}` },
  };
}

export function validateManifest(manifest, expected) {
  validateSource(expected);
  const prefix = `ghcr.io/${expected.repository.toLowerCase()}`;
  if (
    manifest.schemaVersion !== 1 ||
    manifest.tag !== expected.tag ||
    manifest.commit !== expected.commit ||
    manifest.repository !== expected.repository
  ) {
    throw new Error('El manifiesto no corresponde a la RC y al commit seleccionados.');
  }
  for (const service of ['api', 'web']) {
    const image = manifest.images?.[service];
    const start = `${prefix}-${service}@`;
    if (
      typeof image !== 'string' ||
      !image.startsWith(start) ||
      !digestPattern.test(image.slice(start.length))
    ) {
      throw new Error(`Referencia inmutable inválida para ${service}.`);
    }
  }
  return manifest;
}

export function validationScope({
  full = false,
  infrastructure = false,
  api = false,
  web = false,
  mcp = false,
}) {
  const all = full || infrastructure;
  return { any: all || api || web || mcp, api: all || api, web: all || web, mcp: all || mcp };
}

function output(values) {
  for (const [key, value] of Object.entries(values)) {
    appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
  }
}

function cli(command) {
  const { RC_TAG: tag, RC_COMMIT: commit, GITHUB_REPOSITORY: repository } = process.env;
  if (command === 'scope') {
    output(
      validationScope(
        Object.fromEntries(
          ['full', 'infrastructure', 'api', 'web', 'mcp'].map((key) => [
            key,
            process.env[key.toUpperCase()] === 'true',
          ]),
        ),
      ),
    );
    return;
  }
  if (command === 'resolve') {
    validateTag(tag);
    const release = JSON.parse(
      execFileSync(
        'gh',
        ['release', 'view', tag, '--repo', repository, '--json', 'isPrerelease,isDraft,tagName'],
        { encoding: 'utf8' },
      ),
    );
    if (!release.isPrerelease || release.isDraft || release.tagName !== tag)
      throw new Error('La RC debe ser una prerelease publicada.');
    const sha = execFileSync('git', ['rev-parse', `refs/tags/${tag}^{commit}`], {
      encoding: 'utf8',
    }).trim();
    validateSource({ tag, commit: sha, repository });
    execFileSync('git', ['merge-base', '--is-ancestor', sha, 'origin/main']);
    const version = JSON.parse(
      execFileSync('git', ['show', `${sha}:package.json`], { encoding: 'utf8' }),
    ).version;
    if (version !== tag.slice(1))
      throw new Error('El tag RC debe coincidir con la versión preparada en package.json.');
    output({ tag, commit: sha, image_base: `ghcr.io/${repository.toLowerCase()}` });
    return;
  }
  const filename = process.env.RC_MANIFEST;
  const expected = { tag, commit, repository };
  if (command === 'create') {
    const manifest = candidateManifest({
      ...expected,
      apiDigest: process.env.API_DIGEST,
      webDigest: process.env.WEB_DIGEST,
    });
    writeFileSync(filename, `${JSON.stringify(manifest, null, 2)}\n`);
  }
  const manifest = validateManifest(JSON.parse(readFileSync(filename, 'utf8')), expected);
  if (command === 'verify' || command === 'create') {
    output({ api_image: manifest.images.api, web_image: manifest.images.web });
  } else if (command === 'verified') {
    const evidence = {
      ...manifest,
      status: 'passed',
      verifiedAt: new Date().toISOString(),
      workflowRun: `${process.env.GITHUB_SERVER_URL}/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`,
      checks: ['readiness-and-commit', 'staging-suites-01-07', 'playwright-e2e'],
    };
    writeFileSync(process.env.RC_VERIFICATION, `${JSON.stringify(evidence, null, 2)}\n`);
  } else {
    throw new Error(`Comando desconocido: ${command}`);
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
