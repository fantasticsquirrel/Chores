import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
const require=createRequire(import.meta.url);
const safe=version=>{ const [major,minor,patch]=version.split('.').map(Number); return major>1||major===1&&(minor>2||minor===2&&patch>=2); };
test('all locked source-map-js copies include GHSA-68fv-2mgg-jv7q fix',()=>{
 const lock=JSON.parse(readFileSync(new URL('../package-lock.json',import.meta.url),'utf8'));
 const copies=Object.entries(lock.packages).filter(([p])=>p.endsWith('node_modules/source-map-js'));
 assert.ok(copies.length>0);
 for(const [path,p] of copies) assert.ok(safe(p.version),`${path} ${p.version} lacks indexed offset validation`);
});
test('installed source-map-js is a patched version',()=>assert.ok(safe(require('source-map-js/package.json').version)));
