import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const text = (path) => readFileSync(new URL(path, root), 'utf8');

test('shared API CI discovers nested contracts and installs their real Python producer', () => {
  const scripts = JSON.parse(text('package.json')).scripts;
  assert.equal(scripts['shared-api:gate'], 'vitest run packages/family-api/src --environment node --maxWorkers=2');
  const workflow = text('.github/workflows/ci-quality-gates.yml');
  const webJob = workflow.slice(workflow.indexOf('  web-mobile-quality:'), workflow.indexOf('  backend-quality:'));
  assert.match(webJob, /Set up Python for executable shared contracts/);
  assert.match(webJob, /pip install -e backend/);
  assert.match(webJob, /run: npm run shared-api:gate/);
  assert.ok(webJob.indexOf('pip install -e backend') < webJob.indexOf('run: npm run shared-api:gate'));
});
