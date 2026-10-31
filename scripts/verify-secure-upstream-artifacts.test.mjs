import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ARTIFACTS,
  validateSecureArtifactMetadata,
} from './verify-secure-upstream-artifacts.mjs';

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

test('accepts only exact reviewed upstream artifact metadata and scoped overrides', () => {
  assert.equal(validateSecureArtifactMetadata(fixture()), true);
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
