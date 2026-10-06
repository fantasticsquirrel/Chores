import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { mkdtempSync, cpSync, writeFileSync, rmSync, mkdirSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const script = resolve('scripts/security-backports.mjs');
const vendor = resolve('vendor/security-backports');
const seed = mkdtempSync(join(tmpdir(), 'security-backport-test-deps-'));
const dependencies = spawnSync('npm',['install','--prefix',seed,'--ignore-scripts','--no-audit','--no-fund','fill-range@7.1.1'],{encoding:'utf8',timeout:60000});
assert.equal(dependencies.status,0,dependencies.stderr);
after(()=>rmSync(seed,{recursive:true,force:true}));
function trial(change, expected) {
  const root = mkdtempSync(join(tmpdir(), 'security-backport-test-'));
  try {
    cpSync(join(seed,'node_modules'),join(root,'node_modules'),{recursive:true});
    for (const name of ['braces','node-forge']) cpSync(join(vendor,name),join(root,'node_modules',name),{recursive:true});
    change(root);
    const run = spawnSync(process.execPath,[script,'--check'],{env:{...process.env,SECURITY_BACKPORT_ROOT:root},encoding:'utf8'});
    assert.equal(run.status,1);
    assert.match(run.stderr,expected);
  } finally { rmSync(root,{recursive:true,force:true}); }
}
test('rejects altered installed source', () => trial(root => writeFileSync(join(root,'node_modules/braces/lib/compile.js'),'module.exports = () => "unsafe";'), /integrity mismatch/));
test('rejects an extra unreviewed source file', () => trial(root => writeFileSync(join(root,'node_modules/node-forge/lib/unreviewed.js'),'unsafe'), /integrity mismatch/));
test('rejects an unexpected version', () => trial(root => writeFileSync(join(root,'node_modules/braces/package.json'),'{"version":"3.0.4"}'), /integrity mismatch/));
test('rejects missing package', () => trial(root => rmSync(join(root,'node_modules/node-forge'),{recursive:true}), /Required installed package missing/));
test('rejects affected package symlinks', () => trial(root => {rmSync(join(root,'node_modules/node-forge'),{recursive:true});symlinkSync(join(vendor,'node-forge'),join(root,'node_modules/node-forge'));}, /symlink rejected/));
test('checks nested dependency copies, not just the root copy', () => trial(root => {const nested=join(root,'node_modules/outer/node_modules/braces');mkdirSync(join(root,'node_modules/outer/node_modules'),{recursive:true});cpSync(join(vendor,'braces'),nested,{recursive:true});writeFileSync(join(nested,'lib/compile.js'),'unsafe');}, /integrity mismatch/));
for (const workspace of ['frontend','mobile','packages/family-api']) {
  test(`rejects tampered non-hoisted workspace copy in ${workspace}`,()=>trial(root=>{
    const modules=join(root,workspace,'node_modules');mkdirSync(modules,{recursive:true});
    cpSync(join(vendor,'braces'),join(modules,'braces'),{recursive:true});
    writeFileSync(join(modules,'braces/lib/compile.js'),'unsafe workspace source');
  }, /integrity mismatch/));
}
