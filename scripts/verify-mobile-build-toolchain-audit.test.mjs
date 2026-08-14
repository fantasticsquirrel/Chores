import assert from "node:assert/strict";
import test from "node:test";

import {
  KNOWN_BUILD_TOOLCHAIN_ADVISORY_SOURCES,
  validateMobileBuildToolchainAudit,
} from "./verify-mobile-build-toolchain-audit.mjs";

function knownImageSizeFinding() {
  return {
    severity: "high",
    via: [
      {
        source: 1138808,
        name: "image-size",
        url: "https://github.com/advisories/GHSA-w3rx-r6r6-pgpr",
        severity: "high",
      },
      {
        source: 1138809,
        name: "image-size",
        url: "https://github.com/advisories/GHSA-5p2g-fcmc-qvqq",
        severity: "high",
      },
    ],
  };
}

function auditMetadata(vulnerabilities) {
  const severities = ["info", "low", "moderate", "high", "critical"];
  const counts = Object.fromEntries(severities.map((severity) => [severity, 0]));
  for (const finding of Object.values(vulnerabilities)) {
    counts[finding.severity] += 1;
  }
  return { vulnerabilities: { ...counts, total: Object.keys(vulnerabilities).length } };
}

function reviewedExpoMetroReport() {
  const vulnerabilities = {
    "@expo/cli": { severity: "high", via: ["@expo/metro", "@expo/metro-config"] },
    "@expo/metro": { severity: "high", via: ["metro", "metro-config", "metro-transform-worker"] },
    "@expo/metro-config": { severity: "high", via: ["@expo/metro"] },
    "@react-native/community-cli-plugin": { severity: "high", via: ["metro", "metro-config"] },
    "@react-native/virtualized-lists": { severity: "high", via: ["react-native"] },
    expo: { severity: "high", via: ["@expo/cli", "@expo/metro", "@expo/metro-config"] },
    "image-size": knownImageSizeFinding(),
    metro: { severity: "high", via: ["image-size", "metro-config", "metro-transform-worker"] },
    "metro-config": { severity: "high", via: ["metro"] },
    "metro-transform-worker": { severity: "high", via: ["metro"] },
    "react-native": { severity: "high", via: ["@react-native/community-cli-plugin", "@react-native/virtualized-lists"] },
  };
  return {
    auditReportVersion: 2,
    vulnerabilities,
    metadata: auditMetadata(vulnerabilities),
  };
}

test("accepts only the fully reviewed image-size advisory chain through Expo and Metro", () => {
  const result = validateMobileBuildToolchainAudit(reviewedExpoMetroReport());

  assert.deepEqual(result, {
    packages: [
      "@expo/cli",
      "@expo/metro",
      "@expo/metro-config",
      "@react-native/community-cli-plugin",
      "@react-native/virtualized-lists",
      "expo",
      "image-size",
      "metro",
      "metro-config",
      "metro-transform-worker",
      "react-native",
    ],
    advisorySources: [...KNOWN_BUILD_TOOLCHAIN_ADVISORY_SOURCES].sort((left, right) => left - right),
  });
});

test("accepts a truly clean mobile audit without an exception", () => {
  assert.deepEqual(validateMobileBuildToolchainAudit({
    auditReportVersion: 2,
    vulnerabilities: {},
    metadata: auditMetadata({}),
  }), {
    packages: [],
    advisorySources: [],
  });
});

test("rejects a minimal v2 envelope without reconciled npm audit metadata", () => {
  assert.throws(
    () => validateMobileBuildToolchainAudit({ auditReportVersion: 2, vulnerabilities: {} }),
    /metadata/i,
  );
});

test("rejects metadata whose severity totals do not match the findings", () => {
  const report = reviewedExpoMetroReport();
  report.metadata.vulnerabilities.high = 0;
  assert.throws(
    () => validateMobileBuildToolchainAudit(report),
    /metadata.*high|high.*metadata/i,
  );
});

test("rejects an array-shaped vulnerabilities payload instead of treating it as clean", () => {
  assert.throws(
    () => validateMobileBuildToolchainAudit({ auditReportVersion: 2, vulnerabilities: [] }),
    /plain vulnerabilities object/i,
  );
});

test("rejects a non-plain vulnerabilities payload instead of treating it as clean", () => {
  assert.throws(
    () => validateMobileBuildToolchainAudit({ auditReportVersion: 2, vulnerabilities: Object.create(null) }),
    /plain vulnerabilities object/i,
  );
});

test("rejects a newly introduced advisory even if it is reported through an approved package", () => {
  const report = reviewedExpoMetroReport();
  report.vulnerabilities["image-size"].via.push({
    source: 9999999,
    name: "image-size",
    url: "https://example.invalid/advisory",
    severity: "high",
  });

  assert.throws(
    () => validateMobileBuildToolchainAudit(report),
    /unapproved advisory source/i,
  );
});

test("rejects an affected package outside the narrow Expo/Metro build-toolchain allowlist", () => {
  const report = reviewedExpoMetroReport();
  report.vulnerabilities["unexpected-runtime-package"] = { severity: "high", via: ["image-size"] };

  assert.throws(
    () => validateMobileBuildToolchainAudit(report),
    /unapproved affected package/i,
  );
});

test("rejects a changed reviewed dependency graph or severity", () => {
  const changedGraph = reviewedExpoMetroReport();
  changedGraph.vulnerabilities.metro.via = ["image-size"];
  assert.throws(
    () => validateMobileBuildToolchainAudit(changedGraph),
    /reviewed dependency chain changed/i,
  );

  const changedSeverity = reviewedExpoMetroReport();
  changedSeverity.vulnerabilities.metro.severity = "critical";
  assert.throws(
    () => validateMobileBuildToolchainAudit(changedSeverity),
    /reviewed high severity/i,
  );
});

test("rejects malformed audit reports rather than treating them as a clean audit", () => {
  assert.throws(
    () => validateMobileBuildToolchainAudit({ auditReportVersion: 2, vulnerabilities: { metro: { severity: "high", via: ["missing"] } } }),
    /affected package set changed/i,
  );
});

test("rejects malformed via entries instead of silently filtering them out", () => {
  for (const invalidEntry of [null, []]) {
    const report = reviewedExpoMetroReport();
    report.vulnerabilities.metro.via.push(invalidEntry);

    assert.throws(
      () => validateMobileBuildToolchainAudit(report),
      /invalid via entry/i,
    );
  }
});
