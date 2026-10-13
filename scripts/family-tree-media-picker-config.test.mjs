import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const root = new URL('../', import.meta.url);
const json = (path) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));

test('native Family Tree pickers match the pinned Expo SDK and request no camera/microphone', () => {
  const dependencies = json('mobile/package.json').dependencies;
  const bundled = json('mobile/node_modules/expo/bundledNativeModules.json');
  assert.equal(dependencies['expo-image-picker'], bundled['expo-image-picker']);
  assert.equal(dependencies['expo-document-picker'], bundled['expo-document-picker']);
  const entry = json('mobile/app.json').expo.plugins.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-image-picker',
  );
  assert.ok(entry, 'the real picker configuration must be registered');
  assert.equal(entry[1].cameraPermission, false);
  assert.equal(entry[1].microphonePermission, false);
  assert.match(entry[1].photosPermission, /photographs/);
  assert.match(entry[1].photosPermission, /family history/);
});
