import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { after } from 'node:test';
import {
  ARTIFACTS,
  CONSUMERS,
  validateSecureArtifactMetadata,
  verifyInstalledSecureArtifacts,
} from './verify-secure-upstream-artifacts.mjs';

const roots = [];
after(() => roots.forEach(root => rmSync(root, { recursive: true, force: true })));

function fixture() {
  const manifest = {
    overrides: {
      '@expo/cli': { glob: '14.0.2', 'node-forge': '1.4.2', zod: '4.6.7' },
      '@expo/code-signing-certificates': { 'node-forge': '1.4.2' },
      '@expo/config': { deepmerge: '4.3.1', glob: '14.0.2' },
      '@expo/config-plugins': { glob: '14.0.2' },
      '@expo/fingerprint': { glob: '14.0.2', minimatch: '11.0.1' },
      '@expo/metro-config': { glob: '14.0.2' },
      'babel-plugin-istanbul': {
        'test-exclude': { '.': '8.0.0', glob: '14.0.2', minimatch: '11.0.1' },
      },
    },
  };
  const packages = {};
  for (const [name, artifact] of Object.entries(ARTIFACTS)) {
    packages[`node_modules/${name}`] = { ...artifact };
  }
  return { manifest, lock: { lockfileVersion: 3, packages } };
}

function writePackage(root, relativePath, name, version) {
  const path = join(root, relativePath);
  mkdirSync(path, { recursive: true });
  writeFileSync(join(path, 'package.json'), JSON.stringify({ name, version, main: 'index.js' }));
  writeFileSync(join(path, 'index.js'), 'module.exports = {};\n');
}

function installedFixture({ workspaces = [] } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'secure-upstream-artifacts-'));
  roots.push(root);
  const value = fixture();
  value.manifest.private = true;
  value.manifest.workspaces = workspaces;
  writeFileSync(join(root, 'package.json'), JSON.stringify(value.manifest));

  for (const [name, artifact] of Object.entries(ARTIFACTS)) {
    writePackage(root, `node_modules/${name}`, name, artifact.version);
  }
  for (const consumer of CONSUMERS) {
    const path = `node_modules/${consumer.name}`;
    if (!ARTIFACTS[consumer.name]) writePackage(root, path, consumer.name, consumer.version);
  }
  writePackage(
    root,
    'node_modules/glob/node_modules/minimatch',
    'minimatch',
    ARTIFACTS.minimatch.version,
  );
  value.lock.packages['node_modules/glob/node_modules/minimatch'] = { ...ARTIFACTS.minimatch };
  writeFileSync(join(root, 'package-lock.json'), JSON.stringify(value.lock));
  return { root, value };
}

test('accepts only exact reviewed upstream artifact metadata and scoped overrides', () => {
  assert.equal(validateSecureArtifactMetadata(fixture()), true);
});

test('pins the minimatch artifact resolved by glob 14 itself', () => {
  const { root, value } = installedFixture();
  writePackage(root, 'node_modules/glob/node_modules/minimatch', 'minimatch', '11.0.0');
  value.lock.packages['node_modules/glob/node_modules/minimatch'] = {
    version: '11.0.0',
    resolved: 'https://registry.npmjs.org/minimatch/-/minimatch-11.0.0.tgz',
    integrity: 'sha512-tampered-nested-copy',
  };
  writeFileSync(join(root, 'package-lock.json'), JSON.stringify(value.lock));
  assert.throws(
    () => verifyInstalledSecureArtifacts(root),
    /glob@14\.0\.2 resolved minimatch@11\.0\.0/,
  );
});

test('rejects a noncanonical installed-package symlink ancestor', () => {
  const { root } = installedFixture();
  writePackage(root, 'hidden-package', 'hidden-package', '1.0.0');
  writePackage(root, 'hidden-package/node_modules/@expo/config', '@expo/config', '56.0.15');
  symlinkSync('../hidden-package', join(root, 'node_modules/hidden-package'));
  assert.throws(
    () => verifyInstalledSecureArtifacts(root),
    /installed dependency symlink rejected/,
  );
});

test('accepts and scans the exact declared workspace link target', () => {
  const { root } = installedFixture({ workspaces: ['workspace'] });
  writePackage(root, 'workspace', 'fixture-workspace', '1.0.0');
  symlinkSync('../workspace', join(root, 'node_modules/fixture-workspace'));
  assert.equal(verifyInstalledSecureArtifacts(root).length, 13);

  writePackage(root, 'workspace/node_modules/@expo/config', '@expo/config', '56.0.15');
  assert.throws(
    () => verifyInstalledSecureArtifacts(root),
    /expected one installed @expo\/config@56\.0\.15 consumer; found 2/,
  );
});

for (const [name, mutate, pattern] of [
  ['floating override', value => { value.manifest.overrides['@expo/cli']['node-forge'] = '^1.4.2'; }, /override/],
  ['changed registry URL', value => { value.lock.packages['node_modules/node-forge'].resolved = 'https://example.invalid/forge.tgz'; }, /artifact/],
  ['changed integrity', value => { value.lock.packages['node_modules/node-forge'].integrity = 'sha512-forged'; }, /artifact/],
  ['changed version', value => { value.lock.packages['node_modules/node-forge'].version = '1.4.3'; }, /artifact/],
  ['missing artifact', value => { delete value.lock.packages['node_modules/node-forge']; }, /artifact/],
  ['old lock format', value => { value.lock.lockfileVersion = 2; }, /v3 lockfile/],
]) {
  test(`rejects ${name}`, () => {
    const value = fixture();
    mutate(value);
    assert.throws(() => validateSecureArtifactMetadata(value), pattern);
  });
}
