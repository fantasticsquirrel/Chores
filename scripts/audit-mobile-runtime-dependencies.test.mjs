import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scriptPath = path.join(repositoryRoot, "scripts", "audit-mobile-runtime-dependencies.sh");

const knownReport = {
  auditReportVersion: 2,
  vulnerabilities: {
    "@expo/cli": { severity: "high", via: ["@expo/metro", "@expo/metro-config"] },
    "@expo/metro": { severity: "high", via: ["metro", "metro-config", "metro-transform-worker"] },
    "@expo/metro-config": { severity: "high", via: ["@expo/metro"] },
    "@react-native/community-cli-plugin": { severity: "high", via: ["metro", "metro-config"] },
    "@react-native/virtualized-lists": { severity: "high", via: ["react-native"] },
    expo: { severity: "high", via: ["@expo/cli", "@expo/metro", "@expo/metro-config"] },
    "image-size": {
      severity: "high",
      via: [
        { source: 1138808, name: "image-size", severity: "high" },
        { source: 1138809, name: "image-size", severity: "high" },
      ],
    },
    metro: { severity: "high", via: ["image-size", "metro-config", "metro-transform-worker"] },
    "metro-config": { severity: "high", via: ["metro"] },
    "metro-transform-worker": { severity: "high", via: ["metro"] },
    "react-native": { severity: "high", via: ["@react-native/community-cli-plugin", "@react-native/virtualized-lists"] },
  },
  metadata: {
    vulnerabilities: { info: 0, low: 0, moderate: 0, high: 11, critical: 0, total: 11 },
  },
};

function runWithFakeNpm({ output, exitCode }) {
  const directory = mkdtempSync(path.join(os.tmpdir(), "family-manager-mobile-audit-test-"));
  const npmPath = path.join(directory, "npm");
  writeFileSync(
    npmPath,
    `#!/usr/bin/env bash\nprintf '%s' "$FAKE_AUDIT_OUTPUT"\nexit "$FAKE_AUDIT_STATUS"\n`,
    { mode: 0o700 },
  );
  chmodSync(npmPath, 0o700);
  const result = spawnSync("bash", [scriptPath], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${directory}:${process.env.PATH}`,
      FAKE_AUDIT_OUTPUT: output,
      FAKE_AUDIT_STATUS: String(exitCode),
    },
  });
  rmSync(directory, { recursive: true, force: true });
  return result;
}

test("accepts the exact reviewed npm audit chain even though npm audit exits 1", () => {
  const result = runWithFakeNpm({ output: JSON.stringify(knownReport), exitCode: 1 });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /reviewed-build-toolchain-exception/);
});

test("fails closed on an unexpected npm audit transport failure", () => {
  const result = runWithFakeNpm({ output: "network unavailable", exitCode: 2 });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /exited unexpectedly/i);
});

test("fails closed when an audit report introduces an unreviewed advisory", () => {
  const changed = structuredClone(knownReport);
  changed.vulnerabilities["image-size"].via.push({ source: 4444444, name: "image-size", severity: "high" });
  const result = runWithFakeNpm({ output: JSON.stringify(changed), exitCode: 1 });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unapproved advisory source/i);
});
