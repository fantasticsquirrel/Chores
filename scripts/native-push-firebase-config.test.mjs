import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
const require = createRequire(import.meta.url);

test('native Firebase build configuration accepts only a supplied matching Android app', () => {
  const config = require('../mobile/app.config.js');
  const base = require('../mobile/app.json').expo;
  const previous = process.env.GOOGLE_SERVICES_JSON;
  const dir = mkdtempSync(join(tmpdir(), 'fm-push-config-test-'));
  try {
    delete process.env.GOOGLE_SERVICES_JSON;
    assert.equal(config({config:base}).android.googleServicesFile, undefined);
    const path = join(dir,'google-services.json');
    process.env.GOOGLE_SERVICES_JSON = path;
    assert.throws(() => config({config:base}), /Firebase configuration/);
    writeFileSync(path, JSON.stringify({client:[{client_info:{android_client_info:{package_name:'wrong.fixture.app'}}}]}));
    assert.throws(() => config({config:base}), /Firebase configuration/);
    writeFileSync(path, JSON.stringify({project_info:{project_id:'fixture-only'}, client:[{client_info:{android_client_info:{package_name:base.android.package}}}]}));
    const result = config({config:base});
    assert.equal(result.android.googleServicesFile, path);
    assert.equal(result.android.package, base.android.package);
    assert.deepEqual(result.plugins, base.plugins);
  } finally {
    if(previous === undefined) delete process.env.GOOGLE_SERVICES_JSON; else process.env.GOOGLE_SERVICES_JSON=previous;
    rmSync(dir,{recursive:true,force:true});
  }
});
