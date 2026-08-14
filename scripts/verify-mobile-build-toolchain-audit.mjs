#!/usr/bin/env node
/**
 * Enforce the deliberately narrow temporary exception for the Expo 56 / Metro
 * build toolchain advisory chain. This is not a general audit suppressor:
 * the report must exactly match the reviewed affected-package graph, all
 * findings must stay high severity, and the only leaf advisories may be the
 * two reviewed image-size denial-of-service records.
 */

import { readFile } from "node:fs/promises";

export const KNOWN_BUILD_TOOLCHAIN_ADVISORY_SOURCES = new Set([1138808, 1138809]);

const REVIEWED_BUILD_TOOLCHAIN_VIA = {
  "@expo/cli": ["@expo/metro", "@expo/metro-config"],
  "@expo/metro": ["metro", "metro-config", "metro-transform-worker"],
  "@expo/metro-config": ["@expo/metro"],
  "@react-native/community-cli-plugin": ["metro", "metro-config"],
  "@react-native/virtualized-lists": ["react-native"],
  expo: ["@expo/cli", "@expo/metro", "@expo/metro-config"],
  "image-size": [],
  metro: ["image-size", "metro-config", "metro-transform-worker"],
  "metro-config": ["metro"],
  "metro-transform-worker": ["metro"],
  "react-native": ["@react-native/community-cli-plugin", "@react-native/virtualized-lists"],
};

const REVIEWED_PACKAGES = Object.keys(REVIEWED_BUILD_TOOLCHAIN_VIA).sort();

function fail(message) {
  throw new Error(`Mobile build-toolchain audit exception rejected: ${message}`);
}

function sortedStrings(values) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function sameStringArray(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function advisorySources(finding, packageName) {
  if (!finding || !Array.isArray(finding.via)) {
    fail("every vulnerability finding must contain a via array.");
  }

  const sources = [];
  for (const entry of finding.via) {
    if (typeof entry === "string") {
      continue;
    }
    if (!entry || typeof entry !== "object" || Array.isArray(entry) || !Number.isInteger(entry.source)) {
      fail(`${packageName} has an invalid via entry.`);
    }
    sources.push(entry.source);
  }
  return sources;
}

function reviewedAuditMetadata(vulnerabilities) {
  const totals = { info: 0, low: 0, moderate: 0, high: 0, critical: 0 };
  for (const finding of Object.values(vulnerabilities)) {
    if (
      !finding
      || typeof finding !== "object"
      || Array.isArray(finding)
      || typeof finding.severity !== "string"
      || !Object.hasOwn(totals, finding.severity)
    ) {
      fail("every vulnerability finding must provide a recognized severity for metadata reconciliation.");
    }
    totals[finding.severity] += 1;
  }
  return { vulnerabilities: { ...totals, total: Object.keys(vulnerabilities).length } };
}

function validateAuditMetadata(report, findings) {
  const metadata = report.metadata;
  const expected = reviewedAuditMetadata(findings).vulnerabilities;
  if (
    !metadata
    || typeof metadata !== "object"
    || Array.isArray(metadata)
    || Object.getPrototypeOf(metadata) !== Object.prototype
    || !metadata.vulnerabilities
    || typeof metadata.vulnerabilities !== "object"
    || Array.isArray(metadata.vulnerabilities)
    || Object.getPrototypeOf(metadata.vulnerabilities) !== Object.prototype
  ) {
    fail("expected npm audit metadata with a plain vulnerabilities severity summary.");
  }
  const observed = metadata.vulnerabilities;
  const requiredKeys = Object.keys(expected).sort();
  if (!sameStringArray(Object.keys(observed).sort(), requiredKeys)) {
    fail("npm audit metadata vulnerability summary keys changed.");
  }
  for (const severity of requiredKeys) {
    if (!Number.isInteger(observed[severity]) || observed[severity] < 0 || observed[severity] !== expected[severity]) {
      fail(`npm audit metadata ${severity} total does not match vulnerability findings.`);
    }
  }
}

/**
 * Validate an npm audit v2 JSON report and return the reviewed exception facts.
 * Throws for unknown/malformed/changed findings so `npm audit` remains mandatory.
 */
export function validateMobileBuildToolchainAudit(report) {
  if (
    !report
    || report.auditReportVersion !== 2
    || !report.vulnerabilities
    || typeof report.vulnerabilities !== "object"
    || Array.isArray(report.vulnerabilities)
    || Object.getPrototypeOf(report.vulnerabilities) !== Object.prototype
  ) {
    fail("expected an npm audit v2 report with a plain vulnerabilities object.");
  }

  const findings = report.vulnerabilities;
  const packages = Object.keys(findings).sort();
  if (packages.length === 0) {
    validateAuditMetadata(report, findings);
    return { packages: [], advisorySources: [] };
  }
  if (!sameStringArray(packages, REVIEWED_PACKAGES)) {
    const unapproved = packages.filter((packageName) => !REVIEWED_PACKAGES.includes(packageName));
    if (unapproved.length > 0) {
      fail(`unapproved affected package: ${unapproved.join(", ")}.`);
    }
    fail(`reviewed affected package set changed: expected ${REVIEWED_PACKAGES.join(", ")}; received ${packages.join(", ")}.`);
  }

  const expectedSources = [...KNOWN_BUILD_TOOLCHAIN_ADVISORY_SOURCES].sort((left, right) => left - right);
  const observedSources = new Set();
  for (const packageName of REVIEWED_PACKAGES) {
    const finding = findings[packageName];
    if (finding.severity !== "high") {
      fail(`${packageName} is not the reviewed high severity: ${String(finding.severity)}.`);
    }

    const dependentPackages = sortedStrings((finding.via ?? []).filter((entry) => typeof entry === "string"));
    const expectedDependents = [...REVIEWED_BUILD_TOOLCHAIN_VIA[packageName]].sort();
    if (!sameStringArray(dependentPackages, expectedDependents)) {
      fail(`reviewed dependency chain changed for ${packageName}.`);
    }
    for (const dependent of dependentPackages) {
      if (!Object.hasOwn(findings, dependent)) {
        fail(`${packageName} references missing finding ${dependent}.`);
      }
    }

    const sourcesForPackage = advisorySources(finding, packageName).sort((left, right) => left - right);
    const expectedSourcesForPackage = packageName === "image-size" ? expectedSources : [];
    if (
      sourcesForPackage.length !== expectedSourcesForPackage.length
      || sourcesForPackage.some((source, index) => source !== expectedSourcesForPackage[index])
    ) {
      const invalidSource = sourcesForPackage.find((source) => !expectedSourcesForPackage.includes(source));
      if (invalidSource !== undefined) {
        fail(`unapproved advisory source on ${packageName}: ${String(invalidSource)}.`);
      }
      fail(`reviewed advisory source placement changed for ${packageName}.`);
    }
    for (const source of sourcesForPackage) {
      observedSources.add(source);
    }
  }

  const sources = [...observedSources].sort((left, right) => left - right);
  if (sources.length !== expectedSources.length || sources.some((source, index) => source !== expectedSources[index])) {
    fail("reviewed leaf advisory source set changed.");
  }
  // Validate npm's own aggregate only after the exact allowlisted graph has
  // passed, preserving specific diagnostics for a changed advisory while still
  // rejecting a forged/truncated report that otherwise resembles the review.
  validateAuditMetadata(report, findings);

  return { packages, advisorySources: sources };
}

async function main() {
  const auditPath = process.argv[2] ?? "";
  if (!auditPath) {
    fail("an npm audit JSON file path is required.");
  }

  let report;
  try {
    report = JSON.parse(await readFile(auditPath, "utf8"));
  } catch (error) {
    fail(`could not parse npm audit JSON: ${error instanceof Error ? error.message : String(error)}`);
  }

  const result = validateMobileBuildToolchainAudit(report);
  process.stdout.write(
    `${JSON.stringify({
      status: result.packages.length === 0 ? "clean" : "reviewed-build-toolchain-exception",
      packages: result.packages,
      advisorySources: result.advisorySources,
      note: result.packages.length === 0
        ? "No runtime dependency findings."
        : "Expo SDK 56 pins Metro 0.84.4; upstream has no compatible patch release. This verifier fails on any changed affected package, severity, dependency chain, or advisory source.",
    })}\n`,
  );
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
