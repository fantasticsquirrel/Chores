#!/usr/bin/env node
// Fail-closed admission for security-motivated upstream npm artifacts that are
// intentionally outside an Expo 56 transitive dependency's declared range.
import { lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '..'));

export const ARTIFACTS = Object.freeze({
  glob: {
    version: '14.0.2',
    resolved: 'https://registry.npmjs.org/glob/-/glob-14.0.2.tgz',
    integrity: 'sha512-vfMgTR2djMHPUchsJMLpZlYQvtjVL+mHpEr5wPpoCbQs2vr/FBNK+3Gnl9Ara1DSs4Aeg4eG9HiADb5/rkY/ZA==',
  },
  minimatch: {
    version: '11.0.1',
    resolved: 'https://registry.npmjs.org/minimatch/-/minimatch-11.0.1.tgz',
    integrity: 'sha512-t+Vn6DX4wPCxS23y03C0uhF7S1jpi1GfqPrnlEipCJaA2ykiNbMkVlDutZtmvLfRcUN6R8AYVlzTsQrT4RZoLQ==',
  },
  'node-forge': {
    version: '1.4.2',
    resolved: 'https://registry.npmjs.org/node-forge/-/node-forge-1.4.2.tgz',
    integrity: 'sha512-rRtAR5XLJ8gCKd9du4qrKAsgCG1ObGP4gLeNJMa4vYSeq4bmBMOJk5IHkrviBV0q7uoAJlVd8HEQYQSVUb4FGQ==',
  },
  'test-exclude': {
    version: '8.0.0',
    resolved: 'https://registry.npmjs.org/test-exclude/-/test-exclude-8.0.0.tgz',
    integrity: 'sha512-ZOffsNrXYggvU1mDGHk54I96r26P8SyMjO5slMKSc7+IWmtB/MQKnEC2fP51imB3/pT6YK5cT5E8f+Dd9KdyOQ==',
  },
  zod: {
    version: '4.6.7',
    resolved: 'https://registry.npmjs.org/zod/-/zod-4.6.7.tgz',
    integrity: 'sha512-g8W2D2kU6a8untc053fX1uVBKzM7yqAxW/3zwk83+6RyF2+SKOuV+c0wBDhUwzV1PaGapmZH+rmcUzPf+3CGwg==',
  },
});

export const CONSUMERS = Object.freeze([
  { name: '@expo/cli', version: '56.1.27', dependency: 'glob' },
  { name: '@expo/cli', version: '56.1.27', dependency: 'node-forge' },
  { name: '@expo/cli', version: '56.1.27', dependency: 'zod' },
  { name: '@expo/code-signing-certificates', version: '0.0.6', dependency: 'node-forge' },
  { name: '@expo/config', version: '56.0.15', dependency: 'glob' },
  { name: '@expo/config-plugins', version: '56.0.17', dependency: 'glob' },
  { name: '@expo/fingerprint', version: '0.19.10', dependency: 'glob' },
  { name: '@expo/fingerprint', version: '0.19.10', dependency: 'minimatch' },
  { name: '@expo/metro-config', version: '56.0.20', dependency: 'glob' },
  { name: 'babel-plugin-istanbul', version: '6.1.1', dependency: 'test-exclude' },
  { name: 'test-exclude', version: '8.0.0', dependency: 'glob' },
  { name: 'test-exclude', version: '8.0.0', dependency: 'minimatch' },
]);

function fail(message) {
  throw new Error(`Secure upstream artifact admission rejected: ${message}`);
}

function plain(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function readJson(path) {
  const value = JSON.parse(readFileSync(path, 'utf8'));
  if (!plain(value)) fail(`expected a plain JSON object at ${path}.`);
  return value;
}

function packageNameForLockPath(path) {
  const parts = path.split('/');
  const nodeModules = parts.lastIndexOf('node_modules');
  if (nodeModules < 0 || !parts[nodeModules + 1]) return null;
  return parts[nodeModules + 1].startsWith('@')
    ? `${parts[nodeModules + 1]}/${parts[nodeModules + 2] ?? ''}`
    : parts[nodeModules + 1];
}

function expectedOverrides() {
  return {
    '@expo/cli': { glob: '14.0.2', 'node-forge': '1.4.2', zod: '4.6.7' },
    '@expo/code-signing-certificates': { 'node-forge': '1.4.2' },
    '@expo/config': { deepmerge: '4.3.1', glob: '14.0.2' },
    '@expo/config-plugins': { glob: '14.0.2' },
    '@expo/fingerprint': { glob: '14.0.2', minimatch: '11.0.1' },
    '@expo/metro-config': { glob: '14.0.2' },
    'babel-plugin-istanbul': {
      'test-exclude': { '.': '8.0.0', glob: '14.0.2', minimatch: '11.0.1' },
    },
  };
}

export function validateSecureArtifactMetadata({ manifest, lock }) {
  if (!plain(manifest) || !plain(manifest.overrides)) fail('root package overrides are missing.');
  const expected = expectedOverrides();
  for (const [parent, value] of Object.entries(expected)) {
    if (JSON.stringify(manifest.overrides[parent]) !== JSON.stringify(value)) {
      fail(`override changed for ${parent}.`);
    }
  }
  if (!plain(lock) || lock.lockfileVersion !== 3 || !plain(lock.packages)) {
    fail('expected an npm v3 lockfile.');
  }
  for (const [name, artifact] of Object.entries(ARTIFACTS)) {
    if (!artifact.integrity.startsWith('sha512-')) fail(`${name} integrity has not been reviewed and pinned.`);
    const entries = Object.entries(lock.packages).filter(([path, value]) =>
      packageNameForLockPath(path) === name
      && value.version === artifact.version
      && value.resolved === artifact.resolved
      && value.integrity === artifact.integrity);
    if (entries.length === 0) fail(`pinned ${name}@${artifact.version} artifact is absent from the lockfile.`);
  }
  return true;
}

function workspaceSymlink(path, repositoryRoot) {
  const target = realpathSync(path);
  const allowed = new Set([
    realpathSync(join(repositoryRoot, 'frontend')),
    realpathSync(join(repositoryRoot, 'mobile')),
    ...readdirSync(join(repositoryRoot, 'packages'), { withFileTypes: true })
      .filter(entry => entry.isDirectory() && !entry.isSymbolicLink())
      .map(entry => realpathSync(join(repositoryRoot, 'packages', entry.name))),
  ]);
  if (!allowed.has(target)) {
    fail(`installed dependency symlink rejected: ${path}.`);
  }
}

function packageDirectories(modules, output, repositoryRoot) {
  if (lstatSync(modules).isSymbolicLink()) fail(`node_modules symlink rejected: ${modules}.`);
  for (const entry of readdirSync(modules, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const path = join(modules, entry.name);
    if (entry.isSymbolicLink()) { workspaceSymlink(path, repositoryRoot); continue; }
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('@')) {
      for (const scoped of readdirSync(path, { withFileTypes: true })) {
        const scopedPath = join(path, scoped.name);
        if (scoped.isSymbolicLink()) { workspaceSymlink(scopedPath, repositoryRoot); continue; }
        if (scoped.isDirectory()) visitPackage(scopedPath, output, repositoryRoot);
      }
    } else {
      visitPackage(path, output, repositoryRoot);
    }
  }
}

function visitPackage(path, output, repositoryRoot) {
  const packageJson = join(path, 'package.json');
  try {
    const metadata = readJson(packageJson);
    if (typeof metadata.name === 'string' && typeof metadata.version === 'string') {
      output.push({ path, metadata });
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const nested = join(path, 'node_modules');
  try {
    packageDirectories(nested, output, repositoryRoot);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

function installedPackageDirectories(repositoryRoot) {
  const output = [];
  for (const base of ['', 'frontend', 'mobile']) {
    const modules = join(repositoryRoot, base, 'node_modules');
    try { packageDirectories(modules, output, repositoryRoot); } catch (error) {
      if (base === '' || error.code !== 'ENOENT') throw error;
    }
  }
  const packages = join(repositoryRoot, 'packages');
  for (const entry of readdirSync(packages, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) fail(`workspace symlink rejected: ${join(packages, entry.name)}.`);
    if (!entry.isDirectory()) continue;
    const modules = join(packages, entry.name, 'node_modules');
    try { packageDirectories(modules, output, repositoryRoot); } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return output;
}

function resolvedPackageRoot(consumerPath, dependency) {
  const consumerRequire = createRequire(join(consumerPath, 'package.json'));
  const main = realpathSync(consumerRequire.resolve(dependency));
  let current = dirname(main);
  while (current !== dirname(current)) {
    try {
      const metadata = readJson(join(current, 'package.json'));
      if (metadata.name === dependency) return { path: current, metadata };
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    current = dirname(current);
  }
  fail(`${dependency} resolved without a matching package root from ${consumerPath}.`);
}

export function verifyInstalledSecureArtifacts(repositoryRoot = root) {
  const manifest = readJson(join(repositoryRoot, 'package.json'));
  const lock = readJson(join(repositoryRoot, 'package-lock.json'));
  validateSecureArtifactMetadata({ manifest, lock });
  const installed = installedPackageDirectories(repositoryRoot);
  const evidence = [];
  for (const consumer of CONSUMERS) {
    const matches = installed.filter(entry =>
      entry.metadata.name === consumer.name && entry.metadata.version === consumer.version);
    if (matches.length !== 1) {
      fail(`expected one installed ${consumer.name}@${consumer.version} consumer; found ${matches.length}.`);
    }
    const dependency = resolvedPackageRoot(matches[0].path, consumer.dependency);
    const artifact = ARTIFACTS[consumer.dependency];
    if (dependency.metadata.version !== artifact.version) {
      fail(`${consumer.name}@${consumer.version} resolved ${consumer.dependency}@${dependency.metadata.version}.`);
    }
    const rel = relative(repositoryRoot, dependency.path).replaceAll('\\', '/');
    if (!rel || rel.startsWith('..') || isAbsolute(rel)) fail(`${consumer.dependency} resolved outside the repository.`);
    const locked = lock.packages[rel];
    if (!plain(locked) || locked.version !== artifact.version
      || locked.resolved !== artifact.resolved || locked.integrity !== artifact.integrity) {
      fail(`${consumer.name} resolved ${consumer.dependency} without its exact lock artifact.`);
    }
    evidence.push({ consumer: `${consumer.name}@${consumer.version}`, dependency: `${consumer.dependency}@${artifact.version}`, path: rel });
  }
  return evidence;
}

function main() {
  const evidence = verifyInstalledSecureArtifacts();
  console.log(JSON.stringify({ status: 'secure-upstream-artifacts-verified', consumers: evidence }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { main(); } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
