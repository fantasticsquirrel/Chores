import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { familyTreeEvidenceDirectory } from "./family-tree-smoke-evidence";

const roots: string[] = [];
function root() {
  const directory = mkdtempSync(path.join(os.tmpdir(), "family-manager-playwright-evidence-"));
  roots.push(directory);
  writeFileSync(path.join(directory, ".family-manager-smoke"), "", { mode: 0o600 });
  return directory;
}
afterEach(() => { for (const directory of roots.splice(0)) rmSync(directory, { recursive: true, force: true }); });

describe("Family Tree smoke evidence ownership", () => {
  it("defaults to a private child of the standard wrapper directory", () => {
    const directory = root();
    expect(familyTreeEvidenceDirectory({ PLAYWRIGHT_SMOKE_DIR: directory })).toBe(path.join(directory, "family-tree-evidence"));
  });
  it("retains an explicit dedicated-runner evidence directory", () => {
    const directory = root();
    const evidence = path.join(directory, "evidence");
    expect(familyTreeEvidenceDirectory({ PLAYWRIGHT_SMOKE_DIR: directory, FAMILY_TREE_SMOKE_EVIDENCE: evidence })).toBe(evidence);
  });
  it("rejects missing ownership, foreign paths and symlink escapes", () => {
    expect(() => familyTreeEvidenceDirectory({})).toThrow(/wrapper-owned/);
    const directory = root();
    const foreign = root();
    expect(() => familyTreeEvidenceDirectory({ PLAYWRIGHT_SMOKE_DIR: directory, FAMILY_TREE_SMOKE_EVIDENCE: path.join(foreign, "evidence") })).toThrow(/wrapper-owned/);
    symlinkSync(foreign, path.join(directory, "escape"), "dir");
    expect(() => familyTreeEvidenceDirectory({ PLAYWRIGHT_SMOKE_DIR: directory, FAMILY_TREE_SMOKE_EVIDENCE: path.join(directory, "escape") })).toThrow(/symbolic link/);
  });
});
