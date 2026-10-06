import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import test from 'node:test';
const require=createRequire(import.meta.url);
test('lockfile removes vulnerable sprintf-js chain rather than extending audit exceptions',()=>{
 const lock=JSON.parse(readFileSync(new URL('../package-lock.json',import.meta.url),'utf8'));
 assert.deepEqual(Object.keys(lock.packages).filter(p=>p.endsWith('node_modules/sprintf-js')),[]);
});
test('real Istanbul config consumer still loads YAML with scoped parser replacement',async()=>{
 const {loadNycConfig}=require('@istanbuljs/load-nyc-config');
 const dir=mkdtempSync(join(tmpdir(),'fm-nyc-config-'));
 try{
  writeFileSync(join(dir,'package.json'),'{"name":"test"}');
  writeFileSync(join(dir,'.nycrc.yml'),'all: true\ninclude:\n  - src/**/*.ts\nexclude:\n  - test/**\nreporter:\n  - text\n');
  const result=await loadNycConfig({cwd:dir});
  assert.equal(result.all,true); assert.deepEqual(result.include,['src/**/*.ts']);
  assert.deepEqual(result.exclude,['test/**']); assert.deepEqual(result.reporter,['text']);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
