import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';

const implementation = await import('./verify-mobile-source-backports-audit.mjs').catch(() => ({}));
const root = '/fixture/repository';
const packages = ['braces','node-forge'].map(name=>({name,path:path.join(root,'node_modules',name),version:name==='braces'?'3.0.3':'1.4.0'}));
const graph = {
  '@expo/cli':['@expo/metro','@expo/metro-config'],
  '@expo/metro':['metro','metro-config','metro-transform-worker'],
  '@expo/metro-config':['@expo/metro'],
  '@react-native/community-cli-plugin':['metro','metro-config'],
  '@react-native/virtualized-lists':['react-native'],
  expo:['@expo/cli','@expo/metro','@expo/metro-config'],
  metro:['image-size','metro-config','metro-transform-worker'],
  'metro-config':['metro'],'metro-transform-worker':['metro'],
  'react-native':['@react-native/community-cli-plugin','@react-native/virtualized-lists'],
};
function counts(findings) {
  const c={info:0,low:0,moderate:0,high:0,critical:0};
  for (const f of Object.values(findings)) c[f.severity]++;
  return {...c,total:Object.keys(findings).length};
}
function report() {
  const vulnerabilities=Object.fromEntries(Object.entries(graph).map(([name,via])=>[name,{severity:'high',via:[...via]}]));
  vulnerabilities['image-size']={severity:'high',via:[1138808,1138809].map(source=>({source,name:'image-size',severity:'high'}))};
  for (const [name,source,id,range] of [['braces',1240992,'GHSA-vfj7-8cjw-p6xm','<=3.0.3'],['node-forge',1240912,'GHSA-86w9-cpqp-85rv','<=1.4.0']]) {
    vulnerabilities[name]={severity:'high',nodes:[`node_modules/${name}`],via:[{source,name,dependency:name,severity:'high',url:`https://github.com/advisories/${id}`,range}]};
  }
  vulnerabilities['fixed-a']={severity:'high',via:['fixed-b','braces']};
  vulnerabilities['fixed-b']={severity:'high',via:['fixed-a','node-forge']};
  vulnerabilities.metro.via.push('fixed-a');
  return {auditReportVersion:2,vulnerabilities,metadata:{vulnerabilities:counts(vulnerabilities)}};
}
function normalize(r,p=packages) {
  assert.equal(typeof implementation.normalizeMobileSourceBackportsAudit,'function','source-aware admission implementation is missing');
  return implementation.normalizeMobileSourceBackportsAudit(r,{root,packages:p});
}
test('normalizes verified leaves and fixed-only cycles without mutating raw JSON',()=>{
  const r=report(),before=JSON.stringify(r),result=normalize(r);
  assert.equal(JSON.stringify(r),before);
  assert.equal(result.rawVulnerabilityCount,15);
  assert.deepEqual(result.fixedAdvisorySources,[1240912,1240992]);
  assert.equal(result.normalizedReport.metadata.vulnerabilities.total,11);
  assert.deepEqual(Object.keys(result.normalizedReport.vulnerabilities).sort(),[...Object.keys(graph),'image-size'].sort());
  assert.deepEqual(result.advisorySources,[1138808,1138809]);
});
const mutations=[
  ['forged raw total',r=>r.metadata.vulnerabilities.total=11,/metadata/],
  ['forged raw severity',r=>r.metadata.vulnerabilities.high=11,/metadata/],
  ['missing metadata',r=>delete r.metadata,/metadata/],
  ['extra metadata key',r=>r.metadata.vulnerabilities.fake=0,/metadata/],
  ['malformed findings',r=>r.vulnerabilities=[],/plain/],
  ['malformed via',r=>r.vulnerabilities.braces.via.push(null),/via|advisory/],
  ['unknown fixed advisory',r=>r.vulnerabilities.braces.via[0].source=9999999,/advisory/],
  ['changed GHSA',r=>r.vulnerabilities.braces.via[0].url='https://github.com/advisories/GHSA-xxxx-xxxx-xxxx',/advisory/],
  ['changed range',r=>r.vulnerabilities.braces.via[0].range='<3.0.3',/advisory/],
  ['changed advisory severity',r=>r.vulnerabilities.braces.via[0].severity='critical',/advisory/],
  ['changed advisory package',r=>r.vulnerabilities.braces.via[0].name='other',/advisory/],
  ['duplicate advisory',r=>r.vulnerabilities.braces.via.push({...r.vulnerabilities.braces.via[0]}),/advisory/],
  ['unknown image advisory',r=>r.vulnerabilities['image-size'].via[0].source=9999999,/advisory/],
  ['source moved onto ancestor',r=>r.vulnerabilities['fixed-a'].via.push({...r.vulnerabilities.braces.via[0]}),/advisory/],
  ['missing nodes',r=>delete r.vulnerabilities.braces.nodes,/nodes/],
  ['empty nodes',r=>r.vulnerabilities.braces.nodes=[],/nodes/],
  ['unverified node',r=>r.vulnerabilities.braces.nodes.push('node_modules/other/node_modules/braces'),/verified/],
  ['absolute node',r=>r.vulnerabilities.braces.nodes=['/fixture/repository/node_modules/braces'],/nodes/],
  ['traversal node',r=>r.vulnerabilities.braces.nodes=['node_modules/../node_modules/braces'],/nodes/],
  ['dangling graph',r=>r.vulnerabilities['fixed-a'].via.push('missing'),/missing|dangling/],
  ['leafless cycle',r=>{r.vulnerabilities['fixed-a'].via=['fixed-b'];r.vulnerabilities['fixed-b'].via=['fixed-a'];},/leaf|root/],
  ['empty via leaf',r=>r.vulnerabilities['fixed-a'].via=[],/leaf|root/],
  ['changed remaining graph',r=>r.vulnerabilities.metro.via=['image-size','fixed-a'],/chain/],
];
for (const [name,mutate,pattern] of mutations) test(`rejects ${name}`,()=>{
  const r=report();mutate(r);assert.throws(()=>normalize(r),pattern);
});
test('rejects missing or wrong-version verification evidence',()=>{
  assert.throws(()=>normalize(report(),[]),/verified|missing/);
  assert.throws(()=>normalize(report(),packages.map(p=>({...p,version:'9.9.9'}))),/version|verified/);
});
for (const severity of ['critical','moderate','low']) {
  test(`rejects ${severity} drift on a fixed-only ancestor before normalization`,()=>{
    const r=report();
    r.vulnerabilities['fixed-a'].severity=severity;
    r.metadata.vulnerabilities=counts(r.vulnerabilities);
    assert.throws(()=>normalize(r),/severity/);
  });
}
