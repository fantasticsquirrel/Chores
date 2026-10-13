import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const helper = fileURLToPath(new URL('../frontend/scripts/playwright-smoke-runtime.sh', import.meta.url));
const invoke = (env) => spawnSync('bash', ['-c', 'source "$1"; create_playwright_smoke_directory', 'smoke-test', helper], { encoding: 'utf8', env });

test('smoke directory uses configured private scratch with a safety marker', () => {
  assert.ok(process.env.TMPDIR, 'this test requires configured TMPDIR');
  const owned = mkdtempSync(join(tmpdir(), 'family-tree-smoke-runtime-test-'));
  try {
    const scratch = join(owned, 'scratch with spaces');
    mkdirSync(scratch, { mode: 0o700 });
    const result = invoke({ ...process.env, TMPDIR: scratch });
    assert.equal(result.status, 0, result.stderr);
    const directory = result.stdout.trim();
    assert.equal(resolve(directory, '..'), scratch);
    assert.match(directory, /family-manager-playwright-[^/]+$/);
    assert.equal(statSync(directory).mode & 0o777, 0o700);
    assert.equal(statSync(join(directory, '.family-manager-smoke')).mode & 0o777, 0o600);
  } finally {
    rmSync(owned, { recursive: true, force: true });
  }
});

test('missing scratch fails closed instead of falling back to system temp', () => {
  const env = { ...process.env };
  delete env.TMPDIR;
  const result = invoke(env);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /TMPDIR/);
  assert.equal(result.stdout, '');
});
