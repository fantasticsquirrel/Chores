#!/usr/bin/env node
// Fail-closed source backport installer. Versions and npm audit exceptions stay unchanged.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, lstatSync, copyFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = resolve(process.env.SECURITY_BACKPORT_ROOT || dirname(fileURLToPath(import.meta.url)), process.env.SECURITY_BACKPORT_ROOT ? '.' : '..');
const vendor = resolve(dirname(fileURLToPath(import.meta.url)), '../vendor/security-backports');
const manifest = JSON.parse(readFileSync(join(vendor, 'manifest.json'), 'utf8'));
const fixture = JSON.parse(readFileSync(new URL('./fixtures/node-forge-nested-digest.json', import.meta.url)));
const checkOnly = process.argv.includes('--check');
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
function files(path, prefix = '') {
  const result = {};
  for (const entry of readdirSync(path, {withFileTypes: true})) {
    const rel = prefix + entry.name;
    if (entry.isSymbolicLink()) throw new Error(`Symlink rejected: ${path}/${entry.name}`);
    if (entry.isDirectory()) Object.assign(result, files(join(path, entry.name), rel + '/'));
    else if (entry.isFile()) result[rel] = hash(join(path, entry.name));
    else throw new Error(`Nonregular file rejected: ${rel}`);
  }
  return result;
}
function matches(actual, expected) {
  return Object.keys(actual).length === Object.keys(expected).length && Object.entries(expected).every(([path, digest]) => actual[path] === digest);
}
// Enumerate the actual installation, including nested dependency copies.
function packages(modules, output = []) {
  for (const entry of readdirSync(modules, {withFileTypes: true})) {
    if (entry.name.startsWith('.')) continue;
    const path = join(modules, entry.name);
    if (entry.name.startsWith('@') && entry.isDirectory()) { packages(path, output); continue; }
    if (Object.hasOwn(manifest, entry.name) && entry.isSymbolicLink()) throw new Error(`Affected package symlink rejected: ${path}`);
    if (!entry.isDirectory()) continue;
    if (Object.hasOwn(manifest, entry.name)) output.push([entry.name, path]);
    try {
      const nested = join(path, 'node_modules'); const stat = lstatSync(nested);
      if (stat.isSymbolicLink()) throw new Error(`Installed node_modules symlink rejected: ${nested}`);
      if (stat.isDirectory()) packages(nested, output);
    }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return output;
}
function installedPackages() {
  const installed = [];
  function scan(base, required = false) {
    try {
      if (lstatSync(base).isSymbolicLink()) throw new Error(`Workspace symlink rejected: ${base}`);
      const modules = join(base, 'node_modules'); const stat = lstatSync(modules);
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`Installed node_modules symlink/non-directory rejected: ${modules}`);
      packages(modules, installed);
    } catch (error) { if (required || error.code !== 'ENOENT') throw error; }
  }
  scan(root, true);
  for (const workspace of ['frontend','mobile']) scan(join(root, workspace));
  const shared = join(root, 'packages');
  try {
    if (lstatSync(shared).isSymbolicLink()) throw new Error(`Workspace symlink rejected: ${shared}`);
    for (const entry of readdirSync(shared, {withFileTypes:true})) {
      if (entry.isSymbolicLink()) throw new Error(`Workspace symlink rejected: ${join(shared,entry.name)}`);
      if (entry.isDirectory()) scan(join(shared, entry.name));
    }
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  return installed;
}
function behavior(name, path) {
  const api = require(path);
  if (name === 'braces') {
    for (const method of ['compile','expand','stringify','parse']) {
      assert.throws(() => api[method]('{'.repeat(4000) + 'a,b' + '}'.repeat(4000)), error => error.name === 'SyntaxError' && /nesting limit/.test(error.message));
    }
    assert.equal(api.compile('{a,b}'), '(a|b)');
  } else {
    const key = api.pki.rsa.setPublicKey(new api.jsbn.BigInteger(fixture.modulus, 16), new api.jsbn.BigInteger('3'));
    const md = api.md.sha256.create(); md.update(fixture.message);
    assert.throws(() => key.verify(md.digest().getBytes(), api.util.hexToBytes(fixture.signature), undefined, {_skipPaddingChecks: true}), /valid RSASSA-PKCS1-v1_5 DigestInfo/);
  }
}
try {
  for (const [name, entry] of Object.entries(manifest)) {
    if (!matches(files(join(vendor, name)), entry.patched)) throw new Error(`Vendor integrity mismatch: ${name}`);
  }
  const installed = installedPackages();
  for (const name of Object.keys(manifest)) if (!installed.some(([n]) => n === name)) throw new Error(`Required installed package missing: ${name}`);
  // Validate every copy before mutating any copy.
  for (const [name, path] of installed) {
    const entry = manifest[name]; const actual = files(path);
    const version = JSON.parse(readFileSync(join(path, 'package.json'), 'utf8')).version;
    if (version !== entry.version || (!matches(actual, entry.patched) && (checkOnly || !matches(actual, entry.original)))) throw new Error(`Installed integrity mismatch or unpatched source: ${name} at ${path}`);
  }
  if (!checkOnly) for (const [name, path] of installed) {
    const entry = manifest[name];
    for (const rel of Object.keys(entry.original)) if (!Object.hasOwn(entry.patched, rel)) {
      try { unlinkSync(join(path, rel)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    for (const rel of Object.keys(entry.patched)) {
      mkdirSync(dirname(join(path, rel)), {recursive: true});
      copyFileSync(join(vendor, name, rel), join(path, rel));
    }
  }
  for (const [name, path] of installed) {
    if (!matches(files(path), manifest[name].patched)) throw new Error(`Patched integrity mismatch: ${path}`);
    behavior(name, path);
  }
  console.log(JSON.stringify({status:'source-backports-verified', packages:installed.map(([name,path])=>({name,path,version:manifest[name].version})), note:'Version-based npm audit advisories remain; no existing exception is widened.'}));
} catch (error) {
  console.error(`Security backport rejected: ${error.message}`); process.exitCode = 1;
}
