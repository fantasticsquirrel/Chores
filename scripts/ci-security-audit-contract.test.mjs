import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const workflowPath = path.join(
  repositoryRoot,
  ".github",
  "workflows",
  "ci-quality-gates.yml",
);
const packagePath = path.join(repositoryRoot, "package.json");

function escapeRegularExpression(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function exactWorkflowStepRun(workflow, name) {
  const match = new RegExp(
    `^\\s*- name: ${escapeRegularExpression(name)}\\r?\\n\\s+run: ([^\\r\\n]+)\\s*$`,
    "m",
  ).exec(workflow);
  assert.ok(match, `CI must have a single-line run command for ${name}.`);
  return match[1];
}

test("CI pins the supported Node 20 line and strictly runs every audit gate", () => {
  const workflow = readFileSync(workflowPath, "utf8");
  const manifest = JSON.parse(readFileSync(packagePath, "utf8"));

  assert.match(workflow, /^\s+node-version: "20\.19\.4"\s*$/m);
  assert.equal(manifest.engines?.node, ">=20.19.4 <21");
  assert.equal(
    manifest.scripts?.["mobile:gate"],
    "npm run mobile:typecheck && npm run mobile:test && cd mobile && npx expo install --check",
  );
  assert.equal(
    exactWorkflowStepRun(workflow, "Mobile quality and Expo dependency alignment"),
    "npm run mobile:gate",
  );
  assert.equal(
    exactWorkflowStepRun(workflow, "Dependency-audit exception contract tests"),
    "node --test scripts/*.test.mjs",
  );
  assert.equal(
    exactWorkflowStepRun(workflow, "Frontend runtime dependency audit"),
    "npm audit --workspace frontend --omit=dev --audit-level=high",
  );
  assert.equal(
    exactWorkflowStepRun(workflow, "Mobile runtime dependency audit"),
    "bash scripts/audit-mobile-runtime-dependencies.sh",
  );
  assert.doesNotMatch(workflow, /^\s*run:\s*npm audit --omit=dev --audit-level=high\s*$/m);
});
