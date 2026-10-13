import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const frontend = new URL('../frontend/', import.meta.url);

test('frontend build typechecks actual app and tooling, not the empty reference root', () => {
  const { scripts } = JSON.parse(readFileSync(new URL('package.json', frontend), 'utf8'));
  assert.equal(scripts.build, 'tsc --noEmit -p tsconfig.app.json && tsc --noEmit -p tsconfig.node.json && vite build');
  const config = JSON.parse(readFileSync(new URL('tsconfig.app.json', frontend), 'utf8'));
  assert.ok(config.compilerOptions.types.includes('vitest/globals'));
  assert.ok(config.include.includes('src'));
});
