import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

// The working copy is insufficient proof: global ignore/normalization rules can
// omit or rewrite required vendored bytes in a clean checkout.
test('Git index preserves every source-backport file with its approved exact bytes', () => {
  const manifest = JSON.parse(readFileSync('vendor/security-backports/manifest.json', 'utf8'));
  for (const [name, entry] of Object.entries(manifest)) {
    for (const [path, expected] of Object.entries(entry.patched)) {
      const target = `vendor/security-backports/${name}/${path}`;
      const blob = spawnSync('git', ['show', `:${target}`]);
      assert.equal(blob.status, 0, `Required backport file missing from Git index: ${target}`);
      assert.equal(createHash('sha256').update(blob.stdout).digest('hex'), expected,
        `Git-normalized backport bytes differ: ${target}`);
    }
  }
});
