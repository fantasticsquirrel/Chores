import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('mobile/package.json', root), 'utf8'));
const config = JSON.parse(readFileSync(new URL('mobile/app.json', root), 'utf8')).expo;
const lock = JSON.parse(readFileSync(new URL('package-lock.json', root), 'utf8'));

test('native notification SDK modules are explicitly installed and locked', () => {
  for (const name of ['expo-notifications', 'expo-device', 'expo-constants']) {
    assert.ok(manifest.dependencies[name], `${name} must be an explicit native dependency`);
    const entry = lock.packages[`mobile/node_modules/${name}`] ?? lock.packages[`node_modules/${name}`];
    assert.ok(entry?.version, `${name} must be resolved in the root lockfile`);
    assert.match(entry.version, /^56\./, `${name} must match Expo SDK 56`);
  }
});

test('notification native configuration is wired without changing production app identity', () => {
  const plugin = config.plugins.find(item => (Array.isArray(item) ? item[0] : item) === 'expo-notifications');
  assert.ok(plugin, 'expo-notifications config plugin must be installed');
  assert.equal(config.android.package, 'com.fantasticsquirrel.familymanager');
  assert.equal(config.ios.bundleIdentifier, 'com.fantasticsquirrel.familymanager');
  assert.equal(config.extra.eas.projectId, '53bf095d-ad94-4ad4-a619-609c57026257');
});
