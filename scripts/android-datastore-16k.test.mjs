import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const require = createRequire(new URL('mobile/package.json', root));
const pluginPath = new URL('mobile/plugins/with-datastore-16k.js', root);
const dependency = '    implementation("androidx.datastore:datastore-core:1.2.1")';
const template = execFileSync('tar', ['-xOf',
  path.join(path.dirname(require.resolve('expo/package.json')), 'template.tgz'),
  'package/android/app/build.gradle'], { encoding: 'utf8' });

// Exercise the supported Expo mod, not a mock of its transformation.
async function transform(contents, language = 'groovy') {
  assert.ok(existsSync(pluginPath), 'DataStore correction plugin must exist');
  const config = require(pluginPath.pathname)({ name: 'fixture', slug: 'fixture' });
  const result = await config.mods.android.appBuildGradle({
    modResults: { contents, language },
    modRequest: { platform: 'android', modName: 'appBuildGradle',
      projectRoot: root.pathname, introspect: false },
  });
  return result.modResults.contents;
}

test('real Expo Gradle template gets a normal DataStore dependency, preserving all other text', async () => {
  const output = await transform(template);
  assert.equal(output.replace(`${dependency}\n`, ''), template);
  assert.equal(output.split(dependency).length - 1, 1);
  assert.equal(await transform(output), output);
  assert.doesNotMatch(output, /resolutionStrategy|datastore-core-android/);
});

test('unsupported language and malformed or ambiguous targets fail closed', async () => {
  await assert.rejects(transform(template, 'kotlin'), /Groovy/);
  for (const source of [template.replace('dependencies {', 'missing {'),
    `${template}\ndependencies {\n}\n`, template.slice(0, template.lastIndexOf('}'))]) {
    await assert.rejects(transform(source), /dependencies|balanced/);
  }
});

test('existing conflicting DataStore declarations are not silently overwritten', async () => {
  const source = template.replace('dependencies {',
    'dependencies {\n    implementation("androidx.datastore:datastore-core:1.1.7")');
  await assert.rejects(transform(source), /conflicting DataStore/);
  const commented = template.replace('dependencies {',
    `dependencies {\n/*\n${dependency}\n*/`);
  await assert.rejects(transform(commented), /conflicting DataStore/);
});

test('CRLF generation remains idempotent and preserves line endings', async () => {
  const source = template.replace(/\r?\n/g, '\r\n');
  const output = await transform(source);
  assert.equal(output.replace(`${dependency}\r\n`, ''), source);
  assert.equal(await transform(output), output);
});

test('managed config registers the correction exactly once and keeps upgrade metadata coherent', () => {
  const app = JSON.parse(readFileSync(new URL('mobile/app.json', root))).expo;
  assert.equal(app.plugins.filter(p => p === './plugins/with-datastore-16k').length, 1);
  assert.equal(app.version, '1.0.14');
  assert.equal(app.android.versionCode, 15);
});
