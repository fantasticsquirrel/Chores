import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const mobile = JSON.parse(readFileSync(new URL('../mobile/package.json', import.meta.url), 'utf8'));

test('the canonical mobile gate uses the installed Expo CLI without nesting npx', () => {
  assert.equal(
    root.scripts['mobile:gate'],
    'npm run mobile:typecheck && npm run mobile:test && npm run check:dependencies --workspace mobile',
  );
  assert.equal(mobile.scripts['check:dependencies'], 'expo install --check');
});
