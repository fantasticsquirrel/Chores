import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('backend CI retains immutable predecessor history for actual upgrade API fixtures', () => {
  const workflow = readFileSync(new URL('../.github/workflows/ci-quality-gates.yml', import.meta.url), 'utf8');
  const backend = workflow.split('  backend-quality:')[1];
  assert.ok(backend, 'backend quality job must exist');
  assert.match(backend, /uses: actions\/checkout@v4\s+with:\s+fetch-depth: 0/);
  assert.match(backend, /run: pytest backend\/tests -q/);
});
