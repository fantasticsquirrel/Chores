import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const root = new URL('../', import.meta.url);
const json = p => JSON.parse(readFileSync(new URL(p, root), 'utf8'));
test('APK release has coherent version and immutable upgrade code', () => {
 const app=json('mobile/app.json').expo, pkg=json('mobile/package.json'), lock=json('package-lock.json');
 assert.equal(app.version,'1.0.9'); assert.equal(pkg.version,app.version);
 assert.equal(lock.packages.mobile.version,app.version);
 assert.equal(app.android.versionCode,10);
 assert.equal(app.android.package,'com.fantasticsquirrel.familymanager');
});
test('APK profile explicitly embeds production API and pins CI-compatible Node', () => {
 const p=json('mobile/eas.json').build.apk;
 assert.equal(p.env.EXPO_PUBLIC_API_BASE_URL,'https://family.multihost.ing/chore-api');
 assert.equal(p.node,'20.19.4'); assert.equal(p.android.buildType,'apk');
 assert.equal(p.distribution,'internal'); assert.equal(p.environment,'preview');
});
