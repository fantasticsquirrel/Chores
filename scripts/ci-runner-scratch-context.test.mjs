import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workflow = readFileSync(new URL('../.github/workflows/ci-quality-gates.yml', import.meta.url), 'utf8');

test('runner scratch is configured in step context, not workflow or job env', () => {
  assert.doesNotMatch(workflow.split('\njobs:')[0], /runner\.temp/);
  for (const name of ['web-mobile-quality', 'backend-quality']) {
    const job = workflow.split(`  ${name}:`)[1].split(/\n  [a-z][a-z-]+:/)[0];
    assert.doesNotMatch(job.split('    steps:')[0], /runner\.temp/);
    assert.match(job, /- name: Configure runner scratch\s+env:\s+TMPDIR: \$\{\{ runner\.temp \}\}/);
    assert.match(job, /test -d "\$TMPDIR"/);
    assert.match(job, /printf 'TMPDIR=%s\\n' "\$TMPDIR" >> "\$GITHUB_ENV"/);
    assert.ok(job.indexOf('Configure runner scratch') < job.indexOf('Check out repository'));
  }
});
