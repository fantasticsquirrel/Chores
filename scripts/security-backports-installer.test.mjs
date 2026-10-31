import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { mkdtempSync, cpSync, readFileSync, writeFileSync, rmSync, mkdirSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { runSecurityBackports } from './security-backports.mjs';

const vendor = resolve('vendor/security-backports');
const seed = mkdtempSync(join(tmpdir(), 'security-backport-test-deps-'));
mkdirSync(join(seed, 'node_modules'), { recursive: true });
cpSync(join(vendor, 'braces'), join(seed, 'node_modules/braces'), { recursive: true });
cpSync(resolve('node_modules/deepmerge'), join(seed, 'node_modules/deepmerge'), { recursive: true });
for (const name of ['fill-range', 'to-regex-range', 'is-number']) {
  cpSync(resolve('node_modules', name), join(seed, 'node_modules', name), { recursive: true });
}

function replaceOnce(source, before, after, path) {
  assert.notEqual(source.indexOf(before), -1, `Expected reviewed patch hunk in ${path}`);
  assert.equal(source.indexOf(before), source.lastIndexOf(before), `Duplicate reviewed patch hunk in ${path}`);
  return source.replace(before, after);
}

// Reconstruct the exact upstream files from the already verified overlay so
// this installer regression is deterministic and never downloads test input.
for (const [path, indent] of [['index.js', ''], ['dist/cjs.js', ''], ['dist/umd.js', '\t']]) {
  const target = join(seed, 'node_modules/deepmerge', path);
  let source = readFileSync(target, 'utf8');
  source = replaceOnce(source,
    `\n${indent}function propertyIsForbidden(key) {\n${indent}\treturn key === '__proto__'\n${indent}}\n`,
    '', path);
  source = replaceOnce(source,
    `${indent}\t\t\tif (propertyIsForbidden(key)) {\n${indent}\t\t\t\treturn\n${indent}\t\t\t}\n`,
    '', path);
  source = replaceOnce(source,
    'if (propertyIsForbidden(key) || propertyIsUnsafe(target, key))',
    'if (propertyIsUnsafe(target, key))', path);
  writeFileSync(target, source);
}
assert.equal(runSecurityBackports({ repositoryRoot: seed }).status, 'source-backports-verified');
after(()=>rmSync(seed,{recursive:true,force:true}));
function trial(change, expected) {
  const root = mkdtempSync(join(tmpdir(), 'security-backport-test-'));
  try {
    cpSync(join(seed,'node_modules'),join(root,'node_modules'),{recursive:true});
    cpSync(join(vendor,'braces'),join(root,'node_modules/braces'),{recursive:true});
    change(root);
    assert.throws(() => runSecurityBackports({ repositoryRoot: root, checkOnly: true }), expected);
  } finally { rmSync(root,{recursive:true,force:true}); }
}
test('rejects altered installed source', () => trial(root => writeFileSync(join(root,'node_modules/braces/lib/compile.js'),'module.exports = () => "unsafe";'), /integrity mismatch/));
test('rejects an extra unreviewed source file', () => trial(root => writeFileSync(join(root,'node_modules/deepmerge/unreviewed.js'),'unsafe'), /integrity mismatch/));
test('rejects an unexpected version', () => trial(root => writeFileSync(join(root,'node_modules/braces/package.json'),'{"version":"3.0.4"}'), /integrity mismatch/));
test('rejects missing package', () => trial(root => rmSync(join(root,'node_modules/deepmerge'),{recursive:true}), /Required installed package missing/));
test('rejects affected package symlinks', () => trial(root => {rmSync(join(root,'node_modules/deepmerge'),{recursive:true});symlinkSync(join(vendor,'deepmerge'),join(root,'node_modules/deepmerge'));}, /symlink rejected/));
test('checks nested dependency copies, not just the root copy', () => trial(root => {const nested=join(root,'node_modules/outer/node_modules/braces');mkdirSync(join(root,'node_modules/outer/node_modules'),{recursive:true});cpSync(join(vendor,'braces'),nested,{recursive:true});writeFileSync(join(nested,'lib/compile.js'),'unsafe');}, /integrity mismatch/));
for (const workspace of ['frontend','mobile','packages/family-api']) {
  test(`rejects tampered non-hoisted workspace copy in ${workspace}`,()=>trial(root=>{
    const modules=join(root,workspace,'node_modules');mkdirSync(modules,{recursive:true});
    cpSync(join(vendor,'braces'),join(modules,'braces'),{recursive:true});
    writeFileSync(join(modules,'braces/lib/compile.js'),'unsafe workspace source');
  }, /integrity mismatch/));
}
