import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const text = (path) => readFileSync(new URL(path, root), 'utf8');
const json = (path) => JSON.parse(text(path));

test('pure Family Tree core has a nonempty explicit root and CI gate', () => {
  const scripts = json('package.json').scripts;
  assert.equal(
    scripts['family-tree-core:gate'],
    'npm run typecheck --workspace @family-manager/family-tree-core && npm run test --workspace @family-manager/family-tree-core',
  );
  assert.match(text('.github/workflows/ci-quality-gates.yml'), /run: npm run family-tree-core:gate/);
  assert.match(text('packages/family-tree-core/vitest.config.ts'), /passWithNoTests:\s*false/);
  assert.match(text('packages/family-tree-core/vitest.config.ts'), /src\/\*\*\/\*\.test\.ts/);
});
