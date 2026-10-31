#!/usr/bin/env node
// Fail-closed source backport installer. Versions and npm audit exceptions stay unchanged.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, lstatSync, copyFileSync, mkdirSync, realpathSync, unlinkSync } from 'node:fs';
import { resolve, dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const vendor = resolve(dirname(fileURLToPath(import.meta.url)), '../vendor/security-backports');
const manifest = JSON.parse(readFileSync(join(vendor, 'manifest.json'), 'utf8'));
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
function workspaceLayout(root) {
  const rootManifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  if (!Array.isArray(rootManifest.workspaces)) throw new Error('Expected an explicit workspace array');
  const targets = [];
  for (const pattern of rootManifest.workspaces) {
    if (typeof pattern !== 'string' || !pattern || isAbsolute(pattern)
      || pattern.includes('\\') || pattern.split('/').some(part => !part || part === '.' || part === '..')) {
      throw new Error(`Invalid workspace pattern: ${String(pattern)}`);
    }
    if (pattern.endsWith('/*')) {
      const parent = join(root, pattern.slice(0, -2));
      if (lstatSync(parent).isSymbolicLink()) throw new Error(`Workspace symlink rejected: ${parent}`);
      for (const entry of readdirSync(parent, { withFileTypes: true })) {
        const path = join(parent, entry.name);
        if (entry.isSymbolicLink()) throw new Error(`Workspace symlink rejected: ${path}`);
        if (entry.isDirectory()) targets.push(realpathSync(path));
      }
    } else {
      if (pattern.includes('*')) throw new Error(`Unsupported workspace pattern: ${pattern}`);
      const path = join(root, pattern);
      if (lstatSync(path).isSymbolicLink()) throw new Error(`Workspace symlink rejected: ${path}`);
      targets.push(realpathSync(path));
    }
  }
  if (new Set(targets).size !== targets.length) throw new Error('Duplicate workspace target');
  const links = new Map();
  for (const target of targets) {
    const metadata = JSON.parse(readFileSync(join(target, 'package.json'), 'utf8'));
    if (typeof metadata.name !== 'string') throw new Error(`Workspace package name missing: ${target}`);
    const parts = metadata.name.split('/');
    if ((metadata.name.startsWith('@') && parts.length !== 2)
      || (!metadata.name.startsWith('@') && parts.length !== 1)
      || parts.some(part => !part || part === '.' || part === '..')) {
      throw new Error(`Invalid workspace package name: ${metadata.name}`);
    }
    const link = resolve(root, 'node_modules', ...parts);
    if (links.has(link)) throw new Error(`Duplicate workspace package link: ${metadata.name}`);
    links.set(link, target);
  }
  return { targets, links };
}

function workspaceTarget(path, workspaces) {
  const target = workspaces.links.get(resolve(path));
  return target && realpathSync(path) === target ? target : null;
}

// Enumerate the actual installation, including nested dependency copies and
// dependency trees reached through exact npm workspace links.
function packages(modules, output, workspaces, seenModules) {
  const stat = lstatSync(modules);
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`Installed node_modules symlink/non-directory rejected: ${modules}`);
  const canonicalModules = realpathSync(modules);
  if (seenModules.has(canonicalModules)) return output;
  seenModules.add(canonicalModules);
  for (const entry of readdirSync(modules, {withFileTypes: true})) {
    if (entry.name.startsWith('.')) continue;
    const path = join(modules, entry.name);
    if (entry.isSymbolicLink()) {
      const target = workspaceTarget(path, workspaces);
      if (!target) throw new Error(`Installed package symlink rejected: ${path}`);
      try { packages(join(target, 'node_modules'), output, workspaces, seenModules); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      continue;
    }
    if (entry.name.startsWith('@') && entry.isDirectory()) { packages(path, output, workspaces, seenModules); continue; }
    if (!entry.isDirectory()) continue;
    if (Object.hasOwn(manifest, entry.name)) output.push([entry.name, path]);
    try {
      packages(join(path, 'node_modules'), output, workspaces, seenModules);
    }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return output;
}
function installedPackages(root) {
  const installed = [];
  const workspaces = workspaceLayout(root);
  const seenModules = new Set();
  function scan(base, required = false) {
    try {
      if (lstatSync(base).isSymbolicLink()) throw new Error(`Workspace symlink rejected: ${base}`);
      packages(join(base, 'node_modules'), installed, workspaces, seenModules);
    } catch (error) { if (required || error.code !== 'ENOENT') throw error; }
  }
  scan(root, true);
  for (const workspace of workspaces.targets) scan(workspace);
  return installed;
}
function behavior(name, path) {
  const api = require(path);
  if (name === 'braces') {
    for (const method of ['compile','expand','stringify','parse']) {
      assert.throws(() => api[method]('{'.repeat(4000) + 'a,b' + '}'.repeat(4000)), error => error.name === 'SyntaxError' && /nesting limit/.test(error.message));
    }
    assert.equal(api.compile('{a,b}'), '(a|b)');
  } else if (name === 'deepmerge') {
    const cases = [
      [Object.assign(Object.create(null), {debug:false}), JSON.parse('{"__proto__":{"isAdmin":true}}'), value => value],
      [{session:null}, JSON.parse('{"session":{"__proto__":{"isAdmin":true}}}'), value => value.session],
      [JSON.parse('{"__proto__":{"isAdmin":true},"debug":false}'), {verbose:true}, value => value],
      [{list:[]}, JSON.parse('{"list":[{"__proto__":{"isAdmin":true}}]}'), value => value.list[0]],
    ];
    for (const [target, source, selected] of cases) {
      const value = selected(api(target, source));
      assert.equal(Object.getPrototypeOf(value), Object.prototype);
      assert.equal(value.isAdmin, undefined);
      assert.equal(Object.hasOwn(value, '__proto__'), false);
    }
    assert.deepEqual(api({nested:{left:1}}, {nested:{right:2}}), {nested:{left:1,right:2}});
  } else throw new Error(`Missing source-backport behavior proof: ${name}`);
}
export function runSecurityBackports({repositoryRoot = defaultRoot, checkOnly = false} = {}) {
  const root = resolve(repositoryRoot);
  for (const [name, entry] of Object.entries(manifest)) {
    const expected = entry.overlay
      ? Object.fromEntries(entry.overlay.map(path => [path, entry.patched[path]]))
      : entry.patched;
    if (!matches(files(join(vendor, name)), expected)) throw new Error(`Vendor integrity mismatch: ${name}`);
  }
  const installed = installedPackages(root);
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
    for (const rel of entry.overlay || Object.keys(entry.patched)) {
      mkdirSync(dirname(join(path, rel)), {recursive: true});
      copyFileSync(join(vendor, name, rel), join(path, rel));
    }
  }
  for (const [name, path] of installed) {
    if (!matches(files(path), manifest[name].patched)) throw new Error(`Patched integrity mismatch: ${path}`);
    behavior(name, path);
  }
  return {status:'source-backports-verified', packages:installed.map(([name,path])=>({name,path,version:manifest[name].version})), note:'Version-based npm audit advisories remain; no existing exception is widened.'};
}

function main() {
  const repositoryRoot = process.env.SECURITY_BACKPORT_ROOT || defaultRoot;
  console.log(JSON.stringify(runSecurityBackports({
    repositoryRoot,
    checkOnly: process.argv.includes('--check'),
  })));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { main(); } catch (error) {
    console.error(`Security backport rejected: ${error.message}`); process.exitCode = 1;
  }
}
