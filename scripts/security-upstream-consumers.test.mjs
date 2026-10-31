import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test, { after } from 'node:test';
import vm from 'node:vm';
import { verifyInstalledSecureArtifacts } from './verify-secure-upstream-artifacts.mjs';

const require = createRequire(import.meta.url);
const scratch = mkdtempSync(join(tmpdir(), 'family-secure-upstreams-'));
after(() => rmSync(scratch, { recursive: true, force: true }));

const cliRoot = resolve('mobile/node_modules/expo/node_modules/@expo/cli');
const configRoot = resolve('node_modules/@expo/config');
const fingerprintRoot = resolve('node_modules/@expo/fingerprint');
const testExcludeRoot = resolve('node_modules/test-exclude');
const cliRequire = createRequire(join(cliRoot, 'package.json'));
const configRequire = createRequire(join(configRoot, 'package.json'));
const fingerprintRequire = createRequire(join(fingerprintRoot, 'package.json'));
const testExcludeRequire = createRequire(join(testExcludeRoot, 'package.json'));

test('installed override consumers resolve only exact integrity-pinned artifacts', () => {
  const evidence = verifyInstalledSecureArtifacts();
  assert.equal(evidence.length, 12);
});

test('node-forge 1.4.2 preserves Expo certificate signing through the real consumer', () => {
  const forge = cliRequire('node-forge');
  const certificates = require('@expo/code-signing-certificates');
  assert.equal(cliRequire('node-forge/package.json').version, '1.4.2');
  const keyPair = forge.pki.rsa.generateKeyPair({ bits: 512, e: 65537 });
  const pem = certificates.convertKeyPairToPEM(keyPair);
  const restored = certificates.convertKeyPairPEMToKeyPair(pem);
  const certificate = certificates.generateSelfSignedCodeSigningCertificate({
    keyPair: restored,
    validityNotBefore: new Date(Date.now() - 60_000),
    validityNotAfter: new Date(Date.now() + 60_000),
    commonName: 'Family Manager regression',
  });
  certificates.validateSelfSignedCertificate(certificate, restored);
  const signature = certificates.signBufferRSASHA256AndVerify(
    restored.privateKey,
    certificate,
    Buffer.from('signed update'),
  );
  assert.ok(signature.length > 20);
});

function rejectsNestedDigest(forge) {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/node-forge-nested-digest.json', import.meta.url)));
  const key = forge.pki.rsa.setPublicKey(
    new forge.jsbn.BigInteger(fixture.modulus, 16),
    new forge.jsbn.BigInteger('3'),
  );
  const md = forge.md.sha256.create();
  md.update(fixture.message);
  const signature = forge.util.hexToBytes(fixture.signature);
  assert.throws(
    () => key.verify(md.digest().getBytes(), signature, undefined, { _skipPaddingChecks: true }),
    /valid RSASSA-PKCS1-v1_5 DigestInfo/,
  );
  assert.throws(() => key.verify(md.digest().getBytes(), signature));
}

test('upstream node-forge rejects the retired backport attack in Node and browser bundles', () => {
  const forge = cliRequire('node-forge');
  rejectsNestedDigest(forge);
  const forgeRoot = resolve(cliRequire.resolve('node-forge/package.json'), '..');
  for (const bundle of ['forge.min.js', 'forge.all.min.js']) {
    const context = { window: {}, jQuery: null, console, setTimeout, clearTimeout };
    vm.runInNewContext(readFileSync(join(forgeRoot, 'dist', bundle), 'utf8'), context);
    rejectsNestedDigest(context.window.forge);
  }
});

test('upstream node-forge rejects invalid GCM tags, malformed OIDs, and negative inverse hangs', () => {
  const forge = cliRequire('node-forge');
  const decipher = forge.cipher.createDecipher('AES-GCM', '\0'.repeat(16));
  assert.throws(() => decipher.start({ iv: '\0'.repeat(12), tagLength: 0, tag: '' }), /tag length/i);
  const oid = '2.999.3.40000';
  assert.equal(forge.asn1.derToOid(forge.asn1.oidToDer(oid).getBytes()), oid);
  const inverse = vm.runInNewContext(`
    const forge = require('node-forge');
    new forge.jsbn.BigInteger('2').modInverse(new forge.jsbn.BigInteger('-3')).toString();
  `, { require: cliRequire }, { timeout: 2_000 });
  assert.equal(inverse, '0');
});

test('Expo CLI Zod schemas retain valid parsing and strict rejection under Zod 4', () => {
  assert.equal(cliRequire('zod/package.json').version, '4.6.7');
  const { PluginSchema, DevToolsPluginOutputSchema } = require(join(
    cliRoot,
    'build/src/start/server/DevToolsPlugin.schema.js',
  ));
  const plugin = {
    packageName: 'family-tools',
    packageRoot: '/tmp/family-tools',
    cliExtensions: {
      description: 'Tools',
      entryPoint: 'index.js',
      commands: [{ name: 'inspect', title: 'Inspect', environments: ['cli'], parameters: [{ name: 'deep', type: 'confirm' }] }],
    },
  };
  assert.equal(PluginSchema.safeParse(plugin).success, true);
  assert.equal(PluginSchema.safeParse({ ...plugin, packageName: '' }).success, false);
  assert.equal(DevToolsPluginOutputSchema.safeParse([{ type: 'image', url: 'not-a-url' }]).success, false);
  const { createMCPDevToolsExtensionSchema } = require(join(
    cliRoot,
    'build/src/start/server/createMCPDevToolsExtensionSchema.js',
  ));
  const commandSchema = createMCPDevToolsExtensionSchema(plugin);
  assert.equal(commandSchema.safeParse({ command: 'inspect', deep: true }).success, true);
  assert.equal(commandSchema.safeParse({ command: 'inspect', deep: true, extra: true }).success, false);
});

test('glob 14 preserves the APIs consumed by Expo CLI, config plugins, and Metro', async () => {
  assert.equal(cliRequire('glob/package.json').version, '14.0.2');
  const root = join(scratch, 'glob-consumers');
  mkdirSync(join(root, 'packages/one'), { recursive: true });
  mkdirSync(join(root, 'packages/two'), { recursive: true });
  mkdirSync(join(root, 'ios/Demo.xcodeproj'), { recursive: true });
  writeFileSync(join(root, 'packages/one/package.json'), '{"name":"one"}');
  writeFileSync(join(root, 'packages/two/package.json'), '{"name":"two"}');
  writeFileSync(join(root, 'ios/Demo.xcodeproj/project.pbxproj'), '// project');
  writeFileSync(join(root, 'one.txt'), 'one');
  writeFileSync(join(root, 'two.md'), 'two');

  const cliGlob = require(join(cliRoot, 'build/src/utils/glob.js'));
  assert.deepEqual(await cliGlob.everyMatchAsync('**/*.txt', { cwd: root }), ['one.txt']);
  assert.deepEqual(await cliGlob.anyMatchAsync('**/*.md', { cwd: root }), ['two.md']);

  const iosPaths = require('@expo/config-plugins/build/ios/Paths');
  assert.deepEqual(iosPaths.getAllXcodeProjectPaths(root), [join(root, 'ios/Demo.xcodeproj')]);

  const { globAllPackageJsonPaths } = require(join(
    resolve('mobile/node_modules/@expo/metro-config'),
    'build/getWatchFolders.js',
  ));
  assert.deepEqual(
    globAllPackageJsonPaths(root, ['packages/*']).sort(),
    [join(root, 'packages/one/package.json'), join(root, 'packages/two/package.json')],
  );
});

test('source-verified deepmerge 4.3.1 preserves Expo config merge behavior and blocks advisory payload', () => {
  const deepmerge = configRequire('deepmerge');
  assert.equal(configRequire('deepmerge/package.json').version, '4.3.1');
  assert.deepEqual(
    deepmerge({ plugins: [['one', { enabled: true }]], nested: { left: 1 } }, { nested: { right: 2 } }),
    { plugins: [['one', { enabled: true }]], nested: { left: 1, right: 2 } },
  );
  const malicious = JSON.parse('{"session":{"__proto__":{"admin":true}}}');
  const merged = deepmerge({ session: null }, malicious);
  assert.equal(Object.hasOwn(merged.session, 'admin'), false);
  assert.equal(merged.session.admin, undefined);
  assert.equal(Object.getPrototypeOf(merged.session), Object.prototype);
});

test('minimatch 11 preserves Expo fingerprint matching and bounds malicious preprocessing', () => {
  assert.equal(fingerprintRequire('minimatch/package.json').version, '11.0.1');
  const paths = require('@expo/fingerprint/build/utils/Path');
  const matchers = paths.buildPathMatchObjects(['**/node_modules/**', '!packages/kept/**']);
  assert.equal(paths.isIgnoredPathWithMatchObjects('apps/mobile/node_modules/pkg/index.js', matchers), true);
  assert.equal(paths.isIgnoredPathWithMatchObjects('packages/kept/index.js', matchers), false);

  const bounded = vm.runInNewContext(`
    const { Minimatch } = require('minimatch');
    const pattern = ${JSON.stringify('**/../'.repeat(48) + 'target')};
    const matcher = new Minimatch(pattern, { optimizationLevel: 2 });
    matcher.match('target');
  `, { require: fingerprintRequire }, { timeout: 2_000 });
  assert.equal(typeof bounded, 'boolean');
});

test('test-exclude 8 preserves Babel Istanbul include/exclude and glob semantics', async () => {
  assert.equal(require('test-exclude/package.json').version, '8.0.0');
  assert.equal(testExcludeRequire('glob/package.json').version, '14.0.2');
  assert.equal(testExcludeRequire('minimatch/package.json').version, '11.0.1');
  const TestExclude = require('test-exclude');
  const root = join(scratch, 'test-exclude');
  mkdirSync(join(root, 'src'), { recursive: true });
  mkdirSync(join(root, 'test'), { recursive: true });
  writeFileSync(join(root, 'src/app.js'), 'module.exports = 1;');
  writeFileSync(join(root, 'test/app.test.js'), 'module.exports = 1;');
  const exclude = new TestExclude({ cwd: root });
  assert.equal(exclude.shouldInstrument(join(root, 'src/app.js')), true);
  assert.equal(exclude.shouldInstrument(join(root, 'test/app.test.js')), false);
  assert.deepEqual(exclude.globSync(root), ['src/app.js']);
  assert.deepEqual(await exclude.glob(root), ['src/app.js']);

  const babel = require('@babel/core');
  const istanbul = require('babel-plugin-istanbul');
  const transformed = babel.transformSync('export const answer = 42;', {
    filename: join(root, 'src/app.js'),
    babelrc: false,
    configFile: false,
    plugins: [[istanbul, { cwd: root, include: ['**/*.js'] }]],
  });
  assert.match(transformed.code, /cov_/);
});
