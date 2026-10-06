import assert from 'node:assert/strict';
import {cpSync,mkdirSync,mkdtempSync,rmSync,writeFileSync,symlinkSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import test, {after} from 'node:test';
import {fileURLToPath} from 'node:url';
const repositoryRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
// Genuine transitive npm packages, isolated from the working repository.
const seed=mkdtempSync(path.join(os.tmpdir(),'audit-source-deps-'));
const installed=spawnSync('npm',['install','--prefix',seed,'--ignore-scripts','--no-audit','--no-fund','fill-range@7.1.1'],{encoding:'utf8',timeout:60000});
assert.equal(installed.status,0,installed.stderr);
after(()=>rmSync(seed,{recursive:true,force:true}));
const graph={
  '@expo/cli':['@expo/metro','@expo/metro-config'], '@expo/metro':['metro','metro-config','metro-transform-worker'],
  '@expo/metro-config':['@expo/metro'], '@react-native/community-cli-plugin':['metro','metro-config'],
  '@react-native/virtualized-lists':['react-native'],expo:['@expo/cli','@expo/metro','@expo/metro-config'],
  metro:['image-size','metro-config','metro-transform-worker'],'metro-config':['metro'],'metro-transform-worker':['metro'],
  'react-native':['@react-native/community-cli-plugin','@react-native/virtualized-lists'],
};
const knownReport={auditReportVersion:2,vulnerabilities:Object.fromEntries(Object.entries(graph).map(([name,via])=>[name,{severity:'high',via}])),metadata:{vulnerabilities:{info:0,low:0,moderate:0,high:11,critical:0,total:11}}};
knownReport.vulnerabilities['image-size']={severity:'high',via:[1138808,1138809].map(source=>({source,name:'image-size',severity:'high'}))};
function runWithFakeNpm({output,exitCode,change}) {
  const directory=mkdtempSync(path.join(os.tmpdir(),'family-manager-mobile-audit-test-'));
  try {
    const root=path.join(directory,'repo'); mkdirSync(path.join(root,'scripts'),{recursive:true});
    for (const name of ['audit-mobile-runtime-dependencies.sh','verify-mobile-build-toolchain-audit.mjs','verify-mobile-source-backports-audit.mjs','security-backports.mjs']) cpSync(path.join(repositoryRoot,'scripts',name),path.join(root,'scripts',name));
    cpSync(path.join(repositoryRoot,'scripts/fixtures'),path.join(root,'scripts/fixtures'),{recursive:true});
    cpSync(path.join(repositoryRoot,'vendor'),path.join(root,'vendor'),{recursive:true});
    cpSync(path.join(seed,'node_modules'),path.join(root,'node_modules'),{recursive:true});
    for (const name of ['braces','node-forge']) cpSync(path.join(repositoryRoot,'vendor/security-backports',name),path.join(root,'node_modules',name),{recursive:true});
    if (change) change(root);
    writeFileSync(path.join(directory,'npm'),'#!/usr/bin/env bash\nprintf \'%s\' "$FAKE_AUDIT_OUTPUT"\nexit "$FAKE_AUDIT_STATUS"\n',{mode:0o700});
    return spawnSync('bash',[path.join(root,'scripts/audit-mobile-runtime-dependencies.sh')],{cwd:directory,encoding:'utf8',env:{...process.env,PATH:`${directory}:${process.env.PATH}`,FAKE_AUDIT_OUTPUT:output,FAKE_AUDIT_STATUS:String(exitCode),SECURITY_BACKPORT_ROOT:'/caller-must-not-control-root',SECURITY_MODULES_ROOT:'/caller-must-not-control-modules'}});
  } finally {rmSync(directory,{recursive:true,force:true});}
}
test('accepts exact image chain only with genuine verified installed backports',()=>{
  const r=runWithFakeNpm({output:JSON.stringify(knownReport),exitCode:1});assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/source-backports-verified/);assert.match(r.stdout,/reviewed-build-toolchain-exception/);
});
test('preserves raw audit counts while admitting exact fixed advisories',()=>{
  const report=structuredClone(knownReport);
  for (const [name,source,id,range] of [['braces',1240992,'GHSA-vfj7-8cjw-p6xm','<=3.0.3'],['node-forge',1240912,'GHSA-86w9-cpqp-85rv','<=1.4.0']]) report.vulnerabilities[name]={severity:'high',nodes:[`node_modules/${name}`],via:[{source,name,dependency:name,url:`https://github.com/advisories/${id}`,severity:'high',range}]};
  report.metadata.vulnerabilities.high=13;report.metadata.vulnerabilities.total=13;
  const r=runWithFakeNpm({output:JSON.stringify(report),exitCode:1});assert.equal(r.status,0,r.stderr);
  assert.match(r.stdout,/"rawVulnerabilityCount":13/);assert.match(r.stdout,/GHSA-vfj7-8cjw-p6xm/);assert.match(r.stdout,/GHSA-86w9-cpqp-85rv/);
});
test('fails closed on audit transport failure',()=>{const r=runWithFakeNpm({output:'network unavailable',exitCode:2});assert.equal(r.status,2);assert.match(r.stderr,/exited unexpectedly/);});
test('rejects unknown advisory',()=>{const report=structuredClone(knownReport);report.vulnerabilities['image-size'].via.push({source:4444444,name:'image-size',severity:'high'});const r=runWithFakeNpm({output:JSON.stringify(report),exitCode:1});assert.notEqual(r.status,0);assert.match(r.stderr,/unapproved advisory source/);});
for (const [name,change] of [
  ['missing',root=>rmSync(path.join(root,'node_modules/braces'),{recursive:true})],
  ['tampered',root=>writeFileSync(path.join(root,'node_modules/braces/lib/parse.js'),'unsafe')],
  ['unknown version',root=>writeFileSync(path.join(root,'node_modules/braces/package.json'),'{"version":"9.9.9"}')],
  ['symlink',root=>{rmSync(path.join(root,'node_modules/braces'),{recursive:true});symlinkSync(path.join(root,'vendor/security-backports/braces'),path.join(root,'node_modules/braces'));}],
]) test(`rejects ${name} installed backports even for old image-only report`,()=>{
  const r=runWithFakeNpm({output:JSON.stringify(knownReport),exitCode:1,change});assert.notEqual(r.status,0);assert.match(r.stderr,/backport|integrity|symlink/i);
});
