#!/usr/bin/env node
// Source admission is separate from, and cannot widen, the image-size exception.
import { readFileSync, lstatSync, realpathSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve, relative, isAbsolute, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validateMobileBuildToolchainAudit, KNOWN_BUILD_TOOLCHAIN_ADVISORY_SOURCES } from './verify-mobile-build-toolchain-audit.mjs';

const FIXES = {
  braces: {source:1240992, ghsa:'GHSA-vfj7-8cjw-p6xm', range:'<=3.0.3', version:'3.0.3'},
  'node-forge': {source:1240912, ghsa:'GHSA-86w9-cpqp-85rv', range:'<=1.4.0', version:'1.4.0'},
};
const plain = x => x !== null && typeof x === 'object' && Object.getPrototypeOf(x) === Object.prototype;
const fail = message => { throw new Error(`Mobile source-backport audit rejected: ${message}`); };
function counts(findings) {
  const c = {info:0,low:0,moderate:0,high:0,critical:0};
  for (const finding of Object.values(findings)) {
    if (!plain(finding) || !Object.hasOwn(c,finding.severity)) fail('invalid finding severity for metadata reconciliation.');
    c[finding.severity]++;
  }
  return {...c,total:Object.keys(findings).length};
}
function validateRaw(report) {
  if (!plain(report) || report.auditReportVersion !== 2 || !plain(report.vulnerabilities)) fail('expected plain npm audit v2 vulnerabilities.');
  const expected = counts(report.vulnerabilities), observed = report.metadata?.vulnerabilities;
  if (!plain(report.metadata) || !plain(observed) || Object.keys(observed).sort().join() !== Object.keys(expected).sort().join()) fail('invalid raw metadata summary.');
  for (const key of Object.keys(expected)) if (!Number.isInteger(observed[key]) || observed[key] !== expected[key]) fail(`raw metadata ${key} mismatch.`);
  for (const [name,finding] of Object.entries(report.vulnerabilities)) {
    if (finding.severity !== 'high') fail(`${name} raw finding severity changed.`);
  }
}
function reachable(findings, leaves) {
  const reached = new Set(leaves);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [name,finding] of Object.entries(findings)) {
      if (!reached.has(name) && finding.via.some(v=>typeof v==='string' && reached.has(v))) {
        reached.add(name); changed=true;
      }
    }
  }
  return reached;
}
/** Pure transformation for tests. The CLI always obtains evidence itself. */
export function normalizeMobileSourceBackportsAudit(report, {root,packages}) {
  validateRaw(report); // Never repair a forged raw aggregate by normalization.
  if (!isAbsolute(root) || !Array.isArray(packages)) fail('missing verified installation.');
  const verified = new Map();
  for (const p of packages) {
    if (!plain(p) || !Object.hasOwn(FIXES,p.name) || p.version !== FIXES[p.name].version || typeof p.path !== 'string' || !isAbsolute(p.path)) fail('invalid verified package version or path.');
    const rel = relative(root,p.path);
    if (!rel || rel.startsWith('..') || isAbsolute(rel) || verified.has(p.path)) fail('invalid verified package path.');
    verified.set(p.path,p);
  }
  for (const name of Object.keys(FIXES)) if (!packages.some(p=>p.name===name)) fail(`required verified package missing: ${name}.`);
  const findings = report.vulnerabilities, allLeaves = [], remainingLeaves = [], fixed = [];
  for (const [name,f] of Object.entries(findings)) {
    if (!Array.isArray(f.via)) fail(`${name} has an invalid via array.`);
    const sources = new Set();
    for (const v of f.via) {
      if (typeof v === 'string') {
        if (!Object.hasOwn(findings,v)) fail(`${name} references missing finding ${v}.`);
      } else {
        if (!plain(v) || !Number.isInteger(v.source) || sources.has(v.source)) fail(`${name} has an invalid or duplicate advisory.`);
        sources.add(v.source);
        if (Object.hasOwn(FIXES,name)) {
          const fix=FIXES[name];
          if (v.source!==fix.source || v.name!==name || v.dependency!==name || v.severity!=='high' || v.range!==fix.range || v.url!==`https://github.com/advisories/${fix.ghsa}`) fail(`${name} advisory identity changed.`);
        } else if (name!=='image-size' || !KNOWN_BUILD_TOOLCHAIN_ADVISORY_SOURCES.has(v.source)) fail(`unapproved advisory source on ${name}: ${v.source}.`);
      }
    }
    if (sources.size) allLeaves.push(name);
    if (Object.hasOwn(FIXES,name)) {
      if (f.severity!=='high' || f.via.length!==1 || sources.size!==1) fail(`${name} fixed advisory shape changed.`);
      if (!Array.isArray(f.nodes) || !f.nodes.length || new Set(f.nodes).size!==f.nodes.length) fail(`${name} requires unique nonempty nodes.`);
      for (const node of f.nodes) {
        if (typeof node!=='string' || isAbsolute(node) || node.includes('\\') || node.split('/').some(part=>!part || part==='.' || part==='..')) fail(`${name} has invalid relative nodes.`);
        const p=verified.get(resolve(root,node));
        if (!p || p.name!==name || p.version!==FIXES[name].version) fail(`${name} nodes do not match a verified installed copy: ${node}.`);
      }
      fixed.push(FIXES[name].source);
    } else if (sources.size) remainingLeaves.push(name);
  }
  const originalReachable = reachable(findings,allLeaves);
  for (const name of Object.keys(findings)) if (!originalReachable.has(name)) fail(`${name} is not rooted in any known advisory leaf.`);
  const retained=reachable(findings,remainingLeaves);
  const normalizedReport=structuredClone(report);
  normalizedReport.vulnerabilities=Object.fromEntries(Object.entries(normalizedReport.vulnerabilities)
    .filter(([name])=>retained.has(name))
    .map(([name,f])=>[name,{...f,via:f.via.filter(v=>typeof v!=='string' || retained.has(v))}]));
  normalizedReport.metadata.vulnerabilities=counts(normalizedReport.vulnerabilities);
  const reviewed=validateMobileBuildToolchainAudit(normalizedReport);
  return {normalizedReport,rawVulnerabilityCount:report.metadata.vulnerabilities.total,fixedAdvisorySources:fixed.sort((a,b)=>a-b),...reviewed};
}
function verifyInstalled(root) {
  // Caller-supplied fixture roots and module search overrides cannot admit CI.
  const env={...process.env,SECURITY_BACKPORT_ROOT:root};
  for (const key of ['SECURITY_MODULES_ROOT','NODE_OPTIONS','NODE_PATH']) delete env[key];
  if (lstatSync(join(root,'node_modules')).isSymbolicLink()) fail('installed node_modules symlink rejected.');
  const run=spawnSync(process.execPath,[join(root,'scripts/security-backports.mjs'),'--check'],{cwd:root,env,encoding:'utf8',timeout:120000,maxBuffer:4*1024*1024});
  if (run.error || run.status!==0) fail(`installed backport check failed: ${run.error?.message || run.stderr.trim()}`);
  let evidence;
  try { evidence=JSON.parse(run.stdout); } catch { fail('invalid installed backport check output.'); }
  if (evidence.status!=='source-backports-verified' || !Array.isArray(evidence.packages)) fail('missing verified backport evidence.');
  for (const p of evidence.packages) {
    const rel=relative(root,p.path);
    if (!rel || rel.startsWith('..') || isAbsolute(rel)) fail('verified source outside repository.');
    let current=root;
    for (const part of rel.split('/')) {
      current=join(current,part);
      if (lstatSync(current).isSymbolicLink()) fail(`affected source path symlink rejected: ${current}.`);
    }
  }
  return evidence.packages;
}
function main() {
  const auditPath=process.argv[2];
  if (!auditPath || process.argv.length!==3) fail('exactly one raw npm audit JSON file is required.');
  const root=realpathSync(resolve(dirname(fileURLToPath(import.meta.url)),'..'));
  const packages=verifyInstalled(root); // Required even for clean/image-only reports.
  const report=JSON.parse(readFileSync(auditPath,'utf8'));
  const result=normalizeMobileSourceBackportsAudit(report,{root,packages});
  console.log(JSON.stringify({status:'source-backports-verified',rawVulnerabilityCount:result.rawVulnerabilityCount,
    fixedAdvisorySources:result.fixedAdvisorySources,fixedAdvisoryIds:result.fixedAdvisorySources.map(s=>Object.values(FIXES).find(f=>f.source===s).ghsa),
    remainingStatus:result.packages.length?'reviewed-build-toolchain-exception':'no-remaining-findings',
    packages:result.packages,advisorySources:result.advisorySources,
    note:'Raw npm version-based advisories remain; source-verified local mitigation is not a patched npm release or a zero-advisory audit. The image-size exception is unchanged.'}));
}
if (process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  try { main(); } catch(error) { console.error(error.message);process.exitCode=1; }
}
