import { existsSync, lstatSync, mkdirSync, realpathSync } from "node:fs";
import path from "node:path";

type Environment = {
  PLAYWRIGHT_SMOKE_DIR?: string;
  FAMILY_TREE_SMOKE_EVIDENCE?: string;
};

/** Resolve artifacts only inside the disposable directory admitted by the wrapper. */
export function familyTreeEvidenceDirectory(environment: Environment): string {
  const root = environment.PLAYWRIGHT_SMOKE_DIR;
  const evidence = environment.FAMILY_TREE_SMOKE_EVIDENCE ??
    (root ? path.join(root, "family-tree-evidence") : "");
  if (!root || !path.isAbsolute(root) || !path.isAbsolute(evidence) || path.dirname(evidence) !== root ||
      !existsSync(path.join(root, ".family-manager-smoke"))) {
    throw new Error("Evidence must stay inside the wrapper-owned directory.");
  }
  if (existsSync(evidence) && lstatSync(evidence).isSymbolicLink()) {
    throw new Error("Evidence directory must not be a symbolic link.");
  }
  mkdirSync(evidence, { recursive: true, mode: 0o700 });
  if (path.dirname(realpathSync(evidence)) !== realpathSync(root)) {
    throw new Error("Evidence must stay inside the wrapper-owned directory.");
  }
  return evidence;
}
