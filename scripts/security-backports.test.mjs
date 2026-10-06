import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const modules = process.env.SECURITY_MODULES_ROOT || resolve('node_modules');
const braces = require(resolve(modules, 'braces'));
const forge = require(resolve(modules, 'node-forge'));
const fixture = JSON.parse(readFileSync(new URL('./fixtures/node-forge-nested-digest.json', import.meta.url)));
const nestingError = error => error.name === 'SyntaxError' && /nesting limit/.test(error.message);

for (const method of ['compile', 'expand', 'stringify', 'parse']) {
  for (const [open, close] of [['{', '}'], ['(', ')']]) {
    test(`braces.${method} rejects deep ${open} without stack exhaustion`, () => {
      assert.throws(() => braces[method](open.repeat(4000) + 'a,b' + close.repeat(4000)), nestingError);
    });
  }
}
for (const method of ['compile', 'expand', 'stringify']) {
  test(`braces.${method} rejects a deep caller-supplied AST`, () => {
    let ast = { type: 'text', value: 'a' };
    for (let i = 0; i < 10000; i++) ast = { type: 'root', nodes: [ast] };
    assert.throws(() => braces[method](ast), nestingError);
  });
}
test('braces retains ordinary expansion and compilation', () => {
  assert.equal(braces.compile('x/{a,b}/{1..3}'), 'x/(a|b)/([1-3])');
  assert.deepEqual(braces.expand('x/{a,b}/{1..3}'), ['x/a/1','x/a/2','x/a/3','x/b/1','x/b/2','x/b/3']);
  assert.equal(braces.stringify(braces.parse('x/{a,b}')), 'x/{a,b}');
});
function rejectsNestedDigest(api) {
  const key = api.pki.rsa.setPublicKey(new api.jsbn.BigInteger(fixture.modulus, 16), new api.jsbn.BigInteger('3'));
  const md = api.md.sha256.create(); md.update(fixture.message);
  const signature = api.util.hexToBytes(fixture.signature);
  // Official upstream test isolates ASN.1 validation using the upstream test
  // padding flag. Normal verification must also reject this signature.
  assert.throws(() => key.verify(md.digest().getBytes(), signature, undefined, {_skipPaddingChecks: true}), /valid RSASSA-PKCS1-v1_5 DigestInfo/);
  assert.throws(() => key.verify(md.digest().getBytes(), signature));
}
test('forge rejects the official nested DigestAlgorithm regression', () => rejectsNestedDigest(forge));
for (const bundle of ['forge.min.js', 'forge.all.min.js']) {
  test(`forge browser bundle ${bundle} rejects malformed DigestInfo`, () => {
    const vm = require('node:vm');
    const context = {window: {}, jQuery: null, console, setTimeout, clearTimeout};
    vm.runInNewContext(readFileSync(resolve(modules, 'node-forge/dist', bundle), 'utf8'), context);
    rejectsNestedDigest(context.window.forge);
  });
}
test('forge retains valid RSA signing and verification', () => {
  const pair = forge.pki.rsa.generateKeyPair({bits: 512, e: 65537});
  const md = forge.md.sha256.create(); md.update('valid signature');
  const signature = pair.privateKey.sign(md);
  const digest = forge.md.sha256.create(); digest.update('valid signature');
  assert.equal(pair.publicKey.verify(digest.digest().getBytes(), signature), true);
});
